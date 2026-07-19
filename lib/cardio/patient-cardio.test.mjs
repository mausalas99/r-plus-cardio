import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCardio, ensureCardio } from './patient-cardio.mjs';
import { FANTASTICO_CLASSES } from './med-segments.mjs';

test('emptyCardio has IC defaults and four fantásticos', () => {
  const c = emptyCardio();
  assert.equal(c.inicioDescongestion, '');
  assert.deepEqual(c.overrides, {});
  assert.deepEqual(c.pocusByDay, []);
  assert.deepEqual(c.medSegments, []);
  assert.deepEqual(c.diureticSegments, []);
  assert.deepEqual(c.medCatalog, []);
  assert.equal(c.fantasticos.length, FANTASTICO_CLASSES.length);
});

test('ensureCardio creates blob when missing', () => {
  const patient = { id: 'p1' };
  ensureCardio(patient);
  assert.ok(patient.cardio);
  assert.equal(patient.cardio.inicioDescongestion, '');
  assert.equal(patient.cardio.fantasticos.length, 4);
});

test('ensureCardio preserves existing fields and backfills missing keys', () => {
  const patient = {
    id: 'p2',
    cardio: {
      inicioDescongestion: '2026-07-01',
      medSegments: [{ id: 'ms_1' }],
    },
  };
  ensureCardio(patient);
  assert.equal(patient.cardio.inicioDescongestion, '2026-07-01');
  assert.equal(patient.cardio.medSegments.length, 1);
  assert.ok(Array.isArray(patient.cardio.pocusByDay));
  assert.ok(Array.isArray(patient.cardio.fantasticos));
  assert.deepEqual(patient.cardio.overrides, {});
});
