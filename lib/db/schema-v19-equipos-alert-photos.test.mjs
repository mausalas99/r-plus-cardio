import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations, SCHEMA_VERSION } from './schema.mjs';

describe('schema v19 equipos alert photos', () => {
  it('supports alert photos on team reports', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    const reportCols = db.prepare('PRAGMA table_info(equipos_team_reports)').all().map((c) => c.name);
    assert.ok(reportCols.includes('photo_id'));
    const photoCols = db.prepare('PRAGMA table_info(equipos_photos)').all().map((c) => c.name);
    assert.ok(photoCols.includes('report_id'));
    db.prepare(
      `INSERT INTO equipos_photos (id, session_id, report_id, device_type, photo_kind, file_path, captured_at)
       VALUES ('p1', NULL, NULL, 'lumify', 'alert', '/tmp/a.jpg', '2026-01-01T00:00:00.000Z')`
    ).run();
    const v = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
    assert.equal(Number(v.value), SCHEMA_VERSION);
    assert.ok(SCHEMA_VERSION >= 19, 'v19 alert photos remain under current schema');
    db.close();
  });
});
