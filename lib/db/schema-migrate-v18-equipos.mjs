import crypto from 'node:crypto';
import { EQUIPOS_DEVICE_TYPES, EQUIPOS_V18_DDL } from './schema-migrate-v18-equipos-ddl.mjs';

/** @param {import('better-sqlite3').Database} db */
function seedEquiposRows(db) {
  const now = new Date().toISOString();
  for (const deviceType of EQUIPOS_DEVICE_TYPES) {
    db.prepare(
      `INSERT OR IGNORE INTO equipos_device (device_type, status, updated_at)
       VALUES (?, 'available', ?)`
    ).run(deviceType, now);
  }
  const access = db.prepare('SELECT id FROM equipos_program_access WHERE id = 1').get();
  if (!access) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(
      `INSERT INTO equipos_program_access (id, access_token, is_active, rotated_at)
       VALUES (1, ?, 1, ?)`
    ).run(token, now);
  }
  db.prepare(
    `INSERT OR IGNORE INTO equipos_host_lease (id, mode, promoted_at) VALUES (1, 'primary', ?)`
  ).run(now);
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV18Equipos(db) {
  db.exec(EQUIPOS_V18_DDL);
  seedEquiposRows(db);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '18');
}
