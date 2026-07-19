export function setAppMeta(db, key, value) {
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getAppMeta(db, key) {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row?.value ?? null;
}

export function assertCipherReadable(db) {
  db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
}
