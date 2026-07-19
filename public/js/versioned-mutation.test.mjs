import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMutationBuilder,
  wrapLiveSyncPatch,
  createDeltaMutationBuilder,
  wrapLiveSyncDelta,
} from './versioned-mutation.mjs';

test('builder captures base and changedKeys', () => {
  const b = createMutationBuilder('todo', 't1');
  const m = b
    .captureBase({ id: 't1', text: 'a', version: 2, patientId: 'p1' })
    .set('text', 'b')
    .build({ roomId: 'r1', patientId: 'p1' });
  assert.deepStrictEqual(m.changedKeys, ['text']);
  assert.strictEqual(m.expectedVersion, 2);
  assert.strictEqual(m.data.text, 'b');
  assert.strictEqual(m.entityType, 'todo');
  assert.strictEqual(m.entityId, 't1');
  assert.deepStrictEqual(m.baseData, { id: 't1', text: 'a', version: 2, patientId: 'p1' });
});

test('wrapLiveSyncPatch builds livesync envelope', () => {
  const mutation = { entityType: 'patient', entityId: 'p1', expectedVersion: 1 };
  const patch = wrapLiveSyncPatch('room-1', 'client-abc', mutation);
  assert.deepStrictEqual(patch, {
    type: 'livesync:patch',
    roomId: 'room-1',
    clientId: 'client-abc',
    mutation,
  });
});

test('builder without captureBase uses expectedVersion 0', () => {
  const m = createMutationBuilder('agenda', 'ev1').set('title', 'x').build();
  assert.strictEqual(m.expectedVersion, 0);
  assert.strictEqual(m.baseData, null);
  assert.deepStrictEqual(m.changedKeys, ['title']);
});

test('delta builder captures pathValues, pathMeta, and txId', () => {
  const m = createDeltaMutationBuilder('historiaClinica', 'pat_1')
    .setPath('labsAtAdmission.na', 140, 1718293049283)
    .clearPath('labsAtAdmission.k', 1718293049290)
    .build({ roomId: 'room-a', patientId: 'pat_1', clientId: 'lc_a' });

  assert.equal(m.entityType, 'historiaClinica');
  assert.equal(m.entityId, 'pat_1');
  assert.equal(m.clientId, 'lc_a');
  assert.match(m.txId, /^tx_/);
  assert.deepEqual(m.pathValues, {
    'labsAtAdmission.na': 140,
    'labsAtAdmission.k': null,
  });
  assert.equal(m.pathMeta['labsAtAdmission.na'].clientTimestamp, 1718293049283);
  assert.equal(m.pathMeta['labsAtAdmission.k'].clientTimestamp, 1718293049290);
});

test('wrapLiveSyncDelta builds livesync delta envelope', () => {
  const delta = { entityType: 'todo', entityId: 't1', pathValues: {}, pathMeta: {}, txId: 'tx_1' };
  assert.deepEqual(wrapLiveSyncDelta('room-a', 'lc_a', delta), {
    type: 'livesync:delta',
    roomId: 'room-a',
    clientId: 'lc_a',
    delta,
  });
});
