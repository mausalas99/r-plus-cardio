import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInsulinRescatesClause,
  parseInsulinRescateCriteria,
  patientHasInsulinRescatesInReceta,
  insulinRescateCriteriaFromRecetaBlock,
} from './estado-actual-glu-rescue.mjs';

test('parseInsulinRescateCriteria detecta rango glucosa + UI', () => {
  assert.deepEqual(parseInsulinRescateCriteria('180-220 4UI'), [{ minMgDl: 180, maxMgDl: 220, units: 4 }]);
  assert.deepEqual(parseInsulinRescateCriteria('221-250 MG/DL 6 UI'), [
    { minMgDl: 221, maxMgDl: 250, units: 6 },
  ]);
  assert.deepEqual(parseInsulinRescateCriteria('180–220: 4 UI, 221-250 6UI'), [
    { minMgDl: 180, maxMgDl: 220, units: 4 },
    { minMgDl: 221, maxMgDl: 250, units: 6 },
  ]);
  assert.equal(parseInsulinRescateCriteria('HIPOGLUCEMIA <70').length, 0);
});

test('parseInsulinRescateCriteria — formato SOME PRN (UI antes del rango)', () => {
  assert.deepEqual(
    parseInsulinRescateCriteria(
      '2 UI // CRITERIO PRN: EN CASO DE DESTROXTIS ENTRE 140 - 180'
    ),
    [{ minMgDl: 140, maxMgDl: 180, units: 2 }]
  );
  assert.deepEqual(
    parseInsulinRescateCriteria(
      '14 UI // CRITERIO PRN: EN CASO DE DESTROXTIS > 400'
    ),
    [{ minMgDl: 400, maxMgDl: 600, units: 14 }]
  );
});

test('patientHasInsulinRescatesInReceta lee escala en pasteRaw (CUIDADOS)', () => {
  assert.equal(
    patientHasInsulinRescatesInReceta({
      items: [],
      pasteRaw:
        '26/06/2026 07:17:48 a.m.\tCUIDADOS\tRESCATE DE INSULINA\t180-220 4 UI, 221-250 6 UI\tPOR TURNO\tNW',
    }),
    true
  );
  assert.equal(
    patientHasInsulinRescatesInReceta({
      items: [
        {
          nombreRaw: 'INSULINA GLARGINA 100 UI/ML SOL INY 3 ML',
          dosisRaw: '10 UI //',
          frecuenciaRaw: 'CADA 24 HORAS',
        },
      ],
      pasteRaw: '',
    }),
    false
  );
});

test('insulinRescateCriteriaFromRecetaBlock incluye dosis en meds parseados', () => {
  assert.deepEqual(
    insulinRescateCriteriaFromRecetaBlock({
      pasteRaw: '',
      items: [{ dosisRaw: 'ESCALA: 180-220 4UI; 251-300 8 UI' }],
    }),
    [
      { minMgDl: 180, maxMgDl: 220, units: 4 },
      { minMgDl: 251, maxMgDl: 300, units: 8 },
    ]
  );
});

test('formatInsulinRescatesClause sin glucometrías', () => {
  assert.equal(formatInsulinRescatesClause([]), '');
  assert.equal(formatInsulinRescatesClause(null), '');
});

test('formatInsulinRescatesClause omite disponibles sin escala SOME', () => {
  const clause = formatInsulinRescatesClause([{ value: 140, time: '08:00' }], { rescatesInSome: false });
  assert.equal(clause, '');
});

test('formatInsulinRescatesClause disponibles cuando hay escala SOME', () => {
  const clause = formatInsulinRescatesClause([{ value: 140, time: '08:00' }], { rescatesInSome: true });
  assert.equal(clause, 'RESCATES DE INSULINA DISPONIBLES');
});

test('formatInsulinRescatesClause aplicados van en glucometrías, no en cláusula aparte', () => {
  const clause = formatInsulinRescatesClause(
    [{ value: 220, time: '14:00', altered: true, rescueUnits: 4, postRescueValue: 168 }],
    { rescatesInSome: false }
  );
  assert.equal(clause, '');
});
