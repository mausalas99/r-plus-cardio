import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations, SCHEMA_VERSION } from './schema.mjs';

describe('schema v21 clinical sala CHECK', () => {
  it('accepts Interconsultas, UX, and Eme on users.sala', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    const salas = ['Interconsultas', 'UX', 'Eme'];
    for (const sala of salas) {
      db.prepare(
        `INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala)
         VALUES (?, ?, 'x', 'R1', 'pk', 'epk', ?, ?)`
      ).run(`u-${sala}`, `dr_${sala.toLowerCase()}`, `Dr. ${sala}`, sala);
    }
    const rows = db.prepare('SELECT sala FROM users WHERE sala IN (?, ?, ?) ORDER BY sala').all(...salas);
    assert.deepEqual(
      rows.map((r) => r.sala),
      ['Eme', 'Interconsultas', 'UX']
    );
    const v = db.prepare(`SELECT value FROM app_meta WHERE key = 'schema_version'`).get();
    assert.equal(Number(v.value), SCHEMA_VERSION);
    assert.equal(SCHEMA_VERSION, 21);
    db.close();
  });

  it('upgrades v20 DB with stale sala CHECK', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    db.prepare(
      `INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala)
       VALUES ('u-stale', 'dr_stale', 'x', 'R1', 'pk', 'epk', 'Dr. Stale', 'Sala 1')`
    ).run();
    db.prepare("UPDATE app_meta SET value = '20' WHERE key = 'schema_version'").run();
    const staleCheck = "CHECK(sala IN ('Sala 1', 'Sala 2', 'Sala E', 'Torre HU', 'Área A/Pensionistas') OR sala IS NULL)";
    db.exec(`
      CREATE TABLE users_v20 (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        rank TEXT NOT NULL CHECK(rank IN ('R1', 'R2', 'R3', 'R4', 'Admin')),
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        clinical_name TEXT,
        sala TEXT ${staleCheck},
        is_program_admin INTEGER NOT NULL DEFAULT 0,
        last_activity_at TEXT
      );
      INSERT INTO users_v20 SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_v20 RENAME TO users;
    `);
    applyMigrations(db);
    assert.doesNotThrow(() => {
      db.prepare(`UPDATE users SET sala = 'Interconsultas' WHERE user_id = 'u-stale'`).run();
    });
    assert.equal(
      db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get().value,
      '21'
    );
    db.close();
  });
});
