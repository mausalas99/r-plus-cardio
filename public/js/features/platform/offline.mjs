/** Pending jobs, RPC offline/health, idle lock, privacy wipe. */
import { canGenerateDocumentsOffline } from '../../document-export-client.mjs';
import { closeSettingsDropdown } from '../settings-help/settings-dropdown.mjs';
import { AUDIT_LOG_KEY, IDLE_LOCK_DEBOUNCE_MS, IDLE_LOCK_HASH_LS_KEY, IDLE_LOCK_LS_KEY, IDLE_LOCK_VALID_MINUTES } from './shared.mjs';
import { addAuditEntry } from './audit.mjs';
import { getPlatformRuntime } from './runtime.mjs';

const rt = getPlatformRuntime();

var idleLockTimerId = null;
var idleLockDebounceId = null;
var idleLockIsActive = false;
var idleLockEnabledMinutes = 0;

function setRpcOfflineVisible(show) {
  var b = document.getElementById('rpc-offline-banner');
  if (!b) return;
  b.classList.toggle('visible', !!show);
}

// ── Cola de tareas en curso (pendingJobs) ─────────────────────────
var pendingJobs = 0;
function renderPendingJobsPill() {
  try {
    var pill = document.getElementById('pending-jobs-pill');
    if (!pill) return;
    if (pendingJobs > 0) {
      pill.textContent = 'Procesando (' + pendingJobs + ')';
      pill.classList.add('visible');
    } else {
      pill.textContent = '';
      pill.classList.remove('visible');
    }
  } catch (e) {
    console.error('renderPendingJobsPill error:', e && e.message);
  }
}
function incrementPendingJobs() {
  pendingJobs += 1;
  renderPendingJobsPill();
}
function decrementPendingJobs() {
  pendingJobs = Math.max(0, pendingJobs - 1);
  renderPendingJobsPill();
}

// ── Modo offline explícito ────────────────────────────────────────
var rpcOffline = false;
function syncDocExportButtonOfflineState(btn) {
  if (!btn) return;
  if (rpcOffline && !canGenerateDocumentsOffline()) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.dataset.rpcOffline = '1';
    return;
  }
  if (btn.dataset.rpcOffline) delete btn.dataset.rpcOffline;
  if (!btn.classList.contains('loading')) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  }
}

function syncOfflineButtonStates() {
  try {
    var exportButtons = document.querySelectorAll('.rpc-doc-export, #censo-export-confirm');
    exportButtons.forEach(function (b) {
      syncDocExportButtonOfflineState(b);
    });
  } catch (e) {
    console.error('syncOfflineButtonStates error:', e && e.message);
  }
}
function setRpcOffline(offline) {
  var prev = rpcOffline;
  rpcOffline = !!offline;
  setRpcOfflineVisible(rpcOffline);
  syncOfflineButtonStates();
  if (!prev && rpcOffline) {
    if (!canGenerateDocumentsOffline()) {
      try { rt.showToast('Sin conexión con el servidor local. Generación de documentos desactivada.', 'error'); } catch (_e) { void _e; }
    }
  } else if (prev && !rpcOffline) {
    try { rt.showToast('Servidor local reconectado.', 'success'); } catch (_e) { void _e; }
  }
}
function isRpcOffline() { return rpcOffline; }

