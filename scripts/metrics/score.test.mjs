import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTotalScore, fileLineOverageDebt } from './score.mjs';

test('fileLineOverageDebt charges over 600 lines', () => {
  assert.equal(fileLineOverageDebt(650), 2 * Math.ceil(50 / 10));
});

test('computeTotalScore sums components', () => {
  const total = computeTotalScore({
    complexityOverage: 10,
    lengthOverage: 4,
    duplicationDebt: 3,
    importSmellDebt: 0,
    bootGraphDebt: 25,
  });
  assert.equal(total, 42);
});
