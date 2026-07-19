import { EQUIPOS_DEVICE_TYPES } from './equipos-constants.mjs';

/**
 * Merge equipos state from temporary host snapshot (LWW per device updated_at).
 * @param {import('better-sqlite3').Database} db
 * @param {object} snapshot
 */
export function mergeEquiposStateFromSnapshot(db, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { merged: 0 };

  let merged = 0;
  const devices = Array.isArray(snapshot.devices) ? snapshot.devices : [];
  for (const incoming of devices) {
    const type = String(incoming.device_type || '').trim();
    if (!EQUIPOS_DEVICE_TYPES.includes(type)) continue;
    const local = db.prepare(`SELECT * FROM equipos_device WHERE device_type = ?`).get(type);
    const inAt = Date.parse(incoming.updated_at || '') || 0;
    const locAt = Date.parse(local?.updated_at || '') || 0;
    if (inAt <= locAt) continue;
    db.prepare(
      `UPDATE equipos_device SET
        status = ?, holder_name = ?, holder_rotation = ?,
        previous_holder_name = ?, previous_holder_rotation = ?,
        checked_out_at = ?, charge_pct = ?, gel_empty = ?, updated_at = ?
       WHERE device_type = ?`
    ).run(
      incoming.status,
      incoming.holder_name,
      incoming.holder_rotation,
      incoming.previous_holder_name,
      incoming.previous_holder_rotation,
      incoming.checked_out_at,
      incoming.charge_pct,
      incoming.gel_empty,
      incoming.updated_at,
      type
    );
    merged += 1;
  }

  if (Array.isArray(snapshot.waitlist)) {
    db.prepare(`DELETE FROM equipos_waitlist`).run();
    for (const w of snapshot.waitlist) {
      db.prepare(
        `INSERT OR REPLACE INTO equipos_waitlist (id, device_type, reporter_name, rotation, joined_at, position)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(w.id, w.device_type, w.reporter_name, w.rotation, w.joined_at, w.position);
    }
  }

  return { merged };
}

/** @param {import('better-sqlite3').Database} db */
export function exportEquiposMergeSnapshot(db) {
  const devices = db.prepare(`SELECT * FROM equipos_device`).all();
  const waitlist = db.prepare(`SELECT * FROM equipos_waitlist ORDER BY device_type, position`).all();
  return { devices, waitlist, exportedAt: new Date().toISOString() };
}
