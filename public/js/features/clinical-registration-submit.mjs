/**
 * Clinical registration form submit — extracted from clinical-registration.mjs.
 */
import { normalizeUsername, isValidUsernameFormat } from '../clinical-username.mjs';
import {
  persistClinicalUserBinding,
  isClinicalLocalOnlyMode,
  resolveClinicalClientId,
} from '../clinical-settings.mjs';
import { persistLanClientConfig } from './lan/transport.mjs';
import { isLanSkipShiftPin } from '../lan-shift-pin-bypass.mjs';

const RANKS = ['R1', 'R2', 'R3', 'R4', 'Admin'];

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

async function retryBootstrapWithUsername_(api, clientId, username, safeRank, settings) {
  var retry = await api.dbClinicalAccessBootstrap({
    clientId,
    rank: safeRank,
    preferredUsername: username,
    preferredUserId: String(settings.clinicalUserId || ''),
  });
  var userId = String(retry?.user?.userId || '');
  if (!retry?.ok || normalizeUsername(retry?.user?.username || '') !== username) {
    throw new Error('El usuario LAN ya está en uso.');
  }
  return userId;
}

async function claimUsernameIfMismatch_(api, clientId, userId, username, safeRank, settings) {
  var claimRes = await api.dbClinicalUsernameClaim({ userId, username });
  if (claimRes?.ok) return userId;
  var errMsg = String(claimRes?.error || '');
  if (!/ya está en uso/i.test(errMsg)) {
    throw new Error(errMsg || 'No se pudo registrar el usuario LAN.');
  }
  return retryBootstrapWithUsername_(api, clientId, username, safeRank, settings);
}

async function upsertClinicalProfile_(api, userId, name, safeRank, sala) {
  if (typeof api.dbClinicalProfileUpsert !== 'function') return;
  var profileRes = await api.dbClinicalProfileUpsert({
    userId,
    clinicalName: name,
    rank: safeRank,
    sala: sala || null,
  });
  if (!profileRes?.ok) {
    throw new Error(profileRes?.error || 'No se guardó el perfil clínico.');
  }
}

async function bootstrapClinicalUser_({ clientId, username, safeRank, settings, api, name, sala }) {
  var boot = await api.dbClinicalAccessBootstrap({
    clientId,
    rank: safeRank,
    preferredUserId: String(settings.clinicalUserId || ''),
    preferredUsername: username,
  });
  var userId = String(boot?.user?.userId || '');
  if (!userId || boot?.ok === false) {
    throw new Error(boot?.error || 'No se pudo iniciar la sesión clínica.');
  }
  var bootHandle = normalizeUsername(boot?.user?.username || '');
  if (bootHandle !== username && typeof api.dbClinicalUsernameClaim === 'function') {
    userId = await claimUsernameIfMismatch_(api, clientId, userId, username, safeRank, settings);
  }
  await upsertClinicalProfile_(api, userId, name, safeRank, sala);
  return userId;
}

function readRegistrationFormFields_() {
  return {
    usernameRaw: String(document.getElementById('clinical-reg-username')?.value || '').trim(),
    name: String(document.getElementById('clinical-reg-name')?.value || '').trim(),
    rank: String(document.getElementById('clinical-reg-rank')?.value || 'R1'),
    sala: String(document.getElementById('clinical-reg-sala')?.value || '').trim(),
    shiftPin: String(document.getElementById('clinical-reg-shift-pin')?.value || '').trim(),
  };
}

function validateRegistrationFields_(fields, errEl) {
  var username = normalizeUsername(fields.usernameRaw);
  if (!isValidUsernameFormat(username)) {
    if (errEl) {
      errEl.textContent =
        'Usuario LAN inválido. Usa 3–32 letras minúsculas (a-z, 0-9, _), p. ej. drmendoza — no tu nombre en guardia.';
      errEl.hidden = false;
    }
    return null;
  }
  if (!fields.name) {
    if (errEl) {
      errEl.textContent = 'Escribe tu nombre en guardia.';
      errEl.hidden = false;
    }
    return null;
  }
  return { username, safeRank: RANKS.includes(fields.rank) ? fields.rank : 'R1' };
}

async function connectShiftPinIfNeeded_(shiftPin, sala, _runtime) {
  if (isClinicalLocalOnlyMode()) return;
  if (isLanSkipShiftPin()) {
    var { tryEasyLanShiftPinConnect } = await import('../lan-shift-pin-connect.mjs');
    await tryEasyLanShiftPinConnect({ sala, force: true });
    return;
  }
  if (!shiftPin) return;
  var { connectLanWithShiftPin } = await import('../lan-shift-pin-connect.mjs');
  var connected = await connectLanWithShiftPin(shiftPin, { sala });
  if (!connected && typeof window.showToast === 'function') {
    window.showToast(
      'No se encontró anfitrión con ese PIN. Puedes intentarlo en ⇄ (Wi‑Fi) o Mi rotación → Conectar al turno.',
      'warning'
    );
  }
}

