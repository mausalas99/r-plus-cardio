import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deltaLabelForPath,
  createDeltaEchoTracker,
  applyDeltaPathValues,
  withRemoteDeltaApply,
  isRemoteDeltaApplying,
} from './lan-delta-client.mjs';

test('deltaLabelForPath maps paths to Spanish labels', () => {
  assert.equal(deltaLabelForPath('historiaClinica', 'labsAtAdmission.na'), 'Sodio');
  assert.equal(deltaLabelForPath('historiaClinica', 'plan'), 'Plan');
  assert.equal(deltaLabelForPath('todo', 'text'), 'Pendiente');
  assert.equal(deltaLabelForPath('agenda', 'title'), 'Agenda');
});

test('echo tracker recognizes local txId once', () => {
  const tracker = createDeltaEchoTracker('lc_a');
  tracker.track('tx_1');
  assert.equal(tracker.isOwnEcho({ originClientId: 'lc_a', txId: 'tx_1' }), true);
  assert.equal(tracker.isOwnEcho({ originClientId: 'lc_a', txId: 'tx_1' }), false);
});

test('applyDeltaPathValues applies explicit null as field clear', () => {
  const data = { labsAtAdmission: { na: 140, k: 4.1 } };
  applyDeltaPathValues(data, { 'labsAtAdmission.na': null });
  assert.deepEqual(data, { labsAtAdmission: { k: 4.1 } });
});

test('withRemoteDeltaApply guards nested local save hooks', async () => {
  assert.equal(isRemoteDeltaApplying(), false);
  await withRemoteDeltaApply(async () => {
    assert.equal(isRemoteDeltaApplying(), true);
  });
  assert.equal(isRemoteDeltaApplying(), false);
});
