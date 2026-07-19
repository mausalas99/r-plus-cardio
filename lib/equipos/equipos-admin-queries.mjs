import { normalizeEquiposDeviceType } from './equipos-constants.mjs';

export const EQUIPOS_ADMIN_HISTORY_DAYS = 14;
export const EQUIPOS_ADMIN_PAGE_SIZE = 25;

/** @param {number} [days] */
export function equiposHistorySinceIso(days = EQUIPOS_ADMIN_HISTORY_DAYS) {
  const d = Math.min(90, Math.max(1, Number(days) || EQUIPOS_ADMIN_HISTORY_DAYS));
  return new Date(Date.now() - d * 86400000).toISOString();
}

/** @param {import('better-sqlite3').Database} db @param {object} [opts] */
export function listEquiposSessionsPaged(db, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || EQUIPOS_ADMIN_PAGE_SIZE));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT * FROM equipos_sessions WHERE checked_out_at >= ?`;
  const params = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    params.push(device);
  }
  sql += ` ORDER BY checked_out_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return db.prepare(sql).all(...params);
}

/** @param {import('better-sqlite3').Database} db @param {object} [opts] */
export function countEquiposSessions(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT COUNT(*) AS n FROM equipos_sessions WHERE checked_out_at >= ?`;
  const params = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    params.push(device);
  }
  return db.prepare(sql).get(...params)?.n || 0;
}

/** @param {import('better-sqlite3').Database} db @param {object} [opts] */
export function listEquiposTeamReportsPaged(db, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || EQUIPOS_ADMIN_PAGE_SIZE));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT * FROM equipos_team_reports WHERE created_at >= ?`;
  const params = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    params.push(device);
  }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return db.prepare(sql).all(...params);
}

/** @param {import('better-sqlite3').Database} db @param {object} [opts] */
export function countEquiposTeamReports(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT COUNT(*) AS n FROM equipos_team_reports WHERE created_at >= ?`;
  const params = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    params.push(device);
  }
  return db.prepare(sql).get(...params)?.n || 0;
}

/** @param {import('better-sqlite3').Database} db @param {object} [opts] */
export function listEquiposPeopleSummary(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const rows = db
    .prepare(
      `SELECT holder_name AS name, holder_rotation AS rotation,
              COUNT(*) AS sessions,
              MAX(checked_out_at) AS last_use
       FROM equipos_sessions
       WHERE checked_out_at >= ? AND holder_name IS NOT NULL
       GROUP BY holder_name, holder_rotation
       ORDER BY last_use DESC`
    )
    .all(since);
  const reportCounts = db
    .prepare(
      `SELECT reporter_name AS name, rotation,
              COUNT(*) AS reports
       FROM equipos_team_reports
       WHERE created_at >= ?
       GROUP BY reporter_name, rotation`
    )
    .all(since);
  const reportMap = new Map(
    reportCounts.map((r) => [`${r.name}\0${r.rotation}`, r.reports])
  );
  return rows.map((row) => ({
    ...row,
    reports: reportMap.get(`${row.name}\0${row.rotation}`) || 0,
  }));
}
