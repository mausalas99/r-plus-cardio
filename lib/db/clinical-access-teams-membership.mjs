import { loadCensusPatientIdSet } from './clinical-access-assignments.mjs';
import { fetchActiveGuardias } from './clinical-access-guardia.mjs';
import {
  clearLanMembershipRejoin,
  clearLanMembershipRemoval,
  recordLanMembershipRejoin,
  recordLanMembershipRemoval,
  rememberLanResolvedGuardia,
} from './clinical-access-lan.mjs';
import { SOFT_MAX_R1_PER_TEAM, SOFT_MAX_TEAMS_PER_SALA, countTeamsInEffectiveSala, effectiveTeamSala, userHasR1MembershipInEffectiveSala } from './clinical-access-teams-core.mjs';
function resolveTeamSalaForMembership(db, teamId, teamSala) {
  let sala = String(teamSala || '').trim();
  if (!sala) {
    const row = db
      .prepare(`SELECT team_id, sala, created_by FROM teams WHERE team_id = ?`)
      .get(String(teamId));
    if (row) sala = effectiveTeamSala(db, row);
  }
  return sala;
}

export function joinTeam(db, teamId, userId, opts = {}) {
  return addTeamMember(db, teamId, userId, opts);
}

/**
 * Move team rows from a stale device user to the recovered LAN identity.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ fromUserId: string, toUserId: string }} opts
 */
export function migrateTeamMemberships(db, { fromUserId, toUserId }) {
  const from = String(fromUserId || '');
  const to = String(toUserId || '');
  if (!from || !to || from === to) return { moved: 0 };

  const memberships = db
    .prepare('SELECT team_id FROM team_membership WHERE user_id = ?')
    .all(from);
  let moved = 0;
  for (const row of memberships) {
    const teamId = String(row.team_id || '');
    if (!teamId) continue;
    const exists = db
      .prepare('SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?')
      .get(teamId, to);
    if (exists) {
      db.prepare('DELETE FROM team_membership WHERE team_id = ? AND user_id = ?').run(
        teamId,
        from
      );
    } else {
      db.prepare(
        'UPDATE team_membership SET user_id = ? WHERE team_id = ? AND user_id = ?'
      ).run(to, teamId, from);
      moved += 1;
    }
  }

  db.prepare('UPDATE team_guardia_today SET user_id = ? WHERE user_id = ?').run(to, from);
  db.prepare('UPDATE teams SET leader_user_id = ? WHERE leader_user_id = ?').run(to, from);
  db.prepare('UPDATE teams SET created_by = ? WHERE created_by = ?').run(to, from);
  db.prepare('UPDATE active_guardias SET covering_user_id = ? WHERE covering_user_id = ?').run(
    to,
    from
  );

  return { moved };
}

export function validateSalaTeamMembership(db, { userId, teamId, teamSala }) {
  const errors = [];

  if (!userId || !teamId) {
    errors.push('Usuario o equipo no válido.');
    return errors;
  }

  const sala = resolveTeamSalaForMembership(db, teamId, teamSala);

  if (sala && userHasR1MembershipInEffectiveSala(db, userId, sala, teamId)) {
    errors.push('R1 ya pertenece a un equipo en esta Sala.');
  }

  const member = db.prepare(`SELECT rank FROM users WHERE user_id = ?`).get(userId);
  const rank = String(member?.rank || '');

  if (rank === 'R2') {
    const r2Teams = db.prepare(`
      SELECT COUNT(*) as cnt FROM team_membership tm
      JOIN users u ON u.user_id = tm.user_id
      WHERE tm.user_id = ? AND u.rank = 'R2'
    `).get(userId);
    if (r2Teams.cnt >= 1) {
      errors.push('R2 ya lidera un equipo.');
    }
  }

  return errors;
}

/**
 * Soft limits (warn only — never block join/add).
 * @param {import('better-sqlite3').Database} db
 * @param {{ userId?: string, teamId?: string, teamSala?: string, rank?: string }} opts
 * @returns {string[]}
 */
export function getSalaTeamMembershipWarnings(db, { userId, teamId, teamSala, rank: rankOverride }) {
  const warnings = [];
  const sala = resolveTeamSalaForMembership(db, teamId, teamSala);

  if (sala && countTeamsInEffectiveSala(db, sala) >= SOFT_MAX_TEAMS_PER_SALA) {
    warnings.push(
      `Ya hay ${SOFT_MAX_TEAMS_PER_SALA} equipos en esta Sala (recomendado máximo).`
    );
  }

  let rank = rankOverride ? String(rankOverride).trim() : '';
  if (!rank && userId) {
    const member = db.prepare(`SELECT rank FROM users WHERE user_id = ?`).get(userId);
    rank = String(member?.rank || '');
  }

  if (rank === 'R1' && teamId) {
    const r1Count = db.prepare(`
      SELECT COUNT(*) as cnt FROM team_membership tm
      JOIN users u ON u.user_id = tm.user_id
      WHERE tm.team_id = ? AND u.rank = 'R1'
    `).get(teamId);
    if (r1Count.cnt >= SOFT_MAX_R1_PER_TEAM) {
      warnings.push(
        `El equipo ya tiene ${SOFT_MAX_R1_PER_TEAM} R1s (recomendado máximo).`
      );
    }
  }

  return warnings;
}

/**
 * Active entregas whose patient chart is not in the local census blob (LAN stub / deleted locally).
 * @param {import('better-sqlite3').Database} db
 * @param {string} [userId]
 */
