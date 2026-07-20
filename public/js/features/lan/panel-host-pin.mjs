/**
 * LAN panel host pin + shift PIN sections — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import {
  isClinicalLocalOnlyMode,
  readRpcSettings,
  bundledWardShiftPin,
  bundledWardHostUrl,
} from '../../clinical-settings.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import {
  getPinnedHostUrl,
  setPinnedHostUrl,
  clearPinnedHostUrl,
  isPinnedHostLocal,
  hasPinnedHostOverride,
} from '../../lan-host-pin.mjs';
import { normalizeLanHostBase } from '../../lan-host-subnet-discovery.mjs';
import { listWardHostUrlsForProbe } from '../../lan-ward-host-registry.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { cardionotasLoopbackBaseUrl } from '../../http-port.mjs';
import {
  isLanSessionConfiguredForRest,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  resolveLanShareBaseUrl,
  resolveHostBearerToken,
  getLanTeamCodeFromConfig,
  lanFetchAuthed,
  shouldShowLanShiftPinClientConnect,
  shouldShowLanShiftPinHostDisplay,
  isLanRestHostOwnMachine,
  applyPinnedHostOverride,
  resolveOwnLanBaseForPin,
} from './transport.mjs';

function formatShiftPinDisplay(pin) {
  var s = String(pin || '').replace(/\D/g, '');
  if (s.length === 6) return s.slice(0, 3) + ' ' + s.slice(3);
  return s;
}

/** @typedef {ReturnType<typeof createPanelHostPin>} PanelHostPinApi */

function createLanHostPinCheckboxParts() {
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'lan-pin-host-checkbox';
  cb.className = 'settings-card__toggle';
  return { cb };
}

function buildLanHostPinModeHint() {
  var hint = document.createElement('p');
  hint.className = 'lan-connect-card-hint';
  hint.style.marginTop = '6px';
  hint.textContent = isLanRemoteJoinMode()
    ? 'Marca la casilla para forzar esta Mac como anfitrión (anula modo cliente y elección automática).'
    : 'Override del turno: esta Mac será el servidor aunque haya otros en la red. Desmarca para volver a elección automática.';
  return hint;
}

function wireLanHostPinCheckbox(deps, cb, hostUrl, resolvedOwn) {
  var ownForPin = resolvedOwn || hostUrl || '';
  var pinned = getPinnedHostUrl();
  cb.checked =
    !!pinned &&
    (pinned === String(hostUrl || '').replace(/\/+$/, '') ||
      isPinnedHostLocal(ownForPin) ||
      (ownForPin && pinned === ownForPin));
  cb.disabled = false;
  cb.onchange = function () {
    if (cb.checked) {
      void resolveLanShareBaseUrl().then(function (shareUrl) {
        var pinUrl = shareUrl || hostUrl || resolvedOwn;
        setPinnedHostUrl(pinUrl);
        void applyPinnedHostOverride(getLanTeamCodeFromConfig(), {}).then(function (ok) {
          if (ok) {
            deps.runtime().showToast(
              'Anfitrión fijado: esta Mac asume el servidor del turno.',
              'success'
            );
          } else {
            deps.runtime().showToast(
              'No se pudo activar el servidor en esta Mac. Revisa «Configura tu rotación» o pulsa Convertirse en host.',
              'error'
            );
          }
          deps.renderLanPanel({ force: true });
        });
      });
    } else {
      clearPinnedHostUrl();
      deps.runtime().showToast(
        'Anfitrión ya no está fijado; la red puede sugerir otro servidor.',
        'info'
      );
      deps.renderLanPanel({ force: true });
    }
  };
}

