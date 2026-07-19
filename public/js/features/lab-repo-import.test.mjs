import { test } from 'node:test';
import assert from 'node:assert/strict';

const { labRepoFetchRangeFromDateInputs } = await import('./lab-repo-import.mjs');

test('labRepoFetchRangeFromDateInputs inclusive calendar days', () => {
  var range = labRepoFetchRangeFromDateInputs('2026-06-15', '2026-06-27');
  assert.ok(range);
  assert.equal(range.desde.getFullYear(), 2026);
  assert.equal(range.desde.getMonth(), 5);
  assert.equal(range.desde.getDate(), 15);
  assert.equal(range.desde.getHours(), 0);
  assert.equal(range.desde.getMinutes(), 0);
  assert.equal(range.hasta.getDate(), 27);
  assert.equal(range.hasta.getHours(), 23);
  assert.equal(range.hasta.getMinutes(), 59);
});

test('labRepoFetchRangeFromDateInputs rejects inverted range', () => {
  assert.equal(labRepoFetchRangeFromDateInputs('2026-06-27', '2026-06-15'), null);
});

test('labRepoFetchRangeFromDateInputs rejects invalid day', () => {
  assert.equal(labRepoFetchRangeFromDateInputs('2026-06-31', '2026-06-27'), null);
});
