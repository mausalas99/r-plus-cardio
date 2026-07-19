import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertPocusDay, getPocusDay, emptyCongestionChecklist } from './congestion.mjs';

test('upsertPocusDay replaces same calendar day', () => {
  let hist = [];
  hist = upsertPocusDay(hist, {
    date: '2026-03-14',
    vciCm: 1.96,
    vexus: 0,
    congestionScore: 3,
    lungPattern: 'B',
    stevenson: 'A',
    note: '',
  });
  hist = upsertPocusDay(hist, {
    date: '2026-03-14',
    vciCm: 1.9,
    vexus: 0,
    congestionScore: 2,
    lungPattern: 'B',
    stevenson: 'A',
    note: 'update',
  });
  assert.equal(hist.length, 1);
  assert.equal(getPocusDay(hist, '2026-03-14').congestionScore, 2);
});

test('emptyCongestionChecklist has selector fields', () => {
  const c = emptyCongestionChecklist();
  assert.equal(c.pvy, null);
  assert.equal(c.soplo, null);
  assert.ok('estertores' in c);
});