function appendLanHostPinPinnedHints(wrap, ownBase, pinned) {
  if (!pinned) return;
  void resolveOwnLanBaseForPin().then(function (resolvedOwn) {
    var ownResolved = resolvedOwn || ownBase;
    if (!isPinnedHostLocal(ownResolved) && isLanRemoteJoinMode()) {
      var remoteHint = document.createElement('p');
      remoteHint.className = 'lan-connect-card-hint';
      remoteHint.style.marginTop = '4px';
      remoteHint.textContent = 'Conectando al anfitrión fijado: ' + pinned;
      wrap.appendChild(remoteHint);
    } else if (isPinnedHostLocal(ownResolved) && isLanRemoteJoinMode()) {
      var localHint = document.createElement('p');
      localHint.className = 'lan-connect-card-hint';
      localHint.style.marginTop = '4px';
      localHint.textContent =
        'Fijado en esta Mac (' + pinned + '). La casilla fuerza servidor local (override).';
      wrap.appendChild(localHint);
    }
  });
}

/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
function appendLanHostPinSection(deps, root) {
  if (!root || !isLanElectronDesktop() || !canLocalMacBeLanHost()) return;
  var hostUrl = deps.lanHostUrl();
  if (!hostUrl && !getPinnedHostUrl()) return;
  if (root.querySelector('#lan-pin-host-checkbox')) return;

  var row = document.createElement('div');
  row.className = 'settings-card settings-card--toggle';
  var copy = document.createElement('div');
  copy.className = 'settings-card__copy';
  var title = document.createElement('p');
  title.className = 'settings-card__title';
  title.textContent = 'Fijar anfitrión del turno';
  var desc = document.createElement('p');
  desc.className = 'settings-card__desc';
  desc.textContent = 'Solo en Mac servidor';
  copy.appendChild(title);
  copy.appendChild(desc);

  var pinParts = createLanHostPinCheckboxParts();
  var action = document.createElement('label');
  action.className = 'settings-card__action settings-card__toggle-label';
  action.setAttribute('for', 'lan-pin-host-checkbox');
  action.appendChild(pinParts.cb);

  row.appendChild(copy);
  row.appendChild(action);
  root.appendChild(row);

  var ownBase = hostUrl || '';
  var pinned = getPinnedHostUrl();

  void resolveOwnLanBaseForPin().then(function (resolvedOwn) {
    wireLanHostPinCheckbox(deps, pinParts.cb, hostUrl, resolvedOwn);
    if (pinned) {
      var pinnedNote = copy.querySelector('[data-lan-pin-pinned-note]');
      if (!pinnedNote) {
        pinnedNote = document.createElement('p');
        pinnedNote.className = 'settings-card__desc';
        pinnedNote.setAttribute('data-lan-pin-pinned-note', '1');
        copy.appendChild(pinnedNote);
      }
      pinnedNote.textContent = isPinnedHostLocal(resolvedOwn || ownBase)
        ? 'Anfitrión fijado en esta Mac.'
        : 'Anfitrión fijado: ' + pinned;
    }
  });
}

function buildLanTurnResetAlertStrip(deps, ownHost) {
  var strip = document.createElement('div');
  strip.className = 'lan-alert-strip lan-turn-reset-alert';

  var copy = document.createElement('div');
  copy.className = 'lan-alert-strip__copy';
  var title = document.createElement('strong');
  title.textContent = ownHost ? 'Dos servidores en la misma sala' : 'Restablecer conexión ⇄';
  var hint = document.createElement('div');
  hint.className = 'lan-alert-strip__hint';
  hint.textContent = ownHost
    ? 'Esta Mac usa su propio servidor. Restablece y conéctate al anfitrión del turno (PIN o enlace ⇄).'
    : 'Si el directorio no coincide entre Macs, restablece y vuelve a conectar.';
  copy.appendChild(title);
  copy.appendChild(hint);
  strip.appendChild(copy);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = ownHost ? 'btn-settings-row btn-settings-row--warn' : 'btn-settings-row';
  btn.textContent = 'Restablecer';
  btn.onclick = function () {
    void resetLanTurnConnectionFromUi(deps);
  };
  strip.appendChild(btn);

  return strip;
}

