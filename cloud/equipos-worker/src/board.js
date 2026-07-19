import { EQUIPOS_DEVICE_TYPES, normalizeEquiposDeviceType, newEquiposId } from './constants.js';
import { formatBoardStamp } from '../../../lib/equipos/equipos-board-stamp.mjs';

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} eventType @param {object} fields */
export async function insertEquiposEvent(db, eventType, fields = {}) {
  const id = newEquiposId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO equipos_events (id, device_type, event_type, reporter_name, rotation, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      fields.deviceType || null,
      eventType,
      fields.reporterName || null,
      fields.rotation || null,
      fields.meta ? JSON.stringify(fields.meta) : null,
      now
    )
    .run();
  return id;
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function listEquiposDevices(db) {
  const { results } = await db
    .prepare(`SELECT * FROM equipos_device ORDER BY device_type`)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType */
export async function getEquiposDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return null;
  return db.prepare(`SELECT * FROM equipos_device WHERE device_type = ?`).bind(d).first();
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType */
export async function listWaitlistForDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  const { results } = await db
    .prepare(
      `SELECT * FROM equipos_waitlist WHERE device_type = ? ORDER BY position ASC, joined_at ASC`
    )
    .bind(d)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function listActiveTeamReports(db) {
  const { results } = await db
    .prepare(`SELECT * FROM equipos_team_reports WHERE active = 1 ORDER BY created_at DESC`)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function hasActiveCustodyOrWaitlist(db) {
  const inUse = await db
    .prepare(`SELECT 1 AS x FROM equipos_device WHERE status = 'in_use' LIMIT 1`)
    .first();
  if (inUse) return true;
  const wl = await db.prepare(`SELECT 1 AS x FROM equipos_waitlist LIMIT 1`).first();
  return !!wl;
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function buildEquiposBoard(db) {
  const devices = await listEquiposDevices(db);
  const withWaitlist = await Promise.all(
    devices.map(async (row) => ({
      ...row,
      waitlist: await listWaitlistForDevice(db, row.device_type),
      gel_empty: row.gel_empty === 1,
      staleHours:
        row.status === 'in_use' && row.checked_out_at
          ? (Date.now() - Date.parse(row.checked_out_at)) / 3600000
          : 0,
    }))
  );
  const alerts = await listActiveTeamReports(db);
  return { devices: withWaitlist, alerts, lease: null };
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function getBoardStamp(db) {
  const dev = await db
    .prepare(
      `SELECT MAX(updated_at) AS max_dev,
              SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) AS in_use,
              SUM(CASE WHEN previous_holder_name IS NOT NULL THEN 1 ELSE 0 END) AS prev_count,
              MAX(COALESCE(previous_holder_name, '') || '|' || COALESCE(previous_holder_rotation, '')) AS prev_sig
       FROM equipos_device`
    )
    .first();
  const wl = await db
    .prepare(`SELECT COUNT(*) AS c, MAX(joined_at) AS max_j FROM equipos_waitlist`)
    .first();
  const alerts = await db
    .prepare(
      `SELECT COUNT(*) AS c, MAX(created_at) AS max_c
       FROM equipos_team_reports WHERE active = 1`
    )
    .first();
  const ev = await db.prepare(`SELECT MAX(created_at) AS max_ev FROM equipos_events`).first();
  return formatBoardStamp(dev, wl, alerts, ev);
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {number} [limit] */
export async function listEquiposSessions(db, limit = 50) {
  const { results } = await db
    .prepare(`SELECT * FROM equipos_sessions ORDER BY checked_out_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {number} [limit] */
export async function listEquiposTeamReportsAll(db, limit = 50) {
  const { results } = await db
    .prepare(`SELECT * FROM equipos_team_reports ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType */
export async function getOpenSessionForDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return null;
  return db
    .prepare(
      `SELECT * FROM equipos_sessions
       WHERE device_type = ? AND returned_at IS NULL
       ORDER BY checked_out_at DESC LIMIT 1`
    )
    .bind(d)
    .first();
}

/** @param {string|string[]} targets */
export function resolvePurgeDeviceTypes(targets) {
  if (targets === 'all') return [...EQUIPOS_DEVICE_TYPES];
  const one = normalizeEquiposDeviceType(String(targets));
  return one ? [one] : [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} photoId */
export async function getEquiposPhoto(db, photoId) {
  return db.prepare(`SELECT * FROM equipos_photos WHERE id = ?`).bind(photoId).first();
}
