import { indexBy, pickTeamMergeWinner, resolveMergeUserFk } from './clinical-ops-sync-merge-utils.mjs';

function updateTeamRow(db, teamId, winner, createdBy, leaderUserId) {
  db.prepare(
    `UPDATE teams SET name = ?, service = ?, sub_area_fraction = ?, on_call_day_index = ?,
     created_by = ?, archived_at = ?, sala = ?, team_leader_name = ?, leader_user_id = ?, rotation_active = ?, updated_at = ?
     WHERE team_id = ?`
  ).run(
    winner.name,
    winner.service,
    winner.sub_area_fraction ?? null,
    Number(winner.on_call_day_index ?? 0),
    createdBy,
    winner.archived_at ?? null,
    winner.sala ?? null,
    winner.team_leader_name ?? null,
    leaderUserId,
    Number(winner.rotation_active ?? 1),
    winner.updated_at ?? null,
    teamId
  );
}

function insertTeamRow(db, teamId, winner, createdBy, leaderUserId) {
  db.prepare(
    `INSERT INTO teams (team_id, name, service, sub_area_fraction, on_call_day_index, created_by, archived_at, sala, team_leader_name, leader_user_id, rotation_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    teamId,
    winner.name,
    winner.service,
    winner.sub_area_fraction ?? null,
    Number(winner.on_call_day_index ?? 0),
    createdBy,
    winner.archived_at ?? null,
    winner.sala ?? null,
    winner.team_leader_name ?? null,
    leaderUserId,
    Number(winner.rotation_active ?? 1),
    winner.updated_at ?? null
  );
}

function upsertTeamMergeWinner(db, teamId, winner) {
  const createdBy = resolveMergeUserFk(db, winner.created_by);
  const leaderUserId = resolveMergeUserFk(db, winner.leader_user_id);
  const existing = db.prepare(`SELECT team_id FROM teams WHERE team_id = ?`).get(teamId);
  try {
    if (existing) {
      updateTeamRow(db, teamId, winner, createdBy, leaderUserId);
    } else {
      insertTeamRow(db, teamId, winner, createdBy, leaderUserId);
    }
  } catch {
    /* skip team row when service check or FK still cannot be satisfied */
  }
}

export function mergeTeams(db, localRows, incomingRows) {
  const localById = indexBy(localRows, 'team_id');
  const incomingById = indexBy(incomingRows, 'team_id');
  const allIds = new Set([...localById.keys(), ...incomingById.keys()]);

  for (const teamId of allIds) {
    const winner = pickTeamMergeWinner(localById.get(teamId), incomingById.get(teamId));
    if (!winner) continue;
    upsertTeamMergeWinner(db, teamId, winner);
  }
}

/** @param {import('better-sqlite3').Database} db @param {object[]} tombstones */
export function applyLanArchivedTeamsToDb(db, tombstones) {
  for (const row of tombstones || []) {
    const teamId = String(row?.team_id || '').trim();
    const archivedAt = String(row?.archived_at || '').trim();
    if (!teamId || !archivedAt) continue;
    const existing = db.prepare(`SELECT archived_at FROM teams WHERE team_id = ?`).get(teamId);
    if (!existing) continue;
    const current = String(existing.archived_at || '');
    if (current && archivedAt < current) continue;
    db.prepare(
      `UPDATE teams SET archived_at = ?, rotation_active = 0, updated_at = COALESCE(updated_at, ?) WHERE team_id = ?`
    ).run(archivedAt, archivedAt, teamId);
    db.prepare(`DELETE FROM team_membership WHERE team_id = ?`).run(teamId);
    db.prepare(`DELETE FROM team_guardia_today WHERE team_id = ?`).run(teamId);
  }
}
