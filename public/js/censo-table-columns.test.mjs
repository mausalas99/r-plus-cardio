import { test } from 'node:test';
import assert from 'node:assert/strict';
import { censoColumnPercents, CENSO_COL_WEIGHTS } from './censo-table-columns.mjs';

test('censoColumnPercents suma 100 y coincide con pesos', () => {
  var cols = censoColumnPercents();
  assert.equal(cols.length, CENSO_COL_WEIGHTS.length);
  var sum = cols.reduce(function (s, c) {
    return s + c.pct;
  }, 0);
  assert.ok(Math.abs(sum - 100) < 0.01);
});
