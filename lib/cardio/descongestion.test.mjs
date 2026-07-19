import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetweenInclusive,
  computeDescongestion,
  applyAcumuladoOverride,
  clearAcumuladoOverride,
} from './descongestion.mjs';

test('daysBetweenInclusive counts calendar days', () => {
  assert.equal(daysBetweenInclusive('2026-03-13', '2026-03-19'), 7);
  assert.equal(daysBetweenInclusive('2026-03-13', '2026-03-13'), 1);
});

test('computeDescongestion sums diuresis and uses furosemidaMg', () => {
  const r = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [2900, 2000, 1800, 1700, 1600, 1780, 2465],
    furosemidaAcumuladaMg: 800,
    overrides: {},
  });
  assert.equal(r.diasInternamiento, 7);
  assert.equal(r.diasDescongestion, 7);
  assert.equal(r.diuresisAcumuladaMl, 14245);
  assert.equal(r.furosemidaAcumuladaMg, 800);
});

test('override sticks until cleared', () => {
  let state = { overrides: {} };
  state = applyAcumuladoOverride(state, 'diuresisAcumuladaMl', 17245);
  const r = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [100],
    furosemidaAcumuladaMg: 10,
    overrides: state.overrides,
  });
  assert.equal(r.diuresisAcumuladaMl, 17245);
  state = clearAcumuladoOverride(state, 'diuresisAcumuladaMl');
  const r2 = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [100],
    furosemidaAcumuladaMg: 10,
    overrides: state.overrides,
  });
  assert.equal(r2.diuresisAcumuladaMl, 100);
});
