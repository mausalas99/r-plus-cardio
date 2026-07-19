import { SCHEMA_VERSION, readSchemaVersion, tableExists } from './schema-primitives.mjs';
import {
  migrateToV1,
  migrateToV2,
  migrateToV3,
  migrateToV4,
  migrateToV5,
  migrateToV6,
  migrateToV7,
  migrateToV8,
  migrateToV9,
  migrateToV10,
} from './schema-migrate-v1-v10.mjs';
import { migrateToV11, migrateToV12, migrateToV13, migrateToV14 } from './schema-migrate-v11-v14.mjs';
import { migrateToV18Equipos } from './schema-migrate-v18-equipos.mjs';
import { migrateToV19EquiposAlertPhotos } from './schema-migrate-v19-equipos-alert-photos.mjs';
import { migrateToV20EquiposPush } from './schema-migrate-v20-equipos-push.mjs';
import { migrateToV21ClinicalSalaCheck } from './schema-migrate-v21-clinical-sala-check.mjs';

/** @param {import('better-sqlite3').Database} db */
function runMigrationsV11ThroughV19(db) {
  if (readSchemaVersion(db) < 11) {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => migrateToV11(db))();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
  const steps = [
    [12, migrateToV12],
    [13, migrateToV13],
    [14, migrateToV14],
    [15, migrateToV15LanHostTables],
    [16, migrateToV16UserLastActivity],
    [17, migrateToV17UserActivityBackfill],
    [18, migrateToV18Equipos],
    [19, migrateToV19EquiposAlertPhotos],
    [20, migrateToV20EquiposPush],
  ];
  for (const [version, fn] of steps) {
    if (readSchemaVersion(db) < version) {
      db.transaction(() => fn(db))();
    }
  }
  if (readSchemaVersion(db) < 21) {
    db.pragma('foreign_keys = OFF');
    try {
      migrateToV21ClinicalSalaCheck(db);
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
}

export function applyMigrations(db) {
  const current = readSchemaVersion(db);
  if (current === SCHEMA_VERSION) return;

  const run = db.transaction(() => {
    let version = current;
    if (version === null) {
      migrateToV1(db);
      version = 1;
    }
    if (version < 2) migrateToV2(db);
    if (version < 3) migrateToV3(db);
    if (version < 4) migrateToV4(db);
    if (version < 5) migrateToV5(db);
    if (version < 6) migrateToV6(db);
    if (version < 7) migrateToV7(db);
    if (version < 8) migrateToV8(db);
    if (version < 9) migrateToV9(db);
    if (version < 10) migrateToV10(db);
  });
  run();

  runMigrationsV11ThroughV19(db);
}

export function migrateToV16UserLastActivity(db) {
  if (tableExists(db, 'users')) {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (!userCols.includes('last_activity_at')) {
      db.exec('ALTER TABLE users ADD COLUMN last_activity_at TEXT');
    }
  }
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '16');
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV17UserActivityBackfill(db) {
  if (tableExists(db, 'users')) {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (userCols.includes('last_activity_at') && userCols.includes('created_at')) {
      db.exec(`
        UPDATE users
        SET last_activity_at = created_at
        WHERE last_activity_at IS NULL AND created_at IS NOT NULL
      `);
    }
  }
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '17');
}

/** @param {import('better-sqlite3').Database} db */
export function migrateToV15LanHostTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lan_host_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      team_code_hash TEXT NOT NULL,
      patients_json TEXT NOT NULL DEFAULT '[]',
      rooms_json TEXT NOT NULL DEFAULT '[]',
      room_revisions_json TEXT,
      migration_generation INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lan_room_bundles (
      room_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      entity_versions_json TEXT,
      agenda_json TEXT,
      todos_json TEXT,
      manejo_json TEXT,
      clinical_ops_json TEXT,
      delta_log_json TEXT,
      committed_at TEXT,
      audit_log_json TEXT,
      uploaded_by_client_id TEXT,
      entities_json TEXT
    );

    CREATE TABLE IF NOT EXISTS lan_bundle_entries (
      room_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      nota_version INTEGER,
      indicaciones_version INTEGER,
      lab_meta_json TEXT,
      PRIMARY KEY (room_id, patient_id)
    );

    CREATE TABLE IF NOT EXISTS lan_lab_sets (
      room_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      set_id TEXT NOT NULL,
      set_json TEXT NOT NULL,
      sort_date TEXT NOT NULL,
      client_timestamp INTEGER NOT NULL,
      PRIMARY KEY (room_id, patient_id, set_id)
    );

    CREATE TABLE IF NOT EXISTS lan_lab_set_order (
      room_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      pos INTEGER NOT NULL,
      set_id TEXT NOT NULL,
      PRIMARY KEY (room_id, patient_id, pos)
    );
  `);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '15');
}
