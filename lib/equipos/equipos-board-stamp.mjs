/** Compact fingerprint of equipos board state for live refresh polling. */

/** @param {object|null|undefined} dev @param {object|null|undefined} wl @param {object|null|undefined} alerts @param {object|null|undefined} [ev] */
export function formatBoardStamp(dev, wl, alerts, ev) {
  return [
    dev?.max_dev || '',
    dev?.in_use ?? 0,
    dev?.prev_count ?? 0,
    dev?.prev_sig || '',
    wl?.c ?? 0,
    wl?.max_j || '',
    alerts?.c ?? 0,
    alerts?.max_c || '',
    ev?.max_ev || '',
  ].join('|');
}

/** @param {import('better-sqlite3').Database} db */
export function getBoardStampSync(db) {
  const dev = db
    .prepare(
      `SELECT MAX(updated_at) AS max_dev,
              SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) AS in_use,
              SUM(CASE WHEN previous_holder_name IS NOT NULL THEN 1 ELSE 0 END) AS prev_count,
              MAX(COALESCE(previous_holder_name, '') || '|' || COALESCE(previous_holder_rotation, '')) AS prev_sig
       FROM equipos_device`
    )
    .get();
  const wl = db
    .prepare(`SELECT COUNT(*) AS c, MAX(joined_at) AS max_j FROM equipos_waitlist`)
    .get();
  const alerts = db
    .prepare(
      `SELECT COUNT(*) AS c, MAX(created_at) AS max_c
       FROM equipos_team_reports WHERE active = 1`
    )
    .get();
  const ev = db.prepare(`SELECT MAX(created_at) AS max_ev FROM equipos_events`).get();
  return formatBoardStamp(dev, wl, alerts, ev);
}
