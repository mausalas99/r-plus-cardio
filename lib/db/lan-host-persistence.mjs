/** @param {import('better-sqlite3').Database} db */
export function readHostState(db) {
  const row = db
    .prepare('SELECT version, team_code_hash, json FROM lan_host_state WHERE id = 1')
    .get();
  if (!row) return null;
  return {
    ...JSON.parse(row.json),
    version: row.version,
    teamCodeHash: row.team_code_hash,
  };
}

/** Legacy monolithic row — superseded by sql-v3 normalized tables when schema v15 is active. */
/** @param {import('better-sqlite3').Database} db */
export function writeHostState(db, state) {
  const json = JSON.stringify({
    patients: state.patients,
    rooms: state.rooms,
    roomSyncBundles: state.roomSyncBundles,
  });
  db.prepare(
    `INSERT INTO lan_host_state (id, version, team_code_hash, json, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       version = excluded.version,
       team_code_hash = excluded.team_code_hash,
       json = excluded.json,
       updated_at = excluded.updated_at`
  ).run(state.version, state.teamCodeHash, json, new Date().toISOString());
}