export function fetchOrphanActiveGuardias(db, userId) {
  const census = loadCensusPatientIdSet(db);
  return fetchActiveGuardias(db, userId).filter((row) => {
    const patientId = String(row?.patient_id || '').trim();
    return patientId && !census.has(patientId);
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ patientId?: string, guardiaId?: string }} opts
 */
export function resolveActiveGuardia(db, opts = {}) {
  const patientId = String(opts.patientId || '').trim();
  const guardiaId = String(opts.guardiaId || '').trim();
  const row = guardiaId
    ? db
        .prepare(
          `SELECT guardia_id, patient_id FROM active_guardias
           WHERE guardia_id = ? AND status = 'Active'`
        )
        .get(guardiaId)
    : patientId
      ? db
          .prepare(
            `SELECT guardia_id, patient_id FROM active_guardias
             WHERE patient_id = ? AND status = 'Active' LIMIT 1`
          )
          .get(patientId)
      : null;
  if (!row) return { resolved: false };

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE active_guardias SET status = 'Resolved', assigned_at = ? WHERE guardia_id = ?`
  ).run(now, row.guardia_id);
  rememberLanResolvedGuardia(db, {
    patient_id: String(row.patient_id),
    guardia_id: String(row.guardia_id),
    assigned_at: now,
  });
  return {
    resolved: true,
    guardia_id: String(row.guardia_id),
    patient_id: String(row.patient_id),
    assigned_at: now,
  };
}

function updateExistingTeamMemberFraction(db, teamId, userId, fraction) {
  db.prepare(
    `UPDATE team_membership SET sub_area_fraction = ? WHERE team_id = ? AND user_id = ?`
  ).run(fraction, teamId, userId);
  return { warnings: [] };
}

function resolveMemberSubAreaFraction(db, team, userId, opts) {
  const member = db.prepare(`SELECT rank FROM users WHERE user_id = ?`).get(userId);
  const rank = String(member?.rank || '');
  let fraction = opts.subAreaFraction ? String(opts.subAreaFraction).trim() : '';
  if (!fraction && rank === 'R2') {
    fraction = String(team.sub_area_fraction || '').trim();
  }
  return { rank, fraction };
}

function insertTeamMemberRow(db, teamId, userId, fraction) {
  clearLanMembershipRemoval(db, teamId, userId);
  recordLanMembershipRejoin(db, teamId, userId);
  db.prepare(
    `INSERT INTO team_membership (team_id, user_id, sub_area_fraction) VALUES (?, ?, ?)`
  ).run(teamId, userId, fraction || null);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {string} userId
 * @param {{ subAreaFraction?: string|null }} [opts]
 */
export function addTeamMember(db, teamId, userId, opts = {}) {
  const tid = String(teamId || '');
  const uid = String(userId || '');
  const team = db
    .prepare(
      `SELECT team_id, sala, created_by, service, sub_area_fraction FROM teams WHERE team_id = ?`
    )
    .get(tid);
  if (!team) throw new Error('Equipo no encontrado.');

  const existing = db
    .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
    .get(tid, uid);
  if (existing) {
    const fraction = opts.subAreaFraction ? String(opts.subAreaFraction).trim() : '';
    if (fraction) return updateExistingTeamMemberFraction(db, tid, uid, fraction);
    throw new Error('Ya es integrante de este equipo.');
  }

  const teamSala = effectiveTeamSala(db, team);
  const errors = validateSalaTeamMembership(db, { userId: uid, teamId: tid, teamSala });
  if (errors.length) throw new Error(errors.join(' '));
  const warnings = getSalaTeamMembershipWarnings(db, { userId: uid, teamId: tid, teamSala });

  const { rank, fraction } = resolveMemberSubAreaFraction(db, team, uid, opts);
  insertTeamMemberRow(db, tid, uid, fraction);
  if (rank === 'R2' && fraction) {
    db.prepare(`UPDATE teams SET sub_area_fraction = ? WHERE team_id = ?`).run(fraction, tid);
  }

  return { warnings };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {string} userId
 */
/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {string} userId
 */
export function memberHasActiveGuardiaForTeam(db, teamId, userId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM active_guardias
       WHERE status = 'Active' AND covering_user_id = ? AND source_team_id = ?`
    )
    .get(String(userId || ''), String(teamId || ''));
  return Number(row?.cnt || 0) > 0;
}

export function removeTeamMember(db, teamId, userId) {
  const tid = String(teamId || '');
  const uid = String(userId || '');
  if (memberHasActiveGuardiaForTeam(db, tid, uid)) {
    throw new Error(
      'No puedes salir del equipo: tienes entregas activas asignadas. Finalízalas antes.'
    );
  }
  recordLanMembershipRemoval(db, tid, uid);
  clearLanMembershipRejoin(db, tid, uid);
  db.prepare(`DELETE FROM team_membership WHERE team_id = ? AND user_id = ?`).run(tid, uid);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 * @param {string} userId
 */
export function setTeamGuardiaToday(db, teamId, userId) {
  const declaredAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO team_guardia_today (team_id, user_id, declared_at)
     VALUES (?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       user_id = excluded.user_id,
       declared_at = excluded.declared_at`
  ).run(teamId, userId, declaredAt);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} teamId
 */
export function getTeamGuardiaToday(db, teamId) {
  return db
    .prepare(`SELECT team_id, user_id, declared_at FROM team_guardia_today WHERE team_id = ?`)
    .get(teamId);
}
