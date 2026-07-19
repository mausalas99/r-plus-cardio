-- Equipos web push subscriptions (waitlist notifications)

CREATE TABLE IF NOT EXISTS equipos_push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  rotation TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('lumify', 'ekg', 'ultrasound')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(endpoint, device_type)
);
CREATE INDEX IF NOT EXISTS idx_equipos_push_waitlist
  ON equipos_push_subscriptions(device_type, reporter_name, rotation);
