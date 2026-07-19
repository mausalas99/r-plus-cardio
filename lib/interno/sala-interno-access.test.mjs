import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations } from '../db/schema.mjs';
import { CLINICAL_SALA_VALUES } from '../clinical-salas.mjs';
import {
  listSalaInternoAccess,
  getSalaInternoAccess,
  rotateSalaInternoToken,
  setSalaInternoActive,
  verifySalaInternoToken,
} from '../db/clinical-access-db.mjs';

describe('sala interno access', () => {
  /** @type {import('better-sqlite3').Database} */
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
  });

  it('bootstraps a token per configured sala', () => {
    const rows = listSalaInternoAccess(db);
    assert.equal(rows.length, CLINICAL_SALA_VALUES.length);
    assert.ok(rows.every((r) => r.access_token && r.access_token.length >= 32));
    assert.ok(rows.every((r) => r.is_active === 1));
  });

  it('rotate and verify token', () => {
    const before = getSalaInternoAccess(db, 'Sala 1');
    const rotated = rotateSalaInternoToken(db, 'Sala 1', null);
    assert.notEqual(rotated.access_token, before.access_token);
    assert.equal(verifySalaInternoToken(db, rotated.access_token, 'Sala 1'), true);
    assert.equal(verifySalaInternoToken(db, before.access_token, 'Sala 1'), false);
  });

  it('deactivate blocks verify', () => {
    const row = getSalaInternoAccess(db, 'Sala 2');
    setSalaInternoActive(db, 'Sala 2', false);
    assert.equal(verifySalaInternoToken(db, row.access_token, 'Sala 2'), false);
  });
});