/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
async function appendLanTurnResetAlertStrip(deps, root, gen) {
  if (!isLanElectronDesktop()) return;
  if (isClinicalLocalOnlyMode(readRpcSettings())) return;

  var ownHost = false;
  var ownUrl = '';
  try {
    ownUrl = await resolveOwnLanBaseForPin();
    ownHost = await isLanRestHostOwnMachine();
  } catch (_e) { void _e; }

  if (deps.lanPanelRenderStale(gen)) return;

  // Local pin: no split-brain banner. Promotion runs in syncLanHostBeforeRender_ / user toggle — never re-render here.
  if (hasPinnedHostOverride() && isPinnedHostLocal(ownUrl)) {
    root.querySelectorAll('.lan-turn-reset-alert, .lan-turn-reset-card').forEach(function (el) {
      el.remove();
    });
    return;
  }

  root.querySelectorAll('.lan-turn-reset-alert, .lan-turn-reset-card').forEach(function (el) {
    el.remove();
  });

  root.appendChild(buildLanTurnResetAlertStrip(deps, ownHost));
}

/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
async function resetLanTurnConnectionFromUi(deps) {
  if (!isLanElectronDesktop()) {
    deps.runtime().showToast('Solo disponible en la app de escritorio.', 'error');
    return;
  }
  var resetMod = await import('../../lan-turn-reset.mjs');
  if (!confirm(resetMod.LAN_TURN_RESET_CLIENT_CONFIRM)) return;

  await resetMod.performLanTurnClientReset({
    leaveLiveSyncRoom: deps.leaveLiveSyncRoom,
    lanClient: deps.getLanClient(),
  });
  try {
    const profileLan = await import('../../clinical-profile-lan-sync.mjs');
    if (typeof profileLan.seedDevPeerLanConfigIfNeeded === 'function') {
      await profileLan.seedDevPeerLanConfigIfNeeded();
    }
  } catch (_e) { void _e; }
  deps.resumeAutoHostDetectAndReconnect();

  var connected = false;
  try {
    const pinMod = await import('../../lan-shift-pin-connect.mjs');
    if (typeof pinMod.tryEasyLanShiftPinConnect === 'function') {
      const result = await pinMod.tryEasyLanShiftPinConnect({
        force: true,
        skipCooldown: true,
      });
      connected = !!(result && result.ok);
    }
  } catch (_e) { void _e; }

  try {
    const panel = await import('./panel.mjs');
    if (typeof panel.scanLanHosts === 'function') {
      void panel.scanLanHosts();
    }
  } catch (_e) { void _e; }

  deps.runtime().showToast(
    connected
      ? 'Conexión restablecida — conectado al anfitrión del turno.'
      : 'Conexión restablecida. Buscando anfitrión en la Wi‑Fi del hospital…',
    connected ? 'success' : 'info'
  );
  deps.renderLanPanel({ force: true });
  if (!isLanSkipShiftPin()) {
    window.setTimeout(function () {
      deps.focusLanShiftPinInput();
    }, 120);
  }
}

function resolveLanShiftPinHostPrefill() {
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var devHost =
    typeof window !== 'undefined' &&
    window.electronAPI &&
    typeof window.electronAPI.isLanDevPeer === 'function' &&
    window.electronAPI.isLanDevPeer()
      ? cardionotasLoopbackBaseUrl()
      : '';
  return (
    normalizeLanHostBase(cfg.hostUrl) ||
    normalizeLanHostBase(devHost) ||
    listWardHostUrlsForProbe()[0] ||
    ''
  );
}

function createLanShiftPinClientInput() {
  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'lan-input-shift-pin';
  input.className = 'profile-input';
  input.inputMode = 'numeric';
  input.maxLength = 6;
  input.autocomplete = 'off';
  input.placeholder = '123456';
  var saved = typeof storage.getLanShiftPin === 'function' ? storage.getLanShiftPin() : '';
  var bundled = bundledWardShiftPin();
  if (saved) input.value = saved;
  else if (bundled) input.value = bundled;
  return input;
}

