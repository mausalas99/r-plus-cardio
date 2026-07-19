'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareUpdatedAt, pickLwwRecord, mergeRecordsLww } = require('./lww-utils.js');

test('compareUpdatedAt prefers newer ISO', () => {
  assert.equal(compareUpdatedAt('2026-06-03T10:00:00.000Z', '2026-06-03T11:00:00.000Z'), -1);
  assert.equal(compareUpdatedAt('2026-06-03T12:00:00.000Z', '2026-06-03T11:00:00.000Z'), 1);
  assert.equal(compareUpdatedAt(null, '2026-06-03T11:00:00.000Z'), -1);
});

test('pickLwwRecord incoming wins on tie', () => {
  const a = { id: 't1', text: 'A', updatedAt: '2026-06-03T10:00:00.000Z' };
  const b = { id: 't1', text: 'B', updatedAt: '2026-06-03T10:00:00.000Z' };
  assert.equal(pickLwwRecord(a, b, 'incoming').text, 'B');
});

test('mergeRecordsLww merges object keys with per-field LWW for overlap', () => {
  const server = { cuarto: '201', cama: 'A', lanUpdatedAt: '2026-06-03T09:00:00.000Z' };
  const incoming = { cuarto: '102', lanUpdatedAt: '2026-06-03T10:00:00.000Z' };
  const { merged, overwrittenKeys } = mergeRecordsLww(server, incoming, {
    changedKeys: ['cuarto'],
    timestampFields: ['lanUpdatedAt', 'updatedAt'],
  });
  assert.equal(merged.cuarto, '102');
  assert.deepEqual(overwrittenKeys, ['cuarto']);
});