function readRpcSettingsFromStorage_() {
  try {
    return JSON.parse(localStorage.getItem('rpc-settings') || '{}');
  } catch {
    return {};
  }
}

function showRegistrationError_(errEl, message) {
  if (!errEl) return;
  errEl.textContent = message;
  errEl.hidden = false;
}

async function persistClinicalUserFromApi_(api, clientId, username, safeRank, settings, name, sala) {
  if (!api || typeof api.dbClinicalAccessBootstrap !== 'function') {
    return String(settings.clinicalUserId || '');
  }
  return bootstrapClinicalUser_({ clientId, username, safeRank, settings, api, name, sala });
}

function resolvePendingRegistration_(deps) {
  var pendingResolve = deps.getPendingResolve ? deps.getPendingResolve() : null;
  if (pendingResolve) {
    if (deps.setPendingResolve) deps.setPendingResolve(null);
    pendingResolve(true);
  }
  if (deps.onResolved) deps.onResolved(true);
}

function maybePersistMobilePairing_() {
  var params = new URLSearchParams(window.location.search);
  var host = params.get('host') || '';
  var code = params.get('code') || '';
  if (!host || !code) return;
  try {
    persistLanClientConfig(host, code);
  } catch (_e) { void _e; }
}

/**
 * @param {{
 *   runtime: { showToast: (msg: string, kind?: string) => void },
 *   closeModal: () => void,
 *   onResolved?: (ok: boolean) => void,
 *   getPendingResolve?: () => ((ok: boolean) => void) | null,
 *   setPendingResolve?: (fn: null) => void,
 * }} deps
 */
export async function handleClinicalRegistrationSubmit(deps) {
  var errEl = document.getElementById('clinical-reg-error');
  var fields = readRegistrationFormFields_();
  var validated = validateRegistrationFields_(fields, errEl);
  if (!validated) return;

  var username = validated.username;
  var safeRank = validated.safeRank;
  var name = fields.name;
  var sala = fields.sala;
  var settings = readRpcSettingsFromStorage_();
  var clientId = resolveClinicalClientId(settings);
  if (!clientId) {
    showRegistrationError_(errEl, 'No se encontró el identificador del dispositivo. Reinicia R+.');
    return;
  }
  if (!settings.clientId) {
    persistClinicalUserBinding({ userId: String(settings.clinicalUserId || '') });
    settings = readRpcSettingsFromStorage_();
  }

  var {
    assertLanRoomForUsernameRegister,
    flushClinicalProfileToLan,
    LAN_PROFILE_PUSH_FAILED_MSG,
    isBenignLanPushSkipCode,
    notifyLanProfilePushResult,
  } = await import('../clinical-profile-lan-sync.mjs');
  var lanRoom = await assertLanRoomForUsernameRegister({ sala });

  try {
    var savedUserId = await persistClinicalUserFromApi_(
      dbApi(),
      clientId,
      username,
      safeRank,
      settings,
      name,
      sala
    );
    persistClinicalUserBinding({
      userId: savedUserId,
      username,
      displayName: name,
      rank: safeRank,
      sala: sala || '',
      registered: true,
      lanProfileGateComplete: true,
    });
  } catch (err) {
    showRegistrationError_(errEl, err?.message || 'Error al guardar el registro.');
    return;
  }

  if (errEl) errEl.hidden = true;

  const { refreshClinicalUserProfile } = await import('../clinical-access-runtime.mjs');
  await refreshClinicalUserProfile();

  deps.closeModal();
  maybePersistMobilePairing_();
  resolvePendingRegistration_(deps);

  try {
    const { refreshMainClinicalOnboardingIfNeeded } = await import('./clinical-onboarding-main.mjs');
    await refreshMainClinicalOnboardingIfNeeded();
  } catch {
    /* onboarding shell optional */
  }

  void (async () => {
    await connectShiftPinIfNeeded_(fields.shiftPin, sala, deps.runtime);
    var lanPush = await flushClinicalProfileToLan({ sala, roomId: lanRoom.roomId });
    notifyLanProfilePushResult(lanPush, (msg, kind) => deps.runtime.showToast(msg, kind));
    if (
      !lanPush.ok &&
      !isBenignLanPushSkipCode(lanPush.code) &&
      !(lanPush.channels && lanPush.channels.outbox)
    ) {
      deps.runtime.showToast(LAN_PROFILE_PUSH_FAILED_MSG, 'warning');
    }
  })();
}
