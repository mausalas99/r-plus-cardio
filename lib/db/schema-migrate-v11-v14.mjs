import { clinicalSalaSqlCheck } from '../clinical-salas.mjs';
import { tableExists } from './schema-primitives.mjs';
import {
  migrateSalaInternoAccessV11,
  migrateTeamsTableV11,
  migrateUsersTableV11,
  seedSalaInternoTokensV11,
} from './schema-migrate-v11-helpers.mjs';

export function migrateToV11(db) {
  const salaCheck = clinicalSalaSqlCheck({ allowNull: true });
  const salaCheckNotNull = clinicalSalaSqlCheck({ allowNull: false });
  migrateUsersTableV11(db, salaCheck);
  migrateTeamsTableV11(db, salaCheck);
  migrateSalaInternoAccessV11(db, salaCheckNotNull);
  seedSalaInternoTokensV11(db);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '11');
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV12(db) {
  if (!tableExists(db, 'lan_sync_outbox')) {
    db.prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('schema_version', '12');
    return;
  }
  db.exec(`
    CREATE TABLE lan_sync_outbox_v12 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('bundle', 'patch', 'clinical_ops', 'delta', 'command')),
      payload_json TEXT NOT NULL,
      enqueued_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    INSERT INTO lan_sync_outbox_v12
      (id, room_id, kind, payload_json, enqueued_at, attempts, last_error)
    SELECT id, room_id, kind, payload_json, enqueued_at, attempts, last_error
    FROM lan_sync_outbox;
    DROP TABLE lan_sync_outbox;
    ALTER TABLE lan_sync_outbox_v12 RENAME TO lan_sync_outbox;
    CREATE INDEX IF NOT EXISTS idx_lan_outbox_room ON lan_sync_outbox(room_id, enqueued_at);
  `);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '12');
}
export function migrateToV13(db) {
  if (tableExists(db, 'teams')) {
    const teamCols = db.prepare('PRAGMA table_info(teams)').all().map((c) => c.name);
    if (!teamCols.includes('updated_at')) {
      db.exec('ALTER TABLE teams ADD COLUMN updated_at TEXT');
      db.exec(
        `UPDATE teams SET updated_at = COALESCE(archived_at, datetime('now')) WHERE updated_at IS NULL`
      );
    }
  }
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '13');
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV14(db) {
  if (!tableExists(db, 'lan_sync_outbox')) {
    db.prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('schema_version', '14');
    return;
  }
  db.exec(`
    CREATE TABLE lan_sync_outbox_v14 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN (
        'bundle', 'patch', 'clinical_ops', 'delta', 'command',
        'lab_history_upsert', 'nota_replace', 'indicaciones_replace', 'patient_fields'
      )),
      payload_json TEXT NOT NULL,
      enqueued_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    INSERT INTO lan_sync_outbox_v14
      (id, room_id, kind, payload_json, enqueued_at, attempts, last_error)
    SELECT id, room_id, kind, payload_json, enqueued_at, attempts, last_error
    FROM lan_sync_outbox;
    DROP TABLE lan_sync_outbox;
    ALTER TABLE lan_sync_outbox_v14 RENAME TO lan_sync_outbox;
    CREATE INDEX IF NOT EXISTS idx_lan_outbox_room ON lan_sync_outbox(room_id, enqueued_at);
  `);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '14');
}
