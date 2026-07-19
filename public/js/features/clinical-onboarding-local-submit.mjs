import { clinicalSessionContext, refreshClinicalUserProfile } from '../clinical-access-runtime.mjs';
import { persistClinicalUserBinding, setClinicalSyncModeLocalOnly } from '../clinical-settings.mjs';
import { normalizeUsername } from '../clinical-username.mjs';
import { localOnlyUsernameForUserId } from './clinical-onboarding-sync-mode.mjs';

/** Default signature for notes when local-only skips the profile step. */
export const DEFAULT_LOCAL_ONLY_DISPLAY_NAME = 'Usuario R+';

/** @param {{ clinical_name?: string|null }|null|undefined} [user] */
export function defaultLocalOnlyDisplayName(user = clinicalSessionContext.user) {
  const existing = String(user?.clinical_name || '').trim();
  return existing || DEFAULT_LOCAL_ONLY_DISPLAY_NAME;
}

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function showLocalOnlyError(errEl, msg) {
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.hidden = false;
}

/** @param {string} sessionUserId @param {string} localHandle */
function applyClaimToSession(localHandle) {
  if (clinicalSessionContext.user) {
    clinicalSessionContext.user.username = localHandle;
  }
}

/** @param {string} sessionUserId @param {string} localHandle */
export async function claimLocalOnlyUsername(sessionUserId, localHandle) {
  const currentHandle = normalizeUsername(clinicalSessionContext.user?.username || '');
  if (currentHandle === localHandle) return { ok: true };
  const api = dbApi();
  if (!api || typeof api.dbClinicalUsernameClaim !== 'function') return { ok: true };
  const claimRes = await api.dbClinicalUsernameClaim({ userId: sessionUserId, username: localHandle });
  const claimFailed = !claimRes?.ok && !/ya está en uso/i.test(String(claimRes?.error || ''));
  if (claimFailed) {
    return { ok: false, error: claimRes?.error || 'No se pudo guardar el perfil local.' };
  }
  if (claimRes?.ok) applyClaimToSession(localHandle);
  return { ok: true };
}

/** @param {string} sessionUserId @param {string} name @param {string} rank */
export async function upsertLocalOnlyProfile(sessionUserId, name, rank) {
  const api = dbApi();
  if (!api || typeof api.dbClinicalProfileUpsert !== 'function') return { ok: true };
  const profileRes = await api.dbClinicalProfileUpsert({
    userId: sessionUserId,
    clinicalName: name,
    rank,
    sala: null,
    isProgramAdmin: false,
  });
  if (!profileRes?.ok) {
    return { ok: false, error: profileRes?.error || 'No se guardó el perfil.' };
  }
  if (clinicalSessionContext.user) {
    clinicalSessionContext.user.rank = rank;
    clinicalSessionContext.user.clinical_name = name;
    clinicalSessionContext.user.sala = null;
    clinicalSessionContext.user.is_program_admin = 0;
  }
  return { ok: true };
}

/** @param {string} sessionUserId @param {string} localHandle @param {string} name @param {string} rank */
export function persistLocalOnlyBinding(sessionUserId, localHandle, name, rank) {
  persistClinicalUserBinding({
    userId: sessionUserId,
    username: localHandle,
    displayName: name,
    rank,
    sala: '',
    registered: true,
    lanProfileGateComplete: true,
    isProgramAdmin: false,
  });
  setClinicalSyncModeLocalOnly(true);
}

/** @param {string} name @param {string} rank @param {HTMLElement|null} errEl */
export async function submitLocalOnlyProfile(name, rank, errEl) {
  const api = dbApi();
  const sessionUserId = String(clinicalSessionContext.user?.user_id || '');
  if (!sessionUserId || !api) return { ok: false, error: 'Sesión clínica no disponible.' };

  const localHandle = localOnlyUsernameForUserId(sessionUserId);
  const claim = await claimLocalOnlyUsername(sessionUserId, localHandle);
  if (!claim.ok) {
    showLocalOnlyError(errEl, claim.error || 'No se pudo guardar el perfil local.');
    return { ok: false };
  }

  const profile = await upsertLocalOnlyProfile(sessionUserId, name, rank);
  if (!profile.ok) {
    showLocalOnlyError(errEl, profile.error || 'No se guardó el perfil.');
    return { ok: false };
  }

  persistLocalOnlyBinding(sessionUserId, localHandle, name, rank);
  if (errEl) errEl.hidden = true;
  await refreshClinicalUserProfile();
  return { ok: true };
}
