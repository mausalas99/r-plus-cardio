import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueOutbox,
  drainOutbox,
  outboxSize,
  peekOutbox,
} from './live-sync-outbox.mjs';

function mockLocalStorage() {
  global.localStorage = {
    _d: {},
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = v;
    },
    removeItem(k) {
      delete this._d[k];
    },
  };
}

test('enqueue and drain per roomId', async () => {
  mockLocalStorage();
  await enqueueOutbox('room1', {
    kind: 'bundle',
    payload: { type: 'livesync:bundle', roomId: 'room1' },
  });
  assert.equal(await outboxSize('room1'), 1);
  assert.equal(await outboxSize('room2'), 0);
  const items = await drainOutbox('room1');
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'bundle');
  assert.equal(await outboxSize('room1'), 0);
});

test('peek does not drain', async () => {
  mockLocalStorage();
  await enqueueOutbox('r', { kind: 'patch', payload: { type: 'livesync:patch' } });
  assert.equal(peekOutbox('r').length, 1);
  assert.equal(await outboxSize('r'), 1);
});

test('enqueue clinical_ops kind round-trip', async () => {
  mockLocalStorage();
  await enqueueOutbox('room1', {
    kind: 'clinical_ops',
    payload: { snapshot: { teams: [] }, baseRevision: 0 },
  });
  const items = await drainOutbox('room1');
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'clinical_ops');
});

test('enqueue delta kind round-trip', async () => {
  mockLocalStorage();
  await enqueueOutbox('room1', {
    kind: 'delta',
    payload: { type: 'livesync:delta', delta: { txId: 'tx_1' } },
  });
  const items = await drainOutbox('room1');
  assert.equal(items[0].kind, 'delta');
  assert.equal(items[0].payload.delta.txId, 'tx_1');
});
