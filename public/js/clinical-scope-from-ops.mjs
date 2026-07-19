/**
 * Build renderer scope context from LAN clinicalOps snapshots (iPad/PWA — no SQLCipher).
 */
import { normalizeUsername } from './clinical-username.mjs';
import { buildTeamsWithMembers } from './clinical-scope-teams.mjs';

function activeRotationCycle(snapshot) {
  const rows = (snapshot?.rotation_cycles || []).filter((row) => !row?.archived_at);
  if (!rows.length) return null;
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return rows[0];
}

function activeGuardiasFromSnapshot(snapshot) {
  const resolved = new Set(
    (snapshot?.active_guardias_resolved || []).map((row) => String(row?.guardia_id || ''))
  );
  return (snapshot?.active_guardias || []).filter((row) => {
    const guardiaId = String(row?.guardia_id || '');
    if (!guardiaId || resolved.has(guardiaId)) return false;
    return String(row?.status || 'Active') === 'Active';
  });
}

/**
 * @param {object|null|undefined} snapshot
 * @param {{ userId?: string, username?: string }} hints
 */
export function resolveClinicalUserRowFromOpsSnapshot(snapshot, hints = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const users = snapshot.clinical_users || [];
  const deleted = new Set((snapshot.clinical_users_deleted || []).map((id) => String(id)));
  const uid = String(hints.userId || '').trim();
  const uname = normalizeUsername(String(hints.username || '').replace(/^@/, ''));

  if (uid && !deleted.has(uid)) {
    const byId = users.find((row) => String(row?.user_id || '') === uid);
    if (byId) return byId;
  }
  if (uname) {
    const byUsername = users.find((row) => {
      const id = String(row?.user_id || '');
      if (!id || deleted.has(id)) return false;
      return normalizeUsername(row?.username) === uname;
    });
    if (byUsername) return byUsername;
  }
  if (uid) {
    const uidAsUsername = users.find((row) => {
      const id = String(row?.user_id || '');
      if (!id || deleted.has(id)) return false;
      return normalizeUsername(row?.username) === normalizeUsername(uid);
    });
    if (uidAsUsername) return uidAsUsername;
  }
  return null;
}

/**
 * @param {object|null|undefined} snapshot
 * @param {{ guardiaMode?: boolean, entregaPhaseActive?: boolean, enforceTeamPatientScope?: boolean, now?: string }} [options]
 */
export function buildClinicalScopeContextFromOpsSnapshot(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const deleted = new Set((snapshot.clinical_users_deleted || []).map((id) => String(id)));
  const users = (snapshot.clinical_users || []).filter((row) => {
    const id = String(row?.user_id || '');
    return id && !deleted.has(id);
  });
  return {
    teams: buildTeamsWithMembers(snapshot),
    guardias: activeGuardiasFromSnapshot(snapshot),
    cycle: activeRotationCycle(snapshot),
    assignments: Array.isArray(snapshot.patient_team_assignment)
      ? snapshot.patient_team_assignment.slice()
      : [],
    salaGuardiaToday: Array.isArray(snapshot.team_guardia_today)
      ? snapshot.team_guardia_today.slice()
      : [],
    users,
    guardiaMode: !!options.guardiaMode,
    entregaPhaseActive: !!options.entregaPhaseActive,
    enforceTeamPatientScope: !!options.enforceTeamPatientScope,
    now: options.now || new Date().toISOString(),
  };
}