function createLanShiftPinHostUrlField(wardPrefill) {
  var hostUrlLabel = document.createElement('label');
  hostUrlLabel.className = 'lan-connect-card-hint';
  hostUrlLabel.style.display = 'block';
  hostUrlLabel.style.marginTop = '8px';
  hostUrlLabel.style.marginBottom = '4px';
  hostUrlLabel.setAttribute('for', 'lan-input-host-url-ward');
  hostUrlLabel.textContent = isLanSkipShiftPin()
    ? 'Dirección del anfitrión'
    : 'Dirección del anfitrión (opcional)';

  var hostUrlInput = document.createElement('input');
  hostUrlInput.type = 'text';
  hostUrlInput.id = 'lan-input-host-url-ward';
  hostUrlInput.className = 'profile-input lan-shift-pin-host-url';
  hostUrlInput.autocomplete = 'off';
  hostUrlInput.placeholder =
    bundledWardHostUrl() || cardionotasLoopbackBaseUrl() + ' o IP del anfitrión';
  if (wardPrefill) hostUrlInput.value = wardPrefill;

  var hostUrlHint = document.createElement('p');
  hostUrlHint.className = 'lan-connect-card-hint';
  hostUrlHint.style.marginTop = '4px';
  hostUrlHint.textContent =
    'Si el Wi‑Fi del hospital cambia de red, pide la dirección al R4 o pégala aquí.';

  return { hostUrlLabel, hostUrlInput, hostUrlHint };
}

function wireLanShiftPinClientConnect(deps, input, hostUrlInput, btn, bypass) {
  btn.addEventListener('click', function () {
    var pin = input ? String(input.value || '').trim() : '';
    if (!bypass && !/^\d{6}$/.test(pin)) {
      deps.runtime().showToast('Ingresa los 6 dígitos del PIN.', 'error');
      return;
    }
    btn.disabled = true;
    var manualHost = String(hostUrlInput.value || '').trim();
    void import('../../lan-shift-pin-connect.mjs')
      .then(function (m) {
        return m.tryEasyLanShiftPinConnect({
          shiftPin: bypass ? undefined : pin,
          hostUrl: manualHost,
          force: true,
        });
      })
      .then(function (result) {
        if (result && result.ok) {
          deps.renderLanPanel({ force: true });
          return;
        }
        deps.runtime().showToast(
          bypass
            ? 'No encontramos el anfitrión en esa dirección. Revisa el Wi‑Fi o pide la URL al R4.'
            : 'No encontramos el turno con ese PIN. Revisa el Wi‑Fi clínico o pide otro PIN.',
          'error'
        );
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
  if (input) {
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') btn.click();
    });
  }
  hostUrlInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') btn.click();
  });
}

function buildLanShiftPinClientConnectCard(deps) {
  var bypass = isLanSkipShiftPin();
  var wrap = document.createElement('div');
  wrap.className = 'lan-connect-card lan-shift-pin-client-card';
  wrap.setAttribute('data-lan-shift-pin-client', '1');

  var title = document.createElement('p');
  title.className = 'lan-connect-card-title';
  title.textContent = bypass ? 'Conectar al anfitrión del turno' : 'PIN del turno';
  wrap.appendChild(title);

  var lead = document.createElement('p');
  lead.className = 'lan-connect-card-hint';
  lead.textContent = bypass
    ? 'Buscamos al R4 en la Wi‑Fi del hospital. Si no conecta, pega su dirección abajo (p. ej. http://10.0.57.65:3738).'
    : 'Pide los 6 dígitos al anfitrión (R4 en ⇄).';
  wrap.appendChild(lead);

  var input = bypass ? null : createLanShiftPinClientInput();
  if (input) wrap.appendChild(input);

  var hostFields = createLanShiftPinHostUrlField(resolveLanShiftPinHostPrefill());
  if (bypass) {
    hostFields.hostUrlLabel.textContent = 'Dirección del anfitrión';
  }
  wrap.appendChild(hostFields.hostUrlLabel);
  wrap.appendChild(hostFields.hostUrlInput);
  wrap.appendChild(hostFields.hostUrlHint);

  var row = document.createElement('div');
  row.className = 'lan-connect-actions-row';
  row.style.marginTop = '8px';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-lan-primary';
  btn.style.flex = '1';
  btn.textContent = 'Conectar';
  wireLanShiftPinClientConnect(deps, input, hostFields.hostUrlInput, btn, bypass);
  row.appendChild(btn);
  wrap.appendChild(row);

  return wrap;
}

