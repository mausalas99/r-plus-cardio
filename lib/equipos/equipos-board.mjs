import {
  EQUIPOS_DEVICE_TYPES,
  normalizeEquiposDeviceType,
  newEquiposId,
} from './equipos-constants.mjs';

/** @param {import('better-sqlite3').Database} db @param {string} eventType @param {object} fields */
export function insertEquiposEvent(db, eventType, fields = {}) {
  const id = newEquiposId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO equipos_events (id, device_type, event_type, reporter_name, rotation, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    fields.deviceType || null,
    eventType,
    fields.reporterName || null,
    fields.rotation || null,
    fields.meta ? JSON.stringify(fields.meta) : null,
    now
  );
  return id;
}

/** @param {import('better-sqlite3').Database} db */
export function listEquiposDevices(db) {
  return db.prepare(`SELECT * FROM equipos_device ORDER BY device_type`).all();
}

/** @param {import('better-sqlite3').Database} db @param {string} deviceType */
export function getEquiposDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return null;
  return db.prepare(`SELECT * FROM equipos_device WHERE device_type = ?`).get(d);
}

/** @param {import('better-sqlite3').Database} db @param {string} deviceType */
export function listWaitlistForDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  return db
    .prepare(
      `SELECT * FROM equipos_waitlist WHERE device_type = ? ORDER BY position ASC, joined_at ASC`
    )
    .all(d);
}

/** @param {import('better-sqlite3').Database} db */
export function listActiveTeamReports(db) {
  return db
    .prepare(`SELECT * FROM equipos_team_reports WHERE active = 1 ORDER BY created_at DESC`)
    .all();
}

/** @param {import('better-sqlite3').Database} db */
export function hasActiveCustodyOrWaitlist(db) {
  const inUse = db
    .prepare(`SELECT 1 FROM equipos_device WHERE status = 'in_use' LIMIT 1`)
    .get();
  if (inUse) return true;
  const wl = db.prepare(`SELECT 1 FROM equipos_waitlist LIMIT 1`).get();
  return !!wl;
}

/** @param {import('better-sqlite3').Database} db */
export function buildEquiposBoard(db) {
  const devices = listEquiposDevices(db).map((row) => ({
    ...row,
    waitlist: listWaitlistForDevice(db, row.device_type),
    gel_empty: row.gel_empty === 1,
    staleHours:
      row.status === 'in_use' && row.checked_out_at
        ? (Date.now() - Date.parse(row.checked_out_at)) / 3600000
        : 0,
  }));
  const alerts = listActiveTeamReports(db);
  const lease = db.prepare(`SELECT * FROM equipos_host_lease WHERE id = 1`).get();
  return { devices, alerts, lease };
}

/** @param {import('better-sqlite3').Database} db @param {number} [limit] */
export function listEquiposSessions(db, limit = 50) {
  return db
    .prepare(`SELECT * FROM equipos_sessions ORDER BY checked_out_at DESC LIMIT ?`)
    .all(limit);
}

/** @param {import('better-sqlite3').Database} db @param {number} [limit] */
export function listEquiposTeamReportsAll(db, limit = 50) {
  return db
    .prepare(`SELECT * FROM equipos_team_reports ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
}

/** @param {import('better-sqlite3').Database} db @param {string} deviceType */
export function getOpenSessionForDevice(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return null;
  return db
    .prepare(
      `SELECT * FROM equipos_sessions
       WHERE device_type = ? AND returned_at IS NULL
       ORDER BY checked_out_at DESC LIMIT 1`
    )
    .get(d);
}

/** @param {string|string[]} targets */
export function resolvePurgeDeviceTypes(targets) {
  if (targets === 'all') return [...EQUIPOS_DEVICE_TYPES];
  const one = normalizeEquiposDeviceType(String(targets));
  return one ? [one] : [];
}
