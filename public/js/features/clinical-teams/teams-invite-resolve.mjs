import {
  clinicalSessionContext,
  fetchClinicalTeamsFromDb,
} from '../../clinical-access-runtime.mjs';
import {
  normalizeTeamInviteCode,
  resolveTeamIdFromInviteCode,
} from '../../clinical-team-invite.mjs';
import { dbApi } from './shared.mjs';

/** @param {string} raw */
export function resolveTeamIdFromLocalTeams(raw) {
  if (raw.includes('-') && raw.length > 20) return raw;
  return resolveTeamIdFromInviteCode(raw, clinicalSessionContext.teams || []);
}

export async function resolveTeamIdFromLanDirectory(raw) {
  try {
    const lan = await import('../lan-sync.mjs');
    if (typeof lan.refreshLanClinicalDirectoryFromRoom !== 'function') return '';
    await lan.refreshLanClinicalDirectoryFromRoom({ timeoutMs: 8000 });
    await fetchClinicalTeamsFromDb();
    return resolveTeamIdFromInviteCode(raw, clinicalSessionContext.teams || []);
  } catch {
    return '';
  }
}

/** @param {string} raw */
export async function resolveTeamIdFromDbCode(raw) {
  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamResolveCode !== 'function') return '';
  const res = await api.dbClinicalTeamResolveCode({ code: normalizeTeamInviteCode(raw) });
  if (!res?.ok || !res.team?.team_id) return '';
  await fetchClinicalTeamsFromDb();
  return String(res.team.team_id);
}

/** @param {string} codeOrId */
export async function resolveTeamIdForInviteInput(codeOrId) {
  const raw = String(codeOrId || '').trim();
  if (!raw) return '';
  await fetchClinicalTeamsFromDb();
  let teamId = resolveTeamIdFromLocalTeams(raw);
  if (!teamId) teamId = await resolveTeamIdFromLanDirectory(raw);
  if (!teamId) teamId = await resolveTeamIdFromDbCode(raw);
  return teamId;
}
