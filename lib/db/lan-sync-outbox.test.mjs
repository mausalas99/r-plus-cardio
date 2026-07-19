import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations } from './schema.mjs';
import {
  countLanSyncOutbox,
  drainLanSyncOutbox,
  enqueueLanSyncOutbox,
  LAN_OUTBOX_MAX_PER_ROOM,
} from './lan-sync-outbox.mjs';

describe('lan-sync-outbox', () => {
  it('enforces max items per room (oldest dropped)', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    const roomId = 'sala-test';
    for (let i = 0; i < LAN_OUTBOX_MAX_PER_ROOM + 5; i += 1) {
      enqueueLanSyncOutbox(db, {
        roomId,
        kind: 'bundle',
        payload: { n: i },
      });
    }
    assert.equal(countLanSyncOutbox(db, { roomId }), LAN_OUTBOX_MAX_PER_ROOM);
    const items = drainLanSyncOutbox(db, { roomId });
    assert.equal(items.length, LAN_OUTBOX_MAX_PER_ROOM);
    assert.equal(items[0].payload.n, 5);
    assert.equal(items[items.length - 1].payload.n, LAN_OUTBOX_MAX_PER_ROOM + 4);
    db.close();
  });

  it('drain removes rows for room only', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    enqueueLanSyncOutbox(db, { roomId: 'a', kind: 'patch', payload: { x: 1 } });
    enqueueLanSyncOutbox(db, { roomId: 'b', kind: 'bundle', payload: { y: 2 } });
    const drained = drainLanSyncOutbox(db, { roomId: 'a' });
    assert.equal(drained.length, 1);
    assert.equal(countLanSyncOutbox(db, { roomId: 'a' }), 0);
    assert.equal(countLanSyncOutbox(db, { roomId: 'b' }), 1);
    db.close();
  });

  it('SQL outbox preserves delta kind', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    enqueueLanSyncOutbox(db, {
      roomId: 'room1',
      kind: 'delta',
      payload: { type: 'livesync:delta', delta: { txId: 'tx_1' } },
    });
    const rows = drainLanSyncOutbox(db, { roomId: 'room1' });
    assert.equal(rows[0].kind, 'delta');
    assert.equal(rows[0].payload.delta.txId, 'tx_1');
    db.close();
  });

  it('SQL outbox preserves command kind and restart-safe envelope', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    enqueueLanSyncOutbox(db, {
      roomId: 'room1',
      kind: 'command',
      payload: {
        commandId: 'cmd_1',
        domain: 'eventualidades',
        op: 'add',
        roomId: 'room1',
        clientId: 'lc_a',
        clientCreatedAt: 1718293049000,
        baseSeq: 0,
        payload: { eventualidadId: 'ev_1', text: 'Fiebre' },
      },
    });
    const rows = drainLanSyncOutbox(db, { roomId: 'room1' });
    assert.equal(rows[0].kind, 'command');
    assert.equal(rows[0].payload.commandId, 'cmd_1');
    assert.equal(rows[0].payload.domain, 'eventualidades');
    assert.equal(rows[0].payload.op, 'add');
    db.close();
  });
});
