import { normalizeUsername } from '../../clinical-username.mjs';
import { resolvePatientTeamIdFromAssignments } from '../../clinico-access.mjs';

/** @param {Array<object>} users */
export function indexClinicalUsers(users) {
  const usersById = new Map();
  const usersByUsername = new Map();
  for (const row of users || []) {
    const id = String(row?.user_id || '').trim();
    if (id) usersById.set(id, row);
    const handle = String(row?.username || '').trim();
    if (handle) usersByUsername.set(handle, row);
    const normalized = normalizeUsername(handle);
    if (normalized && normalized !== handle) usersByUsername.set(normalized, row);
  }
  return { usersById, usersByUsername };
}

/** @param {Array<object>} teams */
export function indexClinicalTeams(teams) {
  const teamsById = new Map();
  for (const row of teams || []) {
    const id = String(row?.team_id || '').trim();
    if (id) teamsById.set(id, row);
  }
  return teamsById;
}

/** @param {object|null|undefined} clinicalOps */
function indexGuardiaMaps(clinicalOps) {
  const guardiaByTeamId = new Map();
  for (const row of clinicalOps?.team_guardia_today || []) {
    const tid = String(row?.team_id || '').trim();
    if (tid) guardiaByTeamId.set(tid, row);
  }
  const guardiaByPatientId = new Map();
  for (const row of clinicalOps?.active_guardias || []) {
    const pid = String(row?.patient_id || '').trim();
    if (pid) guardiaByPatientId.set(pid, row);
  }
  return { guardiaByTeamId, guardiaByPatientId };
}

export function buildClinicalOpsLookups(clinicalOps) {
  const userMaps = indexClinicalUsers(clinicalOps?.clinical_users || []);
  const teamsById = indexClinicalTeams(clinicalOps?.teams || []);
  const { guardiaByTeamId, guardiaByPatientId } = indexGuardiaMaps(clinicalOps);
  return {
    usersById: userMaps.usersById,
    usersByUsername: userMaps.usersByUsername,
    teamsById,
    assignments: clinicalOps?.patient_team_assignment || [],
    guardiaByTeamId,
    guardiaByPatientId,
  };
}

function resolveRegistrarFromTeam(pid, lookups) {
  const teamId = resolvePatientTeamIdFromAssignments(pid, lookups.assignments);
  if (!teamId) return '';
  const onCall = lookups.guardiaByTeamId.get(teamId);
  if (onCall?.user_id) return String(onCall.user_id);
  const team = lookups.teamsById.get(teamId);
  if (team?.leader_user_id) return String(team.leader_user_id);
  if (team?.created_by) return String(team.created_by);
  return '';
}

function findPatientCreateAuditEntry(row) {
  const audit = Array.isArray(row?.audit_log) ? row.audit_log : [];
  return audit.find(function (e) { return e && e.action === 'patient.create'; }) || audit[0];
}

function resolveRegistrarFromLocalSession(createClientId, opts) {
  const localClientId = String(opts?.localClientId || '').trim();
  const localUser = opts?.localUser || null;
  if (createClientId && localClientId && createClientId === localClientId && localUser?.user_id) {
    return String(localUser.user_id);
  }
  return '';
}

function resolveRegistrarFromGuardia(pid, lookups, resolveUserIdFromLanClientId, createClientId) {
  const fromClientId = resolveUserIdFromLanClientId(createClientId, lookups);
  if (fromClientId) return fromClientId;
  const active = lookups.guardiaByPatientId.get(pid);
  if (active?.covering_user_id) return String(active.covering_user_id);
  return resolveRegistrarFromTeam(pid, lookups);
}

export function resolveRegistrarFromAudit(row, lookups, opts, resolveUserIdFromLanClientId) {
  const pid = String(row?.id || '').trim();
  const createClientId = String(findPatientCreateAuditEntry(row)?.clientId || '').trim();
  const fromLocal = resolveRegistrarFromLocalSession(createClientId, opts);
  if (fromLocal) return fromLocal;
  return resolveRegistrarFromGuardia(pid, lookups, resolveUserIdFromLanClientId, createClientId);
}
