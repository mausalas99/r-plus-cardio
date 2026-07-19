import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stagePatientDelete,
  cancelStagedPatientDelete,
  hasStagedDelete,
  flushStagedPatientDeletes,
} from './patient-delete-sync.mjs';

test('stage and cancel before flush', () => {
  stagePatientDelete(
    'p1',
    { id: 'p1', registro: 'R1' },
    function () {
      assert.fail('should not commit');
    },
    60000
  );
  assert.equal(hasStagedDelete('p1'), true);
  cancelStagedPatientDelete('p1');
  assert.equal(hasStagedDelete('p1'), false);
});

test('flush commits', () => {
  let committed = false;
  stagePatientDelete('p2', { id: 'p2' }, function () {
    committed = true;
  }, 60000);
  flushStagedPatientDeletes();
  assert.equal(committed, true);
  assert.equal(hasStagedDelete('p2'), false);
});
