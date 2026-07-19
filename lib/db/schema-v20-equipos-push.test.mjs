import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations, SCHEMA_VERSION } from './schema.mjs';

describe('schema v20 equipos push subscriptions', () => {
  it('creates equipos_push_subscriptions', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes('equipos_push_subscriptions'));
    const v = db.prepare(`SELECT value FROM app_meta WHERE key = 'schema_version'`).get();
    assert.equal(Number(v.value), SCHEMA_VERSION);
    assert.equal(SCHEMA_VERSION, 21);
    db.close();
  });
});
