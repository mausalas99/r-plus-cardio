import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations, SCHEMA_VERSION } from './schema.mjs';

describe('schema v18 equipos', () => {
  it('includes equipos tables and seeds three devices', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes('equipos_device'));
    assert.ok(tables.includes('equipos_program_access'));
    assert.ok(tables.includes('equipos_sessions'));
    const count = db.prepare('SELECT COUNT(*) AS c FROM equipos_device').get().c;
    assert.equal(count, 3);
    const v = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
    assert.equal(Number(v.value), SCHEMA_VERSION);
    db.close();
  });
});
