-- Equipos queue (cloud) — D1 schema (no host lease; cloud is authoritative).

CREATE TABLE IF NOT EXISTS equipos_program_access (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  rotated_at TEXT,
  rotated_by TEXT
);

CREATE TABLE IF NOT EXISTS equipos_device (
  device_type TEXT PRIMARY KEY CHECK(device_type IN ('lumify', 'ekg', 'ultrasound')),
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'in_use', 'alert')),
  holder_name TEXT,
  holder_rotation TEXT,
  previous_holder_name TEXT,
  previous_holder_rotation TEXT,
  checked_out_at TEXT,
  charge_pct INTEGER,
  gel_empty INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipos_waitlist (
  id TEXT PRIMARY KEY,
  device_type TEXT NOT NULL CHECK(device_type IN ('lumify', 'ekg', 'ultrasound')),
  reporter_name TEXT NOT NULL,
  rotation TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_equipos_waitlist_device ON equipos_waitlist(device_type, position);

CREATE TABLE IF NOT EXISTS equipos_sessions (
  id TEXT PRIMARY KEY,
  device_type TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  holder_rotation TEXT NOT NULL,
  checked_out_at TEXT NOT NULL,
  returned_at TEXT,
  duration_seconds INTEGER,
  closed_reason TEXT CHECK(closed_reason IN ('return', 'admin_purge', 'admin_force_return')),
  lumify_pickup_charge_pct INTEGER,
  lumify_charge_pct INTEGER,
  lumify_gel_empty INTEGER,
  pickup_photo_id TEXT,
  return_photo_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_equipos_sessions_device ON equipos_sessions(device_type, checked_out_at);

CREATE TABLE IF NOT EXISTS equipos_team_reports (
  id TEXT PRIMARY KEY,
  device_type TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('missing_material', 'malfunction')),
  message TEXT,
  reporter_name TEXT NOT NULL,
  rotation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  acknowledged_by_name TEXT,
  acknowledged_by_rotation TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  photo_id TEXT
);

CREATE TABLE IF NOT EXISTS equipos_events (
  id TEXT PRIMARY KEY,
  device_type TEXT,
  event_type TEXT NOT NULL,
  reporter_name TEXT,
  rotation TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_equipos_events_created ON equipos_events(created_at);

CREATE TABLE IF NOT EXISTS equipos_photos (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  report_id TEXT,
  device_type TEXT NOT NULL,
  photo_kind TEXT NOT NULL CHECK(photo_kind IN ('pickup', 'return', 'alert')),
  file_path TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

INSERT OR IGNORE INTO equipos_program_access (id, access_token, is_active)
VALUES (1, '', 0);

INSERT OR IGNORE INTO equipos_device (device_type, status, updated_at) VALUES
  ('lumify', 'available', datetime('now')),
  ('ekg', 'available', datetime('now')),
  ('ultrasound', 'available', datetime('now'));
