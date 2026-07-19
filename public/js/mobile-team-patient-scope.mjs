/**
 * iPad/PWA: mirror only patients explicitly assigned to one of the user's joined teams
 * (plus active guardia handoffs). Ignores rank, sala-wide, and structural team slices.
 */
import {
  getJoinedTeams,
  getJoinedTeamsForUser,
  resolvePatientTeamIdFromAssignments,
  isActiveGuardiaCoveringUser,
  patientCoveredByGuardia,
} from './clinico-access.mjs';

/** @param {object[]} teams @param {string|object|null|undefined} userOrUserId */
export function joinedTeamIdsForUser(teams, userOrUserId) {
  const ids = new Set();
  const joined =
    typeof userOrUserId === 'string'
      ? getJoinedTeams(teams || [], userOrUserId)
      : getJoinedTeamsForUser(teams || [], userOrUserId || '');
  for (const team of joined) {
    const tid = String(team?.team_id || '').trim();
    if (tid) ids.add(tid);
  }
  return ids;
}

/**
 * @param {string} patientId
 * @param {object|null|undefined} scopeContext
 * @param {string} userId
 */
export function isPatientAssignedToJoinedTeam(patientId, scopeContext, userId) {
  const joinedIds = joinedTeamIdsForUser(scopeContext?.teams, userId);
  if (!joinedIds.size) return false;
  const now = scopeContext?.now || new Date().toISOString();
  const teamId = resolvePatientTeamIdFromAssignments(
    patientId,
    scopeContext?.assignments || [],
    now
  );
  return !!(teamId && joinedIds.has(teamId));
}

/**
 * @param {object|null|undefined} user
 * @param {{ id?: string }} patient
 * @param {object|null|undefined} scopeContext
 * @param {object|null|undefined} activeGuardia
 */
export function isPatientVisibleOnMobileTeamMirror(user, patient, scopeContext, activeGuardia) {
  if (!user?.user_id || !patient?.id) return false;
  const pid = String(patient.id);
  const userId = String(user.user_id);
  if (isPatientAssignedToJoinedTeam(pid, scopeContext, userId)) return true;
  if (activeGuardia && isActiveGuardiaCoveringUser(userId, activeGuardia)) return true;
  const guardias = Array.isArray(scopeContext?.guardias) ? scopeContext.guardias : [];
  return patientCoveredByGuardia(pid, userId, guardias);
}

/**
 * @param {object[]} patients
 * @param {object|null|undefined} user
 * @param {object|null|undefined} scopeContext
 * @param {Map<string, object>|null|undefined} guardiasMap
 */
export function filterPatientsForMobileTeamMirror(patients, user, scopeContext, guardiasMap) {
  if (!user?.user_id) return [];
  return (patients || []).filter((p) => {
    if (!p?.id) return false;
    const activeGuardia =
      guardiasMap && typeof guardiasMap.get === 'function'
        ? guardiasMap.get(String(p.id)) || null
        : null;
    return isPatientVisibleOnMobileTeamMirror(user, p, scopeContext, activeGuardia);
  });
}
