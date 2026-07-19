/**
 * Clinical onboarding form handlers.
 */
import {
  clinicalSessionContext,
  lookupClinicalUserByUsername,
  refreshClinicalUserProfile,
  resumeClinicalIdentityByUsername,
} from '../clinical-access-runtime.mjs';
import {
  isClinicalLocalOnlyMode,
  persistClinicalUserBinding,
  readRpcSettings,
} from '../clinical-settings.mjs';
import {
  isValidUsernameFormat,
  normalizeUsername,
  shouldClaimClinicalUsername,
} from '../clinical-username.mjs';
import { getClientId, needsProfileOnboarding } from './clinical-onboarding-gates.mjs';
import { wireSyncModeOnboardingInteractions } from './clinical-onboarding-sync-mode.mjs';
import { isLanSkipShiftPin } from '../lan-shift-pin-bypass.mjs';

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

function readUsernameFormFields() {
  return {
    username: normalizeUsername(String(document.getElementById('onboard-username')?.value || '')),
    name: String(document.getElementById('onboard-clinical-name')?.value || '').trim(),
    rank: String(document.getElementById('onboard-rank')?.value || 'R1'),
    sala: String(document.getElementById('onboard-sala')?.value || '').trim(),
    shiftPin: String(document.getElementById('onboard-shift-pin')?.value || '').trim(),
  };
}

function showOnboardError(errEl, message) {
  if (!errEl) return;
  errEl.textContent = message;
  errEl.hidden = false;
}

function validateUsernameForm(fields, errEl) {
  if (!isValidUsernameFormat(fields.username)) {
    showOnboardError(
      errEl,
      'Usuario LAN inválido. Usa 3–32 letras minúsculas (a-z, 0-9, _), p. ej. drmendoza — no tu nombre en guardia.'
    );
    return false;
  }
  if (!fields.name) {
    showOnboardError(errEl, 'Escribe tu nombre en guardia.');
    return false;
  }
  if (!fields.sala) {
    showOnboardError(errEl, 'Selecciona tu rotación.');
    return false;
  }
  return true;
}

async function tryResumeExistingUsername(username, settings, errEl, errMsg) {
  // Electron renderer cannot use window.confirm; Guardar perfil / Recuperar already express intent.
  const resumeRes = await resumeClinicalIdentityByUsername(username, settings, getClientId());
  if (!resumeRes.ok) {
    showOnboardError(errEl, resumeRes.error || errMsg);
    return { ok: false };
  }
  return { ok: true, settings: readRpcSettings(), sessionUserId: String(clinicalSessionContext.user?.user_id || '') };
}

async function claimUsernameIfNeeded(api, sessionUserId, username, sala, settings, errEl) {
  const currentHandle = normalizeUsername(clinicalSessionContext.user?.username || '');
  const needsClaim = shouldClaimClinicalUsername(currentHandle, username, getClientId());
  if (!needsClaim) return { ok: true, needsClaim: false, sessionUserId, settings };

  const { assertLanRoomForUsernameRegister } = await import('../clinical-profile-lan-sync.mjs');
  await assertLanRoomForUsernameRegister({ sala });

  if (typeof api.dbClinicalUsernameClaim !== 'function') {
    return { ok: true, needsClaim: false, sessionUserId, settings };
  }

  const claimRes = await api.dbClinicalUsernameClaim({ userId: sessionUserId, username });
  if (claimRes?.ok) {
    if (clinicalSessionContext.user) clinicalSessionContext.user.username = username;
    return { ok: true, needsClaim: true, sessionUserId, settings };
  }

  const errMsg = String(claimRes?.error || '');
  if (/ya está en uso/i.test(errMsg)) {
    const resumed = await tryResumeExistingUsername(username, settings, errEl, errMsg);
    if (!resumed.ok) return { ok: false, needsClaim: false, sessionUserId, settings };
    return {
      ok: true,
      needsClaim: false,
      sessionUserId: resumed.sessionUserId,
      settings: resumed.settings,
    };
  }

  showOnboardError(errEl, errMsg || 'No se pudo registrar el usuario.');
  return { ok: false, needsClaim: false, sessionUserId, settings };
}

