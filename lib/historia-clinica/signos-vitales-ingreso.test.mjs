import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSignosVitalesIngresoFromSnapshot,
  signosVitalesSnapshotHasData,
  resolveSignosVitalesIngresoBody,
} from './signos-vitales-ingreso.mjs';

test('formatSignosVitalesIngresoFromSnapshot builds uppercase line', () => {
  const text = formatSignosVitalesIngresoFromSnapshot(
    {
      vitals: { tas: 120, tad: 60, fc: 69, fr: 18, temp: 36.5, sat: 98 },
      alteredAt: {},
      glucometrias: [{ value: 142, time: '08:00' }],
    },
    { soporte: 'Aire ambiente' }
  );
  assert.match(text, /TA 120\/60/);
  assert.match(text, /SAT 98%/);
  assert.match(text, /DXT 142/);
  assert.equal(text, text.toUpperCase());
});

test('resolveSignosVitalesIngresoBody prefers monitoreo ctx', () => {
  assert.equal(
    resolveSignosVitalesIngresoBody(
      { signosVitalesIngreso: 'LEGACY' },
      { signosVitalesIngresoFromMonitoreo: 'FROM EA' }
    ),
    'FROM EA'
  );
  assert.equal(resolveSignosVitalesIngresoBody({ signosVitalesIngreso: 'LEGACY' }, {}), 'LEGACY');
});

test('signosVitalesSnapshotHasData is false when empty', () => {
  assert.equal(signosVitalesSnapshotHasData({ vitals: {} }), false);
});
