import { unlockErrorMessage } from './db-unlock-errors.mjs';
import {
  needsPassphraseConfirm,
  migrationUiPending,
  runMigrationProbe,
} from './db-unlock-migration.mjs';
import { isSqlcipherNativeReady } from './db-unlock-native.mjs';
import { dbUnlockState, electronApi } from './db-unlock-state.mjs';

export function toggleDbUnlockSecretField(toggleBtn) {
  if (!toggleBtn) return;
  var controlId = toggleBtn.getAttribute('aria-controls');
  var input = controlId ? document.getElementById(controlId) : null;
  if (!input) return;
  var show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
  toggleBtn.textContent = show ? 'Ocultar' : 'Mostrar';
  toggleBtn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

function wireDbUnlockSecretToggles() {
  if (typeof document === 'undefined') return;
  var toggles = document.querySelectorAll('[data-db-unlock-secret-toggle]');
  for (var i = 0; i < toggles.length; i += 1) {
    var btn = toggles[i];
    if (btn.dataset.dbUnlockSecretWired === '1') continue;
    btn.dataset.dbUnlockSecretWired = '1';
    btn.addEventListener('click', function (ev) {
      toggleDbUnlockSecretField(ev.currentTarget);
    });
  }
}

function resetDbUnlockSecretFields() {
  var ids = ['rpc-db-unlock-pass', 'rpc-db-unlock-confirm'];
  for (var i = 0; i < ids.length; i++) {
    var input = document.getElementById(ids[i]);
    if (input) input.type = 'password';
  }
  var toggles = document.querySelectorAll('[data-db-unlock-secret-toggle]');
  for (var j = 0; j < toggles.length; j++) {
    toggles[j].setAttribute('aria-pressed', 'false');
    toggles[j].textContent = 'Mostrar';
    toggles[j].setAttribute('aria-label', 'Mostrar contraseña');
  }
  resetDbUnlockRecoveryMode();
}

function resetDbUnlockRecoveryMode() {
  var recoveryWrap = document.getElementById('rpc-db-unlock-recovery-wrap');
  var submitBtn = document.getElementById('rpc-db-unlock-submit');
  if (recoveryWrap) recoveryWrap.style.display = 'none';
  if (submitBtn) submitBtn.setAttribute('onclick', 'submitDbUnlockPassphrase()');
  var recCode = document.getElementById('rpc-db-unlock-recovery-code');
  if (recCode) recCode.value = '';
}

export function setOverlayVisible(visible) {
  var overlay = document.getElementById('rpc-db-unlock-overlay');
  if (!overlay) return;
  overlay.style.display = visible ? 'flex' : 'none';
  overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (visible) {
    document.body.classList.add('rpc-db-unlock-active');
    resetDbUnlockSecretFields();
    wireDbUnlockSecretToggles();
    var recCode = document.getElementById('rpc-db-unlock-recovery-code');
    if (recCode) {
      recCode.value = '';
      recCode.focus();
    }
  } else {
    document.body.classList.remove('rpc-db-unlock-active');
  }
}

export function finishUnlockFlow(result) {
  dbUnlockState.pendingUnlockCompletion = result;
  if (result && result.recoveryCodeToShow) {
    showRecoveryCodeReveal(String(result.recoveryCodeToShow));
    return;
  }
  setOverlayVisible(false);
  if (dbUnlockState.unlockWaitResolve) {
    var done = dbUnlockState.unlockWaitResolve;
    dbUnlockState.unlockWaitResolve = null;
    done(result);
  }
  void import('./db-unlock-completion.mjs').then((mod) => mod.applyClinicalDbUnlockCompletion());
}

export function showRecoveryCodeReveal(code) {
  var reveal = document.getElementById('rpc-db-unlock-recovery-reveal');
  var codeEl = document.getElementById('rpc-db-unlock-recovery-reveal-code');
  var panelMain = document.getElementById('rpc-db-unlock-form-main');
  if (!reveal || !codeEl) {
    var fallback = dbUnlockState.pendingUnlockCompletion || { unlocked: true, status: {} };
    dbUnlockState.pendingUnlockCompletion = null;
    setOverlayVisible(false);
    if (dbUnlockState.unlockWaitResolve) {
      var doneMissing = dbUnlockState.unlockWaitResolve;
      dbUnlockState.unlockWaitResolve = null;
      doneMissing(fallback);
    }
    return;
  }
  codeEl.textContent = code;
  if (panelMain) panelMain.style.display = 'none';
  reveal.style.display = 'block';
}

export function dismissRecoveryCodeReveal() {
  var reveal = document.getElementById('rpc-db-unlock-recovery-reveal');
  var panelMain = document.getElementById('rpc-db-unlock-form-main');
  if (reveal) reveal.style.display = 'none';
  if (panelMain) panelMain.style.display = '';
  var result = dbUnlockState.pendingUnlockCompletion || { unlocked: true, status: {} };
  dbUnlockState.pendingUnlockCompletion = null;
  setOverlayVisible(false);
  if (dbUnlockState.unlockWaitResolve) {
    var done = dbUnlockState.unlockWaitResolve;
    dbUnlockState.unlockWaitResolve = null;
    done(result);
  }
  void import('./db-unlock-completion.mjs').then((mod) => mod.applyClinicalDbUnlockCompletion());
}

export function setUnlockError(msg) {
  var err = document.getElementById('rpc-db-unlock-error');
  if (!err) return;
  if (msg) {
    err.textContent = msg;
    err.style.display = 'block';
  } else {
    err.textContent = '';
    err.style.display = 'none';
  }
}

function configureUnlockConfirmSection(needsConfirm) {
  var confirmWrap = document.getElementById('rpc-db-unlock-confirm-wrap');
  var confirmInput = document.getElementById('rpc-db-unlock-confirm');
  if (confirmWrap) confirmWrap.style.display = needsConfirm ? '' : 'none';
  if (confirmInput) confirmInput.value = '';
  return confirmInput;
}

function unlockHintForMode(status, probe, needsConfirm) {
  if (migrationUiPending(status, probe)) {
    return 'Hay datos locales por migrar a la base cifrada. Elige una contraseña maestra (mínimo 8 caracteres) y confírmala.';
  }
  if (needsConfirm) {
    return 'Primera vez: crea una contraseña maestra para cifrar pacientes, notas y labs en este equipo (mínimo 8 caracteres). No es la contraseña de Mi Perfil.';
  }
  return 'Ingresa la contraseña maestra que elegiste al activar la base cifrada. No es la contraseña de Mi Perfil ni el PIN de bloqueo por inactividad.';
}

function configureUnlockTitleAndHint(status, probe, needsConfirm) {
  var title = document.getElementById('rpc-db-unlock-title');
  var hint = document.getElementById('rpc-db-unlock-hint');
  if (title) {
    title.textContent = needsConfirm ? 'Protege tus datos clínicos' : 'Desbloquear base de datos';
  }
  if (hint) hint.textContent = unlockHintForMode(status, probe, needsConfirm);
  return { title: title, hint: hint };
}

function configureUnlockPassAutocomplete(needsConfirm, confirmInput) {
  var passInput = document.getElementById('rpc-db-unlock-pass');
  if (passInput) {
    passInput.autocomplete = needsConfirm ? 'new-password' : 'current-password';
  }
  if (confirmInput) {
    confirmInput.autocomplete = 'new-password';
  }
}

function configureUnlockSubmitControls(status, needsConfirm, nativeBlocked) {
  var rate = document.getElementById('rpc-db-unlock-rate-limited');
  if (rate) rate.style.display = status && status.rateLimited ? 'block' : 'none';
  var submit = document.getElementById('rpc-db-unlock-submit');
  if (submit) {
    submit.disabled = !!(status && status.rateLimited) || nativeBlocked;
    submit.textContent = needsConfirm ? 'Crear contraseña y continuar' : 'Desbloquear';
  }
  var recoveryToggle = document.getElementById('rpc-db-unlock-recovery-toggle');
  if (recoveryToggle) recoveryToggle.style.display = needsConfirm || nativeBlocked ? 'none' : '';
}

function applyNativeBlockedUi(status, title, hint) {
  setUnlockError(
    status.nativeError ||
      unlockErrorMessage({ code: 'DB_NATIVE_ABI_MISMATCH' }, { nativeError: status.nativeError })
  );
  if (title) title.textContent = 'Instalación incompleta';
  if (hint) {
    hint.textContent =
      'Esta copia de R+ no cargó los módulos nativos necesarios. Restaura una versión estable en Ajustes → Aplicación o descarga el instalador desde GitHub.';
  }
}

export function configureUnlockForm(status, probe) {
  var needsConfirm = needsPassphraseConfirm(status, probe);
  dbUnlockState.lastNeedsConfirm = needsConfirm;
  var confirmInput = configureUnlockConfirmSection(needsConfirm);
  var titleHint = configureUnlockTitleAndHint(status, probe, needsConfirm);
  configureUnlockPassAutocomplete(needsConfirm, confirmInput);

  var nativeBlocked = !!(status && !isSqlcipherNativeReady(status));
  configureUnlockSubmitControls(status, needsConfirm, nativeBlocked);
  if (nativeBlocked) {
    applyNativeBlockedUi(status, titleHint.title, titleHint.hint);
  } else {
    setUnlockError('');
  }
  wireDbUnlockSecretToggles();
  return nativeBlocked;
}

export function waitForUnlockOverlay() {
  return new Promise(function (resolve) {
    dbUnlockState.unlockWaitResolve = resolve;
  });
}

export async function presentDbUnlockGate(status) {
  var electron = electronApi();
  var probe = await runMigrationProbe(electron);
  dbUnlockState.lastMigrationProbe = probe;
  configureUnlockForm(status, probe);
  setOverlayVisible(true);
  var passInput = document.getElementById('rpc-db-unlock-pass');
  if (passInput) passInput.focus();
  return waitForUnlockOverlay();
}

/** @internal tests */
export function __resetDbUnlockWaitForTests() {
  dbUnlockState.unlockWaitResolve = null;
  dbUnlockState.lastMigrationProbe = null;
  setOverlayVisible(false);
}
