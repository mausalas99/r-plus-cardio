import { tableExists } from './schema-primitives.mjs';

/** @param {import('better-sqlite3').Database} db @param {string} table @param {string} column */
function columnExists(db, table, column) {
  if (!tableExists(db, table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

/** @param {import('better-sqlite3').Database} db */
function rebuildEquiposPhotosTable(db) {
  if (!tableExists(db, 'equipos_photos')) return;
  if (columnExists(db, 'equipos_photos', 'report_id')) return;

  db.exec(`
    CREATE TABLE equipos_photos_v19 (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      report_id TEXT,
      device_type TEXT NOT NULL,
      photo_kind TEXT NOT NULL CHECK(photo_kind IN ('pickup', 'return', 'alert')),
      file_path TEXT NOT NULL,
      captured_at TEXT NOT NULL
    );
    INSERT INTO equipos_photos_v19 (id, session_id, report_id, device_type, photo_kind, file_path, captured_at)
    SELECT id, session_id, NULL, device_type, photo_kind, file_path, captured_at
    FROM equipos_photos;
    DROP TABLE equipos_photos;
    ALTER TABLE equipos_photos_v19 RENAME TO equipos_photos;
  `);
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV19EquiposAlertPhotos(db) {
  if (tableExists(db, 'equipos_team_reports') && !columnExists(db, 'equipos_team_reports', 'photo_id')) {
    db.exec('ALTER TABLE equipos_team_reports ADD COLUMN photo_id TEXT');
  }
  rebuildEquiposPhotosTable(db);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '19');
}
