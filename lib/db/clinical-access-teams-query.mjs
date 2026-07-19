import { normalizeUsername } from './clinical-username.mjs';
import { listClinicalUsers } from './clinical-access-users.mjs';
import { fetchActiveGuardias } from './clinical-access-guardia.mjs';
import { fetchPatientTeamAssignments } from './clinical-access-assignments.mjs';
import { getActiveRotationCycle } from './clinical-access-rotation.mjs';
import {
  buildActivePatientCountByTeam,
  buildLanAssignmentCountByTeam,
} from './clinical-access-assignments.mjs';
import {
  effectiveTeamSala,
  listActiveTeams,
  listTeamMembers,
  withEffectiveTeamSala,
} from './clinical-access-teams-core.mjs';
import {
  getSalaTeamMembershipWarnings,
  getTeamGuardiaToday,
  validateSalaTeamMembership,
} from './clinical-access-teams-membership.mjs';
export function resolveTeamByInviteCode(db, code) {
  const norm = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '');
  if (norm.length < 6) return null;
  const matches = listActiveTeams(db).filter((team) => {
    const id = String(team.team_id || '')
      .replace(/-/g, '')
      .toLowerCase();
    return id === norm || id.startsWith(norm);
  });
  if (matches.length !== 1) return null;
  return withEffectiveTeamSala(db, {
    ...matches[0],
    members: listTeamMembers(db, matches[0].team_id),
  });
}

export function listTeamsBySala(db, { sala, forUserId, allSalas } = {}) {
  const salaFilter = String(sala || '').trim();
  const uid = String(forUserId || '');
  const showAll = allSalas === true || salaFilter === '__all__';
  const patientCounts = buildActivePatientCountByTeam(db);
  const lanAssignmentCounts = buildLanAssignmentCountByTeam(db);
  return listActiveTeams(db)
    .filter((team) => {
      if (showAll || !salaFilter) return true;
      return effectiveTeamSala(db, team) === salaFilter;
    })
    .map((team) => {
      const members = listTeamMembers(db, team.team_id);
      let handle = '';
      if (uid) {
        const u = db.prepare('SELECT username FROM users WHERE user_id = ?').get(uid);
        handle = normalizeUsername(u?.username || '');
      }
      const isMember =
        uid || handle
          ? members.some((m) => {
              if (uid && String(m.user_id) === uid) return true;
              if (handle && normalizeUsername(m.username || '') === handle) return true;
              return false;
            })
          : false;
      let joinEligible = false;
      let joinReason = '';
      let joinWarning = '';
      const teamSala = effectiveTeamSala(db, team);
      if (uid && !isMember) {
        const errors = validateSalaTeamMembership(db, {
          userId: uid,
          teamId: team.team_id,
          teamSala,
        });
        if (errors.length) {
          joinReason = errors[0];
        } else {
          joinEligible = true;
          const warnings = getSalaTeamMembershipWarnings(db, {
            userId: uid,
            teamId: team.team_id,
            teamSala,
          });
          if (warnings.length) joinWarning = warnings[0];
        }
      }
      return {
        ...withEffectiveTeamSala(db, team),
        members,
        guardia_today: getTeamGuardiaToday(db, team.team_id) ?? null,
        patientCount: patientCounts.get(team.team_id) || 0,
        lanAssignmentCount: lanAssignmentCounts.get(team.team_id) || 0,
        isMember,
        joinEligible,
        joinReason,
        joinWarning,
      };
    });
}

export function getInternoScopeContext(db) {
  const teams = listActiveTeams(db).map((team) => ({
    ...withEffectiveTeamSala(db, team),
    members: listTeamMembers(db, team.team_id),
  }));
  const salaGuardiaToday = db
    .prepare(`SELECT team_id, user_id, declared_at FROM team_guardia_today`)
    .all();
  return { teams, salaGuardiaToday };
}

/**
 * Snapshot for renderer scope evaluation (V2).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} [userId]
 */
export function getClinicalScopeContext(db, userId) {
  const nowIso = new Date().toISOString();
  const teams = listActiveTeams(db).map((team) => ({
    ...withEffectiveTeamSala(db, team),
    members: listTeamMembers(db, team.team_id),
  }));
  const guardias = fetchActiveGuardias(db, userId || undefined);
  const cycle = getActiveRotationCycle(db);
  let assignments = [];
  try {
    assignments = fetchPatientTeamAssignments(db);
  } catch (err) {
    console.error(
      '[clinical-scope] fetchPatientTeamAssignments failed:',
      err && err.message ? err.message : err
    );
  }
  const salaGuardiaToday = db
    .prepare(`SELECT team_id, user_id, declared_at FROM team_guardia_today`)
    .all();
  const users = listClinicalUsers(db);
  return {
    teams,
    guardias,
    cycle: cycle ?? null,
    assignments,
    salaGuardiaToday,
    users,
    now: nowIso,
  };
}
