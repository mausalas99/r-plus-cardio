export const SCHEMA_VERSION = 21;

export const DDL_V1 = [
  `CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE clinical_blob (
  namespace TEXT NOT NULL DEFAULT 'desktop',
  blob_key TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (namespace, blob_key)
  )`,
  `CREATE TABLE lan_host_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  team_code_hash TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE forensic_audit_chain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL
  )`,
  `CREATE INDEX idx_audit_ts ON forensic_audit_chain(timestamp)`,
  `CREATE INDEX idx_audit_type ON forensic_audit_chain(event_type)`,
];

export function tableExists(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

/** Idempotent clinical-access tables (users, teams, guardias, patient columns). */
export function ensureClinicalAccessTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rank TEXT NOT NULL CHECK(rank IN ('R1', 'R2', 'R3', 'R4', 'Admin')),
      public_key TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      team_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service TEXT NOT NULL CHECK(service IN ('Sala', 'Torre HU', 'Eme', 'UX', 'Interconsultas', 'Área A/Pensionistas')),
      sub_area_fraction TEXT,
      on_call_day_index INTEGER NOT NULL CHECK(on_call_day_index BETWEEN 0 AND 6),
      created_by TEXT,
      FOREIGN KEY(created_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS team_membership (
      team_id TEXT,
      user_id TEXT,
      PRIMARY KEY(team_id, user_id),
      FOREIGN KEY(team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_guardias (
      guardia_id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      covering_user_id TEXT NOT NULL,
      source_team_id TEXT NOT NULL,
      is_critical INTEGER DEFAULT 0 CHECK(is_critical IN (0, 1)),
      pendientes_json TEXT,
      vitals_frequency TEXT DEFAULT 'None' CHECK(vitals_frequency IN ('1h', '2h', '4h', 'Shift_Once', 'None')),
      last_vitals_check DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Resolved')),
      FOREIGN KEY(covering_user_id) REFERENCES users(user_id)
    );
  `);

  if (!tableExists(db, 'patients')) {
    db.exec(`CREATE TABLE patients (id TEXT PRIMARY KEY)`);
  }

  const patientCols = db.prepare('PRAGMA table_info(patients)').all().map((c) => c.name);
  if (!patientCols.includes('interconsult_type')) {
    db.exec(
      "ALTER TABLE patients ADD COLUMN interconsult_type TEXT DEFAULT 'None' CHECK(interconsult_type IN ('Ephemeral_VPO', 'Follow-up', 'None'))"
    );
  }
  if (!patientCols.includes('interconsult_status')) {
    db.exec(
      "ALTER TABLE patients ADD COLUMN interconsult_status TEXT DEFAULT 'Pending' CHECK(interconsult_status IN ('Pending', 'Resolved', 'Active'))"
    );
  }
  if (!patientCols.includes('prognosis_classification')) {
    db.exec("ALTER TABLE patients ADD COLUMN prognosis_classification TEXT DEFAULT 'Buen Pronóstico'");
  }
  if (!patientCols.includes('negativa_maniobras_firmada')) {
    db.exec(
      'ALTER TABLE patients ADD COLUMN negativa_maniobras_firmada INTEGER DEFAULT 0 CHECK(negativa_maniobras_firmada IN (0, 1))'
    );
  }
}


export function readSchemaVersion(db) {
  const hasMeta = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'")
    .get();
  if (!hasMeta) return null;
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
  if (!row) return null;
  return Number(row.value);
}
