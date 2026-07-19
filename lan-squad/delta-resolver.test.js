'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHostStore } = require('./host-store.js');
const { createDeltaResolver } = require('./delta-resolver.js');

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-delta-'));
  const store = createHostStore({
    filePath: path.join(dir, 'state.json'),
    teamCodePlain: '123456',
  });
  return { dir, store };
}

test('applyDelta creates fieldMeta and appends delta log entry', () => {
  const { store } = makeStore();
  const resolver = createDeltaResolver(store, { nowIso: () => '2026-06-05T20:45:10.000Z' });
  const out = resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
    clientId: 'lc_a',
    txId: 'tx_1',
    pathValues: { 'labsAtAdmission.na': 140 },
    pathMeta: { 'labsAtAdmission.na': { clientTimestamp: 1718293049283 } },
  });

  assert.equal(out.status, 'ok');
  assert.equal(out.deltaSeq, 1);
  assert.deepEqual(out.acceptedPaths, ['labsAtAdmission.na']);
  assert.deepEqual(out.rejectedPaths, []);

  const row = store.getEntity({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
  });
  assert.equal(row.data.labsAtAdmission.na, 140);
  assert.equal(row.fieldMeta['labsAtAdmission.na'].deltaSeq, 1);

  const replay = store.getRoomDeltaLog('room-a', 0);
  assert.equal(replay.ok, true);
  assert.equal(replay.deltas.length, 1);
  assert.equal(replay.deltas[0].txId, 'tx_1');
});

test('applyDelta partially accepts paths by per-path timestamp', () => {
  const { store } = makeStore();
  const resolver = createDeltaResolver(store, { nowIso: () => '2026-06-05T20:45:10.000Z' });

  resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
    clientId: 'lc_a',
    txId: 'tx_seed',
    pathValues: { 'labsAtAdmission.na': 138, plan: 'Plan A' },
    pathMeta: {
      'labsAtAdmission.na': { clientTimestamp: 100 },
      plan: { clientTimestamp: 200 },
    },
  });

  const out = resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
    clientId: 'lc_b',
    txId: 'tx_partial',
    pathValues: { 'labsAtAdmission.na': 140, plan: 'Older plan' },
    pathMeta: {
      'labsAtAdmission.na': { clientTimestamp: 300 },
      plan: { clientTimestamp: 150 },
    },
  });

  assert.equal(out.status, 'partial_success');
  assert.deepEqual(out.acceptedPaths, ['labsAtAdmission.na']);
  assert.deepEqual(out.rejectedPaths, ['plan']);

  const row = store.getEntity({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
  });
  assert.equal(row.data.labsAtAdmission.na, 140);
  assert.equal(row.data.plan, 'Plan A');
});

test('applyDelta returns stale_delta when all paths are older', () => {
  const { store } = makeStore();
  const resolver = createDeltaResolver(store, { nowIso: () => '2026-06-05T20:45:10.000Z' });
  resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'todo',
    entityId: 'todo_1',
    patientId: 'pat_1',
    clientId: 'lc_a',
    txId: 'tx_seed',
    pathValues: { text: 'Nueva indicación' },
    pathMeta: { text: { clientTimestamp: 200 } },
  });

  const out = resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'todo',
    entityId: 'todo_1',
    patientId: 'pat_1',
    clientId: 'lc_b',
    txId: 'tx_old',
    pathValues: { text: 'Vieja indicación' },
    pathMeta: { text: { clientTimestamp: 100 } },
  });

  assert.equal(out.status, 'stale_delta');
  assert.deepEqual(out.acceptedPaths, []);
  assert.deepEqual(out.rejectedPaths, ['text']);
});

test('applyDelta rejects invalid paths without mutating state', () => {
  const { store } = makeStore();
  const resolver = createDeltaResolver(store, { nowIso: () => '2026-06-05T20:45:10.000Z' });
  const out = resolver.applyDelta({
    roomId: 'room-a',
    entityType: 'historiaClinica',
    entityId: 'pat_1',
    patientId: 'pat_1',
    clientId: 'lc_a',
    txId: 'tx_bad',
    pathValues: { '__proto__.isAdmin': true, 'plan.0.text': 'wrong target' },
    pathMeta: {
      '__proto__.isAdmin': { clientTimestamp: 1 },
      'plan.0.text': { clientTimestamp: 1 },
    },
  });

  assert.equal(out.status, 'invalid_delta');
  assert.deepEqual(out.acceptedPaths, []);
  assert.deepEqual(out.rejectedPaths, ['__proto__.isAdmin', 'plan.0.text']);
  assert.equal(
    store.getEntity({ roomId: 'room-a', entityType: 'historiaClinica', entityId: 'pat_1', patientId: 'pat_1' }),
    null
  );
});