/** Client: enter shift PIN to find host across hospital Wi‑Fi / VLANs. */
/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
async function appendLanShiftPinClientConnectSection(deps, root, gen) {
  if (!root || !isLanElectronDesktop() || deps.lanPanelRenderStale(gen)) return;
  var offer = await shouldShowLanShiftPinClientConnect();
  if (deps.lanPanelRenderStale(gen) || !offer) return;
  if (root.querySelector('[data-lan-shift-pin-client]')) return;

  root.insertBefore(buildLanShiftPinClientConnectCard(deps), root.firstChild);
}

/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
function appendLanHostAddressCopyButton(deps, root, gen) {
  if (!root || !isLanElectronDesktop() || isLanRemoteJoinMode()) return;
  if (deps.lanPanelRenderStale(gen)) return;
  if (!isLanSessionConfiguredForRest() && !deps.getLanClient().connected) return;
  if (root.querySelector('[data-lan-host-address-copy]')) return;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-settings-row';
  btn.setAttribute('data-lan-host-address-copy', '1');
  btn.textContent = 'Copiar dirección';
  btn.addEventListener('click', function () {
    void resolveLanShareBaseUrl().then(function (shareUrl) {
      if (!shareUrl) {
        deps.runtime().showToast('No hay dirección del anfitrión disponible.', 'error');
        return;
      }
      void copyToClipboardSafe(shareUrl).then(function (ok) {
        if (ok) {
          deps.runtime().showToast(
            'Dirección copiada — en la otra Mac pégala en ⇄ (Unirse) junto con el PIN del turno.',
            'success'
          );
          return;
        }
        deps.runtime().showToast('No se pudo copiar al portapapeles.', 'error');
      });
    });
  });

  var anchor =
    root.querySelector('.lan-connection-hero__pin-actions') ||
    root.querySelector('[data-lan-shift-pin]') ||
    root.querySelector('.lan-connection-hero');
  if (anchor) {
    if (anchor.classList.contains('lan-connection-hero__pin-actions')) {
      anchor.appendChild(btn);
    } else {
      var actions = anchor.querySelector('.lan-connection-hero__pin-actions');
      if (actions) actions.appendChild(btn);
      else anchor.appendChild(btn);
    }
  } else {
    root.appendChild(btn);
  }
}

async function fetchValidLanShiftPin(deps, gen) {
  if (!shouldShowLanShiftPinHostDisplay() || deps.lanPanelRenderStale(gen)) return null;
  var bearer = await resolveHostBearerToken();
  if (!bearer || deps.lanPanelRenderStale(gen)) return null;
  try {
    var resp = await lanFetchAuthed('/api/lan/v1/auth/shift-pin');
    if (!resp.ok || deps.lanPanelRenderStale(gen)) return null;
    var body = await resp.json();
    var pin = String(body.pin || '').trim();
    if (!/^\d{6}$/.test(pin) || deps.lanPanelRenderStale(gen)) return null;
    return { pin, body };
  } catch {
    return null;
  }
}

function buildLanShiftPinExpiryLine(expiresAt) {
  var exp = document.createElement('p');
  exp.className = 'lan-pin-meta';
  try {
    exp.textContent =
      'Válido hasta ' +
      new Date(expiresAt).toLocaleString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      });
  } catch {
    exp.textContent = 'Válido hasta ' + String(expiresAt);
  }
  return exp;
}

function buildLanShiftPinHostActions(deps, pin) {
  var actions = document.createElement('div');
  actions.className = 'lan-connection-hero__pin-actions';

  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-settings-row';
  copyBtn.id = 'lan-copy-shift-pin';
  copyBtn.textContent = 'Copiar';
  copyBtn.addEventListener('click', function () {
    void copyToClipboardSafe(pin).then(function (ok) {
      deps.runtime().showToast(
        ok ? 'PIN del turno copiado.' : 'No se pudo copiar al portapapeles.',
        ok ? 'success' : 'error'
      );
    });
  });
  actions.appendChild(copyBtn);

  var regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = 'btn-settings-row';
  regenBtn.id = 'lan-regen-shift-pin';
  regenBtn.textContent = 'Nuevo';
  regenBtn.addEventListener('click', function () {
    void lanFetchAuthed('/api/lan/v1/auth/shift-pin/regenerate', { method: 'POST' }).then(
      function (r) {
        if (r && r.ok) {
          deps.runtime().showToast('PIN del turno renovado.', 'success');
          deps.renderLanPanel({ force: true });
        } else {
          deps.runtime().showToast('No se pudo renovar el PIN.', 'error');
        }
      }
    );
  });
  actions.appendChild(regenBtn);

  return actions;
}