async function upsertClinicalProfile(api, sessionUserId, fields, errEl) {
  if (typeof api.dbClinicalProfileUpsert !== 'function') return true;
  const profileRes = await api.dbClinicalProfileUpsert({
    userId: sessionUserId,
    clinicalName: fields.name,
    rank: fields.rank,
    sala: fields.sala || null,
    isProgramAdmin: false,
  });
  if (!profileRes?.ok) {
    showOnboardError(errEl, profileRes?.error || 'No se guardó el perfil.');
    return false;
  }
  if (clinicalSessionContext.user) {
    clinicalSessionContext.user.rank = fields.rank;
    clinicalSessionContext.user.clinical_name = fields.name;
    clinicalSessionContext.user.sala = fields.sala || null;
    clinicalSessionContext.user.is_program_admin = 0;
  }
  return true;
}

async function connectShiftPinIfProvided(shiftPin, sala) {
  if (isClinicalLocalOnlyMode()) return;
  if (isLanSkipShiftPin()) {
    const { tryEasyLanShiftPinConnect } = await import('../lan-shift-pin-connect.mjs');
    await tryEasyLanShiftPinConnect({ sala, force: true });
    return;
  }
  if (!shiftPin) return;
  const { connectLanWithShiftPin } = await import('../lan-shift-pin-connect.mjs');
  const connected = await connectLanWithShiftPin(shiftPin, { sala });
  if (!connected) {
    toast(
      'No se encontró anfitrión con ese PIN del turno. Revisa Wi‑Fi o pide un PIN nuevo al R4.',
      'warning'
    );
  }
}

async function pushProfileToLanAndNotify(sala, needsClaim) {
  const {
    flushClinicalProfileToLan,
    LAN_PROFILE_PUSH_FAILED_MSG,
    LAN_PROFILE_NEEDS_CONNECT_MSG,
    isBenignLanPushSkipCode,
    isLanProfileNeedsConnectCode,
    notifyLanProfilePushResult,
  } = await import('../clinical-profile-lan-sync.mjs');
  const lanPush = await flushClinicalProfileToLan({
    sala: sala || clinicalSessionContext.user?.sala,
  });
  notifyLanProfilePushResult(lanPush, toast);

  const localOnly = isClinicalLocalOnlyMode();
  if (!localOnly && !lanPush.ok && isLanProfileNeedsConnectCode(lanPush.code)) {
    toast(LAN_PROFILE_NEEDS_CONNECT_MSG, 'info');
    const rot = await import('./clinical-rotation-entry.mjs');
    rot.syncClinicalRotationEntryChrome();
    return;
  }

  if (
    !lanPush.ok &&
    !isBenignLanPushSkipCode(lanPush.code) &&
    !(lanPush.channels && lanPush.channels.outbox)
  ) {
    toast(LAN_PROFILE_PUSH_FAILED_MSG, 'warning');
  } else if (lanPush.ok && needsClaim) {
    toast('@usuario publicado en la sala ⇄.', 'success');
  }
}

async function finishRegistrationLanSideEffects(fields, needsClaim) {
  try {
    await connectShiftPinIfProvided(fields.shiftPin, fields.sala);
    await pushProfileToLanAndNotify(fields.sala, needsClaim);
  } catch {
    /* LAN connect/push are best-effort after profile save */
  }
}

export async function handleUsernameStepSubmit(ev) {
  ev.preventDefault();
  const fields = readUsernameFormFields();
  const errEl = document.getElementById('onboard-error');
  if (!validateUsernameForm(fields, errEl)) return;

  let settings = readRpcSettings();
  let sessionUserId = String(clinicalSessionContext.user?.user_id || '');
  const api = dbApi();
  if (!sessionUserId || !api) {
    toast('Sesión clínica no disponible.', 'error');
    return;
  }

  try {
    const claimResult = await claimUsernameIfNeeded(
      api,
      sessionUserId,
      fields.username,
      fields.sala,
      settings,
      errEl
    );
    if (!claimResult.ok) return;
    sessionUserId = claimResult.sessionUserId;
    settings = claimResult.settings;

    const saved = await upsertClinicalProfile(api, sessionUserId, fields, errEl);
    if (!saved) return;

    persistClinicalUserBinding({
      userId: sessionUserId,
      username: fields.username,
      displayName: fields.name,
      rank: fields.rank,
      sala: fields.sala || '',
      registered: true,
      lanProfileGateComplete: true,
      isProgramAdmin: false,
    });

    if (errEl) errEl.hidden = true;
    await refreshClinicalUserProfile();
    document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));

    const { refreshMainClinicalOnboardingIfNeeded } = await import('./clinical-onboarding-main.mjs');
    await refreshMainClinicalOnboardingIfNeeded();
    toast('Perfil guardado.', 'success');

    void finishRegistrationLanSideEffects(fields, claimResult.needsClaim);
  } catch (err) {
    showOnboardError(errEl, err instanceof Error ? err.message : 'Error al guardar el perfil.');
  }
}

