import { isDbMode } from '../db-storage-bridge.mjs';
import {
  isValidUsernameFormat,
  normalizeUsername,
} from '../clinical-username.mjs';
import { readRpcSettings } from '../clinical-settings.mjs';
import { electronApi } from './electron-api.mjs';
import { applyBootstrapResult } from './bootstrap-apply.mjs';
import { resolveClinicalRank } from './bootstrap-rank.mjs';
import {
  resumeClinicalIdentityViaBootstrapApi,
  resumeClinicalIdentityViaResumeApi,
} from './bootstrap-resume.mjs';

export { resolveClinicalRank } from './bootstrap-rank.mjs';

export async function bootstrapClinicalAccess(settings, clientId) {
  if (!isDbMode()) return false;
  const api = electronApi();
  if (!api || typeof api.dbClinicalAccessBootstrap !== 'function') return false;

  const stored = settings || readRpcSettings();
  const res = await api.dbClinicalAccessBootstrap({
    clientId,
    rank: resolveClinicalRank(stored, clientId),
    preferredUserId: String(stored.clinicalUserId || ''),
    preferredUsername: String(stored.clinicalUsername || ''),
  });
  if (!res || res.ok === false) return false;

  await applyBootstrapResult(res);
  return true;
}

/**
 * Resolve a LAN @usuario row in the local DB (exact handle; no device bootstrap).
 * @returns {Promise<{ user_id: string, username?: string }|null>}
 */
export async function lookupClinicalUserByUsername(username) {
  if (!isDbMode()) return null;
  const api = electronApi();
  const handle = normalizeUsername(username);
  if (!api || typeof api.dbClinicalUserLookup !== 'function' || !isValidUsernameFormat(handle)) {
    return null;
  }
  try {
    const res = await api.dbClinicalUserLookup({ username: handle });
    if (!res?.ok || !res.user?.user_id) return null;
    return res.user;
  } catch {
    return null;
  }
}

/**
 * Reattach this device to an existing LAN username already stored in the DB.
 * @returns {Promise<{ ok: boolean, error?: string, userId?: string }>}
 */
export async function resumeClinicalIdentityByUsername(username, settings, clientId) {
  void clientId;
  if (!isDbMode()) return { ok: false, error: 'Base de datos no activa.' };
  const api = electronApi();
  const handle = normalizeUsername(username);
  if (!api) {
    return { ok: false, error: 'Sesión clínica no disponible.' };
  }
  const stored = settings || readRpcSettings();

  if (typeof api.dbClinicalIdentityResume === 'function') {
    return resumeClinicalIdentityViaResumeApi(api, handle, stored);
  }
  if (typeof api.dbClinicalAccessBootstrap !== 'function') {
    return { ok: false, error: 'Sesión clínica no disponible.' };
  }
  return resumeClinicalIdentityViaBootstrapApi(api, handle, stored);
}