function ensureLanHeroPinSlot(root) {
  var hero = root.classList.contains('lan-connection-hero')
    ? root
    : root.querySelector('.lan-connection-hero') || root;
  var pin = hero.querySelector('.lan-connection-hero__pin');
  if (!pin) {
    pin = document.createElement('div');
    pin.className = 'lan-connection-hero__pin';
    pin.setAttribute('data-lan-shift-pin', '1');
    pin.setAttribute('aria-label', 'PIN del turno');
    hero.appendChild(pin);
  }
  return pin;
}

function buildLanShiftPinHostPinContent(deps, pinValue, body) {
  var pin = document.createElement('div');
  pin.className = 'lan-connection-hero__pin-main';
  var code = document.createElement('code');
  code.id = 'lan-shift-pin-code';
  code.className = 'lan-pin-code';
  code.textContent = formatShiftPinDisplay(pinValue);
  pin.appendChild(code);
  if (body.expiresAt) {
    pin.appendChild(buildLanShiftPinExpiryLine(body.expiresAt));
  }
  return pin;
}

function renderLanShiftPinIntoHero(deps, root, pinValue, body) {
  var slot = ensureLanHeroPinSlot(root);
  slot.innerHTML = '';
  slot.setAttribute('data-lan-shift-pin', '1');
  slot.appendChild(buildLanShiftPinHostPinContent(deps, pinValue, body));
  slot.appendChild(buildLanShiftPinHostActions(deps, pinValue));
}

/** Shared ward PIN for registration (reusable until shift TTL). */
/** @param {Parameters<typeof createPanelHostPin>[0]} deps */
async function appendLanShiftPinSection(deps, root, gen) {
  if (!root || !isLanElectronDesktop() || deps.lanPanelRenderStale(gen)) return;
  var fetched = await fetchValidLanShiftPin(deps, gen);
  if (!fetched || deps.lanPanelRenderStale(gen)) return;

  root.querySelectorAll('[data-lan-shift-pin]').forEach(function (el) {
    if (el.classList.contains('lan-connection-hero__pin')) return;
    el.remove();
  });

  renderLanShiftPinIntoHero(deps, root, fetched.pin, fetched.body);
}

/** @param {{
 *   runtime: () => object,
 *   renderLanPanel: (opts?: object) => void,
 *   lanHostUrl: () => string,
 *   lanPanelRenderStale: (gen: number) => boolean,
 *   getLanClient: () => object,
 *   leaveLiveSyncRoom: (...args: unknown[]) => unknown,
 *   resumeAutoHostDetectAndReconnect: () => void,
 *   focusLanShiftPinInput: () => boolean,
 * }} deps */
export function createPanelHostPin(deps) {
  return {
    appendLanHostPinSection: function (root) {
      return appendLanHostPinSection(deps, root);
    },
    appendLanTurnResetAlertStrip: function (root, gen) {
      return appendLanTurnResetAlertStrip(deps, root, gen);
    },
    appendLanShiftPinClientConnectSection: function (root, gen) {
      return appendLanShiftPinClientConnectSection(deps, root, gen);
    },
    appendLanHostAddressCopyButton: function (root, gen) {
      return appendLanHostAddressCopyButton(deps, root, gen);
    },
    appendLanShiftPinSection: function (root, gen) {
      return appendLanShiftPinSection(deps, root, gen);
    },
    resetLanTurnConnectionFromUi: function () {
      return resetLanTurnConnectionFromUi(deps);
    },
  };
}
