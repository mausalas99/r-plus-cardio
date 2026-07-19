import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import {
  GENESIS_PREVIOUS_HASH,
  hashPayload,
  computeBlockHash,
  verifyChainRows,
  appendAuditInTransaction,
} from './forensic-audit.mjs';

describe('forensic-audit', () => {
  it('genesis chain verifies', () => {
    const payloadHash = hashPayload({ action: 'init' });
    const current = computeBlockHash({
      id: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      client_id: 'desktop-host',
      event_type: 'system.migration.complete',
      payload_hash: payloadHash,
      previous_hash: GENESIS_PREVIOUS_HASH,
    });
    const rows = [{
      id: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      client_id: 'desktop-host',
      event_type: 'system.migration.complete',
      payload_hash: payloadHash,
      previous_hash: GENESIS_PREVIOUS_HASH,
      current_hash: current,
    }];
    assert.equal(verifyChainRows(rows), null);
  });

  it('tampered current_hash fails verify', () => {
    const payloadHash = hashPayload({ action: 'init' });
    const current = computeBlockHash({
      id: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      client_id: 'desktop-host',
      event_type: 'system.migration.complete',
      payload_hash: payloadHash,
      previous_hash: GENESIS_PREVIOUS_HASH,
    });
    const rows = [{
      id: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      client_id: 'desktop-host',
      event_type: 'system.migration.complete',
      payload_hash: payloadHash,
      previous_hash: GENESIS_PREVIOUS_HASH,
      current_hash: current + 'ff',
    }];
    assert.equal(verifyChainRows(rows), 1);
  });

  it('appendAuditInTransaction builds a valid chain', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE forensic_audit_chain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        client_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL
      );
    `);

    appendAuditInTransaction(db, {
      clientId: 'desktop-host',
      eventType: 'system.migration.complete',
      meta: { action: 'init' },
    });
    appendAuditInTransaction(db, {
      clientId: 'desktop-host',
      eventType: 'clinical.patients.save',
      meta: { changedKeys: ['patients'] },
    });

    const rows = db.prepare(
      'SELECT id, timestamp, client_id, event_type, payload_hash, previous_hash, current_hash FROM forensic_audit_chain ORDER BY id'
    ).all();
    assert.equal(rows.length, 2);
    assert.equal(verifyChainRows(rows), null);
    assert.equal(rows[0].previous_hash, GENESIS_PREVIOUS_HASH);
    assert.equal(rows[1].previous_hash, rows[0].current_hash);
    db.close();
  });
});