function applyResumedProfileToSession(name, rank, sala) {
  if (!clinicalSessionContext.user) return;
  clinicalSessionContext.user.rank = rank;
  clinicalSessionContext.user.clinical_name = name;
  clinicalSessionContext.user.sala = sala;
  clinicalSessionContext.user.is_program_admin = 0;
}

function readResumedFormFields() {
  return {
    name: String(document.getElementById('onboard-clinical-name')?.value || '').trim(),
    rank: String(document.getElementById('onboard-rank')?.value || 'R1'),
    sala: String(document.getElementById('onboard-sala')?.value || '').trim(),
  };
}

async function saveResumedProfileIfComplete(api, sessionUserId, username, errEl) {
  const fields = readResumedFormFields();
  if (!sessionUserId || !fields.name || !fields.sala) return true;
  if (!api?.dbClinicalProfileUpsert) return true;

  const profileRes = await api.dbClinicalProfileUpsert({
    userId: sessionUserId,
    clinicalName: fields.name,
    rank: fields.rank,
    sala: fields.sala,
    isProgramAdmin: false,
  });
  if (!profileRes?.ok) {
    showOnboardError(errEl, profileRes?.error || 'No se guardó el perfil.');
    return false;
  }

  applyResumedProfileToSession(fields.name, fields.rank, fields.sala);
  persistClinicalUserBinding({
    userId: sessionUserId,
    username,
    displayName: fields.name,
    rank: fields.rank,
    sala: fields.sala,
    registered: true,
    lanProfileGateComplete: true,
    isProgramAdmin: false,
  });
  await refreshClinicalUserProfile();
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  return true;
}

export async function handleResumeIdentityClick() {
  const username = normalizeUsername(String(document.getElementById('onboard-username')?.value || ''));
  const errEl = document.getElementById('onboard-error');
  const resumeBtn = document.getElementById('clinical-onboard-resume-btn');
  if (!isValidUsernameFormat(username)) {
    showOnboardError(errEl, 'Escribe tu usuario LAN para recuperarlo.');
    return;
  }
  const existing = await lookupClinicalUserByUsername(username);
  if (!existing?.user_id) {
    showOnboardError(
      errEl,
      `No encontramos @${username} en esta base de datos. Para registrarte, completa el formulario y pulsa Guardar perfil.`
    );
    return;
  }
  if (resumeBtn instanceof HTMLButtonElement) {
    resumeBtn.disabled = true;
    resumeBtn.textContent = 'Recuperando…';
  }
  const settings = readRpcSettings();
  try {
    const resumeRes = await resumeClinicalIdentityByUsername(username, settings, getClientId());
    if (!resumeRes.ok) {
      showOnboardError(errEl, resumeRes.error || 'No se pudo recuperar la cuenta.');
      return;
    }
    if (errEl) errEl.hidden = true;
    toast('Cuenta recuperada.', 'success');
    await refreshClinicalUserProfile();
    const sessionUserId = String(clinicalSessionContext.user?.user_id || '');
    const api = dbApi();
    const saved = await saveResumedProfileIfComplete(api, sessionUserId, username, errEl);
    if (!saved) return;
    const { refreshMainClinicalOnboardingIfNeeded } = await import('./clinical-onboarding-main.mjs');
    await refreshMainClinicalOnboardingIfNeeded();
    if (needsProfileOnboarding()) {
      toast('Completa tu perfil y pulsa Guardar perfil.', 'info');
    }
  } finally {
    if (resumeBtn instanceof HTMLButtonElement) {
      resumeBtn.disabled = false;
      resumeBtn.textContent = 'Recuperar mi usuario';
    }
  }
}

export async function wireOnboardingInteractions() {
  wireSyncModeOnboardingInteractions();

  const form = document.getElementById('clinical-onboard-username-form');
  if (form && !form._rpcOnboardWired) {
    form._rpcOnboardWired = true;
    form.addEventListener('submit', (ev) => void handleUsernameStepSubmit(ev));
  }

  const resumeBtn = document.getElementById('clinical-onboard-resume-btn');
  if (resumeBtn && !resumeBtn._rpcResumeWired) {
    resumeBtn._rpcResumeWired = true;
    resumeBtn.addEventListener('click', () => void handleResumeIdentityClick());
  }
}