function checkRpcServerHealth() {
  try {
    fetch('/health', { method: 'GET', cache: 'no-store' })
      .then(function(r) {
        if (r.status === 429) return;
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then(function(j) {
        if (j === undefined) return;
        try {
          if (!j || !j.ok) throw new Error('bad payload');
          setRpcOffline(false);
        } catch (e) {
          setRpcOffline(true);
          console.error('health payload error:', e && e.message);
        }
      })
      .catch(function() {
        try { setRpcOffline(true); } catch (e) { console.error('setRpcOffline error:', e && e.message); }
      });
  } catch (e) {
    console.error('checkRpcServerHealth crashed:', e && e.message);
    try { setRpcOffline(true); } catch (_e) { void _e; }
  }
}

function initRpcServerHealthWatch() {
  checkRpcServerHealth();
  setInterval(checkRpcServerHealth, 15000);
}

// ── Bloqueo por inactividad (Idle lock) ───────────────────────────
function getIdleLockMinutes() {
  var raw = parseInt(localStorage.getItem(IDLE_LOCK_LS_KEY) || '0', 10);
  if (!Number.isFinite(raw)) raw = 0;
  return IDLE_LOCK_VALID_MINUTES.indexOf(raw) !== -1 ? raw : 0;
}

function setIdleLockMinutesStored(mins) {
  var n = IDLE_LOCK_VALID_MINUTES.indexOf(mins) !== -1 ? mins : 0;
  if (n === 0) localStorage.removeItem(IDLE_LOCK_LS_KEY);
  else localStorage.setItem(IDLE_LOCK_LS_KEY, String(n));
}

function getIdleLockPinHash() {
  return localStorage.getItem(IDLE_LOCK_HASH_LS_KEY) || '';
}

function setIdleLockPinHash(hashHex) {
  if (hashHex) localStorage.setItem(IDLE_LOCK_HASH_LS_KEY, hashHex);
  else localStorage.removeItem(IDLE_LOCK_HASH_LS_KEY);
}

function isIdleLockPinFormatValid(pin) {
  return /^\d{4,8}$/.test(String(pin == null ? '' : pin));
}

async function computeSha256Hex(text) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto no disponible');
  var enc = new TextEncoder();
  var buf = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  var bytes = new Uint8Array(buf);
  var hex = '';
  for (var i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

async function promptForIdleLockPinSetup(reason) {
  var label = reason === 'change'
    ? 'Ingresa un nuevo PIN de 4 a 8 dígitos para el bloqueo:'
    : 'Elige un PIN de 4 a 8 dígitos para el bloqueo por inactividad:';
  var p1 = prompt(label, '');
  if (p1 == null) return { ok: false, cancelled: true };
  if (!isIdleLockPinFormatValid(p1)) {
    rt.showToast('PIN inválido (solo 4-8 dígitos).', 'error');
    return { ok: false, cancelled: false };
  }
  var p2 = prompt('Confirma el PIN:', '');
  if (p2 == null) return { ok: false, cancelled: true };
  if (p1 !== p2) {
    rt.showToast('Los PIN no coinciden.', 'error');
    return { ok: false, cancelled: false };
  }
  try {
    var hash = await computeSha256Hex(p1);
    setIdleLockPinHash(hash);
    addAuditEntry('idle-lock-pin-set', 'ok', 0, reason === 'change' ? 'changed' : 'created');
    return { ok: true, cancelled: false };
  } catch {
    rt.showToast('WebCrypto no disponible en este entorno.', 'error');
    addAuditEntry('idle-lock-pin-set', 'error', 0, 'no-webcrypto');
    return { ok: false, cancelled: false };
  }
}

function syncIdleLockSelectUi() {
  var sel = document.getElementById('settings-idle-lock');
  if (sel) sel.value = String(getIdleLockMinutes());
}

async function onIdleLockSelectChange(value) {
  var parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) parsed = 0;
  if (IDLE_LOCK_VALID_MINUTES.indexOf(parsed) === -1) parsed = 0;
  if (parsed === 0) {
    setIdleLockMinutesStored(0);
    addAuditEntry('idle-lock-disable', 'ok', 0, '');
    restartIdleLockTimer();
    syncIdleLockSelectUi();
    rt.showToast('Bloqueo por inactividad desactivado.', 'success');
    return;
  }
  if (!getIdleLockPinHash()) {
    var setup = await promptForIdleLockPinSetup('create');
    if (!setup.ok) {
      syncIdleLockSelectUi();
      return;
    }
  }
  setIdleLockMinutesStored(parsed);
  addAuditEntry('idle-lock-enable', 'ok', parsed, '');
  restartIdleLockTimer();
  syncIdleLockSelectUi();
  rt.showToast('Bloqueo activo: ' + parsed + ' min.', 'success');
}

async function changeIdleLockPin() {
  var existing = getIdleLockPinHash();
  if (existing) {
    var current = prompt('Ingresa el PIN actual para continuar:', '');
    if (current == null) return;
    if (!isIdleLockPinFormatValid(current)) {
      rt.showToast('PIN con formato inválido.', 'error');
      addAuditEntry('idle-lock-pin-change', 'error', 0, 'invalid-format');
      return;
    }
    try {
      var hash = await computeSha256Hex(current);
      if (hash !== existing) {
        rt.showToast('PIN incorrecto.', 'error');
        addAuditEntry('idle-lock-pin-change', 'error', 0, 'wrong-pin');
        return;
      }
    } catch {
      rt.showToast('WebCrypto no disponible.', 'error');
      addAuditEntry('idle-lock-pin-change', 'error', 0, 'no-webcrypto');
      return;
    }
  }
  var setup = await promptForIdleLockPinSetup('change');
  if (setup.ok) {
    rt.showToast('PIN actualizado ✓', 'success');
    restartIdleLockTimer();
  }
}

function restartIdleLockTimer() {
  if (idleLockDebounceId) {
    clearTimeout(idleLockDebounceId);
    idleLockDebounceId = null;
  }
  if (idleLockTimerId) {
    clearTimeout(idleLockTimerId);
    idleLockTimerId = null;
  }
  idleLockEnabledMinutes = getIdleLockMinutes();
  if (idleLockEnabledMinutes <= 0 || idleLockIsActive) return;
  idleLockTimerId = setTimeout(triggerIdleLock, idleLockEnabledMinutes * 60 * 1000);
}

function onIdleActivity() {
  if (idleLockEnabledMinutes <= 0 || idleLockIsActive) return;
  if (idleLockDebounceId) return;
  idleLockDebounceId = setTimeout(function() {
    idleLockDebounceId = null;
    if (idleLockTimerId) clearTimeout(idleLockTimerId);
    idleLockTimerId = setTimeout(triggerIdleLock, idleLockEnabledMinutes * 60 * 1000);
  }, IDLE_LOCK_DEBOUNCE_MS);
}

function triggerIdleLock() {
  if (idleLockIsActive) return;
  if (!getIdleLockPinHash()) return;
  idleLockIsActive = true;
  if (idleLockTimerId) { clearTimeout(idleLockTimerId); idleLockTimerId = null; }
  if (idleLockDebounceId) { clearTimeout(idleLockDebounceId); idleLockDebounceId = null; }
  showIdleLockOverlay();
  addAuditEntry('idle-lock-lock', 'ok', idleLockEnabledMinutes, 'inactivity');
}

function showIdleLockOverlay() {
  var overlay = document.getElementById('rpc-idle-lock-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  var err = document.getElementById('rpc-idle-lock-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  var input = document.getElementById('rpc-idle-lock-pin');
  if (input) { input.value = ''; setTimeout(function() { try { input.focus(); } catch (_e) { void _e; } }, 60); }
}

function hideIdleLockOverlay() {
  var overlay = document.getElementById('rpc-idle-lock-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}

async function submitIdleLockPin() {
  var input = document.getElementById('rpc-idle-lock-pin');
  var err = document.getElementById('rpc-idle-lock-error');
  var pin = input ? input.value : '';
  if (!isIdleLockPinFormatValid(pin)) {
    if (err) { err.style.display = 'block'; err.textContent = 'Formato inválido (4-8 dígitos).'; }
    addAuditEntry('idle-lock-unlock', 'error', 0, 'invalid-format');
    if (input) { input.value = ''; input.focus(); }
    return;
  }
  var expected = getIdleLockPinHash();
  if (!expected) {
    idleLockIsActive = false;
    hideIdleLockOverlay();
    addAuditEntry('idle-lock-unlock', 'ok', 0, 'no-hash-bypass');
    restartIdleLockTimer();
    return;
  }
  try {
    var h = await computeSha256Hex(pin);
    if (h === expected) {
      idleLockIsActive = false;
      hideIdleLockOverlay();
      addAuditEntry('idle-lock-unlock', 'ok', 0, '');
      restartIdleLockTimer();
    } else {
      if (err) { err.style.display = 'block'; err.textContent = 'PIN incorrecto.'; }
      addAuditEntry('idle-lock-unlock', 'error', 0, 'bad-pin');
      if (input) { input.value = ''; input.focus(); }
    }
  } catch {
    if (err) { err.style.display = 'block'; err.textContent = 'WebCrypto no disponible.'; }
    addAuditEntry('idle-lock-unlock', 'error', 0, 'no-webcrypto');
  }
}

function initIdleLockFeature() {
  idleLockEnabledMinutes = getIdleLockMinutes();
  syncIdleLockSelectUi();
  if (idleLockEnabledMinutes > 0 && !getIdleLockPinHash()) {
    // Recover from an inconsistent state: timer configured but PIN missing.
    setIdleLockMinutesStored(0);
    idleLockEnabledMinutes = 0;
    syncIdleLockSelectUi();
    addAuditEntry('idle-lock-reset', 'ok', 0, 'missing-hash');
  }
  var onActivity = function() { onIdleActivity(); };
  window.addEventListener('mousemove', onActivity, { passive: true });
  window.addEventListener('keydown', function(e) {
    if (idleLockIsActive) {
      if (e.key === 'Enter') {
        var overlay = document.getElementById('rpc-idle-lock-overlay');
        if (overlay && overlay.style.display !== 'none') {
          e.preventDefault();
          submitIdleLockPin();
        }
      }
      return;
    }
    onActivity();
  }, true);
  window.addEventListener('click', onActivity, { passive: true });
  restartIdleLockTimer();
}

// ── Borrado de datos (privacidad) ─────────────────────────────────
var wipeModalWired = false;

function showWipeStep(stepId) {
  var steps = ['choose', 'cache', 'full'];
  steps.forEach(function(id) {
    var node = document.getElementById('rpc-wipe-step-' + id);
    if (!node) return;
    node.hidden = id !== stepId;
  });
  var modal = document.getElementById('rpc-wipe-modal');
  if (!modal) return;
  var titleId = stepId === 'cache'
    ? 'rpc-wipe-cache-title'
    : stepId === 'full'
      ? 'rpc-wipe-full-title'
      : 'rpc-wipe-title';
  modal.setAttribute('aria-labelledby', titleId);
}

function resetWipeConfirmUi() {
  showWipeStep('choose');
  var input = document.getElementById('rpc-wipe-full-input');
  if (input) input.value = '';
  var err = document.getElementById('rpc-wipe-full-error');
  if (err) {
    err.textContent = '';
    err.hidden = true;
  }
}

function wireWipeDataModalOnce() {
  if (wipeModalWired) return;
  var panel = document.querySelector('#rpc-wipe-modal .rpc-wipe-panel');
  if (!panel) return;
  wipeModalWired = true;
  panel.addEventListener('click', function(ev) {
    var btn = ev.target.closest('[data-wipe-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-wipe-action');
    if (action === 'close') closeWipeDataModal();
    else if (action === 'choose') showWipeStep('choose');
    else if (action === 'cache-exec') executeWipeCache();
    else if (action === 'full-exec') executeWipeAll();
  });
  var input = document.getElementById('rpc-wipe-full-input');
  if (input) {
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        executeWipeAll();
      }
    });
  }
}

function openWipeDataModal() {
  closeSettingsDropdown();
  wireWipeDataModalOnce();
  var m = document.getElementById('rpc-wipe-modal');
  if (!m) return;
  resetWipeConfirmUi();
  m.style.display = 'flex';
  m.setAttribute('aria-hidden', 'false');
}

function closeWipeDataModal() {
  var m = document.getElementById('rpc-wipe-modal');
  if (!m) return;
  m.style.display = 'none';
  m.setAttribute('aria-hidden', 'true');
  resetWipeConfirmUi();
}

function collectCacheWipeKeys() {
  var keys = [];
  for (var i = 0; i < localStorage.length; i += 1) {
    var k = localStorage.key(i);
    if (!k) continue;
    if (k.indexOf('rpc-preimport-') === 0) keys.push(k);
    else if (k === AUDIT_LOG_KEY) keys.push(k);
    else if (k.indexOf('rpc-auto-backup-') === 0) keys.push(k);
    else if (k === IDLE_LOCK_LS_KEY) keys.push(k);
  }
  return keys;
}

function collectFullWipeKeys() {
  var keys = [];
  for (var i = 0; i < localStorage.length; i += 1) {
    var k = localStorage.key(i);
    if (!k) continue;
    if (k.indexOf('rpc-') === 0 || k === 'theme' || k === 'rplus-last-seen-app-version') {
      keys.push(k);
    }
  }
  return keys;
}

function wipeCacheConfirmed() {
  wireWipeDataModalOnce();
  showWipeStep('cache');
}

function wipeAllConfirmed() {
  wireWipeDataModalOnce();
  showWipeStep('full');
  var input = document.getElementById('rpc-wipe-full-input');
  if (input) setTimeout(function() { try { input.focus(); } catch (_e) { void _e; } }, 60);
}

function executeWipeCache() {
  var keys = collectCacheWipeKeys();
  addAuditEntry('data-wipe-cache', 'ok', keys.length, 'pre-wipe');
  keys.forEach(function(k) {
    try { localStorage.removeItem(k); } catch (_e) { void _e; }
  });
  idleLockEnabledMinutes = 0;
  if (idleLockTimerId) { clearTimeout(idleLockTimerId); idleLockTimerId = null; }
  if (idleLockDebounceId) { clearTimeout(idleLockDebounceId); idleLockDebounceId = null; }
  addAuditEntry('data-wipe-cache', 'ok', keys.length, 'completed');
  closeWipeDataModal();
  syncIdleLockSelectUi();
  rt.showToast('Se eliminaron ' + keys.length + ' elementos temporales.', 'success');
}

function executeWipeAll() {
  var input = document.getElementById('rpc-wipe-full-input');
  var err = document.getElementById('rpc-wipe-full-error');
  var typed = String(input && input.value != null ? input.value : '').trim().toUpperCase();
  if (typed !== 'BORRAR') {
    addAuditEntry('data-wipe-full', 'cancelled', 0, 'confirmation-failed');
    if (err) {
      err.textContent = 'Escribe BORRAR en mayúsculas para continuar.';
      err.hidden = false;
    }
    if (input) input.focus();
    return;
  }
  if (err) {
    err.textContent = '';
    err.hidden = true;
  }
  var keys = collectFullWipeKeys();
  addAuditEntry('data-wipe-full', 'ok', keys.length, 'pre-wipe');
  keys.forEach(function(k) {
    try { localStorage.removeItem(k); } catch (_e) { void _e; }
  });
  closeWipeDataModal();
  if (window.electronAPI && typeof window.electronAPI.relaunchApp === 'function') {
    try { window.electronAPI.relaunchApp(); return; } catch (_e) { void _e; }
  }
  location.reload();
}

function openUserDataFolderFromSettings() {
  if (!window.electronAPI || !window.electronAPI.openUserDataFolder) {
    rt.showToast('Solo disponible en la aplicación de escritorio.', 'error');
    return;
  }
  window.electronAPI.openUserDataFolder().then(function(res) {
    if (res && res.ok) rt.showToast('Carpeta abierta', 'success');
    else rt.showToast((res && res.error) || 'No se pudo abrir la carpeta', 'error');
  }).catch(function() {
    rt.showToast('No se pudo abrir la carpeta', 'error');
  });
}

function safeExportSlug(str) {
  var s = (str || 'paciente').replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]+/g, '_').replace(/^_|_$/g, '');
  return (s || 'paciente').slice(0, 48);
}

export {
  incrementPendingJobs,
  decrementPendingJobs,
  syncOfflineButtonStates,
  isRpcOffline,
  setRpcOffline,
  checkRpcServerHealth,
  initRpcServerHealthWatch,
  syncIdleLockSelectUi,
  onIdleLockSelectChange,
  changeIdleLockPin,
  submitIdleLockPin,
  initIdleLockFeature,
  openWipeDataModal,
  closeWipeDataModal,
  wipeCacheConfirmed,
  wipeAllConfirmed,
  openUserDataFolderFromSettings,
  safeExportSlug,
};
