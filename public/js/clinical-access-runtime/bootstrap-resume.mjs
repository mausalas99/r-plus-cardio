import { normalizeUsername } from '../clinical-username.mjs';
import { persistClinicalUserBinding } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { applyBootstrapResult } from './bootstrap-apply.mjs';
import { resolveClinicalRank } from './bootstrap-rank.mjs';
import { fetchClinicalTeamsFromDb } from './scope-db.mjs';

/**
 * @param {object} api
 * @param {string} handle
 * @param {Record<string, unknown>} stored
 */
export async function resumeClinicalIdentityViaResumeApi(api, handle, stored) {
  const previousUserId = String(clinicalSessionContext.user?.user_id || '');
  const staleFromSettings = String(stored.clinicalStaleDeviceUserId || '');
  const fromUserId =
    previousUserId && previousUserId !== String(stored.clinicalUserId || '')
      ? previousUserId
      : staleFromSettings || previousUserId;
  const res = await api.dbClinicalIdentityResume({
    username: handle,
    fromUserId,
  });
  if (!res || res.ok === false) {
    return { ok: false, error: res?.error || 'No se pudo recuperar la cuenta.' };
  }
  await applyBootstrapResult(res);
  persistClinicalUserBinding({
    userId: res.user.userId,
    username: res.user.username,
  });
  if (Number(res.membershipMoved) > 0) {
    await fetchClinicalTeamsFromDb();
  }
  return { ok: true, userId: res.user.userId, membershipMoved: res.membershipMoved };
}

/**
 * @param {object} api
 * @param {string} handle
 * @param {Record<string, unknown>} stored
 */
export async function resumeClinicalIdentityViaBootstrapApi(api, handle, stored) {
  const res = await api.dbClinicalAccessBootstrap({
    clientId: String(stored.clientId || ''),
    rank: resolveClinicalRank(stored, String(stored.clientId || '')),
    preferredUsername: handle,
    preferredUserId: '',
  });
  if (!res || res.ok === false) {
    return { ok: false, error: res?.error || 'No se pudo recuperar la cuenta.' };
  }
  if (normalizeUsername(res.user.username) !== handle) {
    return {
      ok: false,
      error: 'No encontramos ese usuario en esta base de datos.',
    };
  }
  await applyBootstrapResult(res);
  return { ok: true, userId: res.user.userId };
}
