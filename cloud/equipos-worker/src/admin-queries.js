import { normalizeEquiposDeviceType } from './constants.js';

export const EQUIPOS_ADMIN_HISTORY_DAYS = 14;
export const EQUIPOS_ADMIN_PAGE_SIZE = 25;

/** @param {number} [days] */
export function equiposHistorySinceIso(days = EQUIPOS_ADMIN_HISTORY_DAYS) {
  const d = Math.min(90, Math.max(1, Number(days) || EQUIPOS_ADMIN_HISTORY_DAYS));
  return new Date(Date.now() - d * 86400000).toISOString();
}

/** @param {URLSearchParams} params */
export function parseAdminListQuery(params) {
  const limit = Math.min(
    100,
    Math.max(1, parseInt(params.get('limit') || String(EQUIPOS_ADMIN_PAGE_SIZE), 10) || EQUIPOS_ADMIN_PAGE_SIZE)
  );
  const offset = Math.max(0, parseInt(params.get('offset') || '0', 10) || 0);
  const days = Math.min(
    90,
    Math.max(1, parseInt(params.get('days') || String(EQUIPOS_ADMIN_HISTORY_DAYS), 10) || EQUIPOS_ADMIN_HISTORY_DAYS)
  );
  return {
    limit,
    offset,
    since: equiposHistorySinceIso(days),
    deviceType: params.get('device') || '',
  };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} opts */
export async function listEquiposSessionsPaged(db, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || EQUIPOS_ADMIN_PAGE_SIZE));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT * FROM equipos_sessions WHERE checked_out_at >= ?`;
  const binds = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    binds.push(device);
  }
  sql += ` ORDER BY checked_out_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} opts */
export async function countEquiposSessions(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT COUNT(*) AS n FROM equipos_sessions WHERE checked_out_at >= ?`;
  const binds = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    binds.push(device);
  }
  const row = await db.prepare(sql).bind(...binds).first();
  return row?.n || 0;
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} opts */
export async function listEquiposTeamReportsPaged(db, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || EQUIPOS_ADMIN_PAGE_SIZE));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT * FROM equipos_team_reports WHERE created_at >= ?`;
  const binds = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    binds.push(device);
  }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} opts */
export async function countEquiposTeamReports(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const device = normalizeEquiposDeviceType(opts.deviceType);
  let sql = `SELECT COUNT(*) AS n FROM equipos_team_reports WHERE created_at >= ?`;
  const binds = [since];
  if (device) {
    sql += ` AND device_type = ?`;
    binds.push(device);
  }
  const row = await db.prepare(sql).bind(...binds).first();
  return row?.n || 0;
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} opts */
export async function listEquiposPeopleSummary(db, opts = {}) {
  const since = String(opts.since || equiposHistorySinceIso());
  const { results: rows } = await db
    .prepare(
      `SELECT holder_name AS name, holder_rotation AS rotation,
              COUNT(*) AS sessions,
              MAX(checked_out_at) AS last_use
       FROM equipos_sessions
       WHERE checked_out_at >= ? AND holder_name IS NOT NULL
       GROUP BY holder_name, holder_rotation
       ORDER BY last_use DESC`
    )
    .bind(since)
    .all();
  const { results: reportCounts } = await db
    .prepare(
      `SELECT reporter_name AS name, rotation,
              COUNT(*) AS reports
       FROM equipos_team_reports
       WHERE created_at >= ?
       GROUP BY reporter_name, rotation`
    )
    .bind(since)
    .all();
  const reportMap = new Map(
    (reportCounts || []).map((r) => [`${r.name}\0${r.rotation}`, r.reports])
  );
  return (rows || []).map((row) => ({
    ...row,
    reports: reportMap.get(`${row.name}\0${row.rotation}`) || 0,
  }));
}
