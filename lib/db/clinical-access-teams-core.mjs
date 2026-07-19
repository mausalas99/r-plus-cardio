import crypto from 'node:crypto';
import { canManageTeamRoster } from './clinical-privileges.mjs';
import { getClinicalProfile } from './clinical-access-users.mjs';
import { recordLanTeamArchive } from './clinical-access-lan.mjs';
export function createTeam(db, teamInput) {
  const input = teamInput && typeof teamInput === 'object' ? teamInput : {};
  const teamId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO teams (team_id, name, service, sub_area_fraction, on_call_day_index, sala, team_leader_name, created_by, leader_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    teamId,
    String(input.name),
    String(input.service),
    input.subAreaFraction ?? null,
    Number(input.onCallDayIndex),
    input.sala ?? null,
    input.teamLeaderName ?? null,
    input.createdBy ?? null,
    input.leaderUserId ?? input.createdBy ?? null
  );
  return {
    team_id: teamId,
    name: String(input.name),
    service: String(input.service),
    sub_area_fraction: input.subAreaFraction ?? null,
    on_call_day_index: Number(input.onCallDayIndex),
    sala: input.sala ?? null,
    team_leader_name: input.teamLeaderName ?? null,
    created_by: input.createdBy ?? null,
    leader_user_id: input.leaderUserId ?? input.createdBy ?? null,
    rotation_active: 1,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function listActiveTeams(db) {
  return db
    .prepare(
      `SELECT team_id, name, service, sub_area_fraction, on_call_day_index, created_by, archived_at, sala, team_leader_name, leader_user_id, rotation_active
       FROM teams
       WHERE archived_at IS NULL
       ORDER BY name`
    )
    .all();
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ sala?: string, forUserId?: string }} opts
 */
export function clearTeamGuardiaToday(db, teamId) {
  db.prepare(`DELETE FROM team_guardia_today WHERE team_id = ?`).run(String(teamId || ''));
}

/**
 * Teams may lack `sala` when created before the field was required; infer from creator profile.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ sala?: string|null, created_by?: string|null }} team
 */
export function effectiveTeamSala(db, team) {
  const direct = String(team?.sala || '').trim();
  if (direct) return direct;
  const createdBy = String(team?.created_by || '').trim();
  if (!createdBy) return '';
  const row = db.prepare('SELECT sala FROM users WHERE user_id = ?').get(createdBy);
  return String(row?.sala || '').trim();
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} team
 */
export function withEffectiveTeamSala(db, team) {
  const resolved = effectiveTeamSala(db, team);
  return {
    ...team,
    sala: resolved || team.sala || null,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} sala
 */
export const SOFT_MAX_TEAMS_PER_SALA = 4;
export const SOFT_MAX_R1_PER_TEAM = 2;

export function countTeamsInEffectiveSala(db, sala) {
  const target = String(sala || '').trim();
  if (!target) return 0;
  return listActiveTeams(db).filter((team) => effectiveTeamSala(db, team) === target).length;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} sala
 * @returns {string|null}
 */
export function getSalaTeamCountWarning(db, sala) {
  const target = String(sala || '').trim();
  if (!target) return null;
  if (countTeamsInEffectiveSala(db, target) >= SOFT_MAX_TEAMS_PER_SALA) {
    return `Ya hay ${SOFT_MAX_TEAMS_PER_SALA} equipos en esta Sala (recomendado máximo).`;
  }
  return null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @param {string} sala
 */
export function userHasR1MembershipInEffectiveSala(db, userId, sala, exceptTeamId) {
  const uid = String(userId || '');
  const target = String(sala || '').trim();
  const skipTeam = String(exceptTeamId || '');
  if (!uid || !target) return false;
  const user = db.prepare(`SELECT rank FROM users WHERE user_id = ?`).get(uid);
  if (String(user?.rank || '') !== 'R1') return false;
  for (const team of listActiveTeams(db)) {
    if (skipTeam && String(team.team_id) === skipTeam) continue;
    if (effectiveTeamSala(db, team) !== target) continue;
    const member = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, uid);
    if (member) return true;
  }
  return false;
}

export function promoteTeamLeader(db, teamId, userId) {
  db.prepare(
    `UPDATE teams SET leader_user_id = ? WHERE team_id = ?`
  ).run(userId, teamId);
  return getTeamById(db, teamId);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 */
export function getTeamById(db, teamId) {
  return db.prepare(
    `SELECT team_id, name, service, sub_area_fraction, on_call_day_index, created_by,
            archived_at, sala, team_leader_name, leader_user_id, rotation_active
     FROM teams WHERE team_id = ?`
  ).get(teamId);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 */
export function assertCanManageTeamRoster(db, userId) {
  const profile = getClinicalProfile(db, String(userId || ''));
  if (!canManageTeamRoster(profile)) {
    throw new Error(
      'Solo R4, Admin o usuarios con privilegios de administración pueden gestionar equipos.'
    );
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {{ name?: string, sala?: string, callerUserId: string }} opts
 */
export function updateTeam(db, teamId, { name, sala, callerUserId }) {
  assertCanManageTeamRoster(db, callerUserId);
  const tid = String(teamId || '').trim();
  const team = getTeamById(db, tid);
  if (!team || team.archived_at) throw new Error('Equipo no encontrado.');

  const nextName = name != null ? String(name).trim() : String(team.name || '').trim();
  const nextSala =
    sala != null
      ? String(sala).trim()
      : String(team.sala || effectiveTeamSala(db, team) || '').trim();
  if (!nextName) throw new Error('Indica el nombre del equipo.');
  if (!nextSala) throw new Error('Selecciona la sala del equipo.');

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE teams SET name = ?, sala = ?, team_leader_name = ?, updated_at = ? WHERE team_id = ?`
  ).run(nextName, nextSala, nextName, now, tid);

  const warning = getSalaTeamCountWarning(db, nextSala);
  return {
    ...withEffectiveTeamSala(db, getTeamById(db, tid)),
    members: listTeamMembers(db, tid),
    warnings: warning ? [warning] : [],
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {string} callerUserId
 */
export function archiveTeam(db, teamId, callerUserId) {
  assertCanManageTeamRoster(db, callerUserId);
  const tid = String(teamId || '').trim();
  const team = getTeamById(db, tid);
  if (!team || team.archived_at) throw new Error('Equipo no encontrado.');

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE teams SET archived_at = ?, rotation_active = 0, updated_at = ? WHERE team_id = ?`
  ).run(now, now, tid);
  db.prepare(`DELETE FROM team_membership WHERE team_id = ?`).run(tid);
  clearTeamGuardiaToday(db, tid);
  recordLanTeamArchive(db, tid, now);
  return { team_id: tid, archived_at: now };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @returns {{ team_id: string }|null}
 */
export function findUserTeamForAutoAssign(db, userId) {
  return db.prepare(
    `SELECT tm.team_id
     FROM team_membership tm
     JOIN teams t ON t.team_id = tm.team_id
     WHERE tm.user_id = ? AND t.rotation_active = 1 AND t.archived_at IS NULL
     LIMIT 1`
  ).get(userId) || null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 */
export function listTeamMembers(db, teamId) {
  return db
    .prepare(
      `SELECT tm.team_id, tm.user_id, tm.sub_area_fraction, u.username, u.rank, u.clinical_name
       FROM team_membership tm
       JOIN users u ON u.user_id = tm.user_id
       WHERE tm.team_id = ?
       ORDER BY u.rank DESC, u.username`
    )
    .all(teamId);
}
