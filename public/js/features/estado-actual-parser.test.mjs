import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEstadoActualPaste,
  parseGlucometriaToken,
  splitGlucoseList,
  parseIoEgresoFromText,
  formatEstadoActualParsePreview,
} from './estado-actual-parser.mjs';

const SAMPLE =
  'T°: 38.4 °C\n' +
  'FC: 112 LPM\n' +
  'FR: 18 RPM\n' +
  'TA: 130/80 MMHG\n' +
  'DXT: 190, 280, 221, 136 MG/DL\n' +
  'I: 645 CC\n' +
  'E: DIURESIS NO CUANTIFICADA\n' +
  'B: NC\n' +
  'EVAC: NC';

test('parseEstadoActualPaste — ejemplo completo en orden estándar', () => {
  const p = parseEstadoActualPaste(SAMPLE);
  assert.equal(p.ok, true);
  assert.equal(p.vitals.temp, 38.4);
  assert.equal(p.vitals.fc, 112);
  assert.equal(p.vitals.fr, 18);
  assert.equal(p.vitals.tas, 130);
  assert.equal(p.vitals.tad, 80);
  assert.equal(p.glucometrias.length, 4);
  assert.deepEqual(
    p.glucometrias.map((g) => g.value),
    [190, 280, 221, 136]
  );
  assert.equal(p.io.ing, 645);
  assert.equal(p.io.evac, 'NC');
  assert.equal(p.io.egrParts.length, 1);
  assert.equal(p.io.egrParts[0].value, 'NC');
  assert.ok(p.recognized.indexOf('balance-ignored') >= 0);
  const preview = formatEstadoActualParsePreview(p);
  assert.match(preview, /\b645 CC\b/);
  assert.match(preview, /MG\/DL/);
  assert.doesNotMatch(preview, /\bcc\b/);
});

test('parseEstadoActualPaste — líneas en orden distinto', () => {
  const p = parseEstadoActualPaste(
    'E: NC\nI: 500\nTA: 120/80\nT°: 37.2 °C 08:15\nDXT: 110@07:00, 95'
  );
  assert.equal(p.ok, true);
  assert.equal(p.io.egr, 'NC');
  assert.equal(p.io.ing, 500);
  assert.equal(p.vitals.tas, 120);
  assert.equal(p.vitals.temp, 37.2);
  assert.equal(p.alteredAt.temp, '08:15');
  assert.equal(p.glucometrias[0].value, 110);
  assert.equal(p.glucometrias[0].time, '07:00');
  assert.equal(p.glucometrias[1].value, 95);
});

test('parseGlucometriaToken y splitGlucoseList', () => {
  assert.deepEqual(parseGlucometriaToken('198@08:30'), { value: 198, time: '08:30' });
  assert.deepEqual(splitGlucoseList('198, 174, 101'), ['198', '174', '101']);
});

test('parseIoEgresoFromText — diuresis desde línea E', () => {
  assert.equal(parseIoEgresoFromText('NC'), 'NC');
  assert.equal(parseIoEgresoFromText('DIURESIS 300 CC'), 300);
  assert.equal(parseIoEgresoFromText('DIURESIS NO CUANTIFICADA'), 'NC');
});

test('parseEstadoActualPaste — variantes clínicas habituales', () => {
  const block =
    'T°: 38.7 °C\n' +
    'FC: 113 LPM\n' +
    'FR: 19 RPM\n' +
    'TA: 140/60 MMHG\n' +
    'DXT: 198, 174, 101, 252 MG/DL\n' +
    'SAT: 97% AL AIRE AMBIENTE\n' +
    'I: 2,815 CC\n' +
    'E: NO CUANTIFICADA\n' +
    'B: NC\n' +
    'EVAC: NO REPORTADAS';
  const p = parseEstadoActualPaste(block);
  assert.equal(p.vitals.sat, 97);
  assert.equal(p.soporteHint, 'Aire ambiente');
  assert.equal(p.io.ing, 2815);
  assert.equal(p.io.egrParts[0].value, 'NC');
  assert.equal(p.io.evac, 'NC');
  const preview = formatEstadoActualParsePreview(p);
  assert.match(preview, /SATURACION 97%.*AIRE AMBIENTE/);
  assert.match(preview, /DIURESIS NC/);
  assert.match(preview, /EVAC NC/);
});

test('parseEstadoActualPaste — saturación SAT y SATURACION', () => {
  const block =
    'T°: 36.8°C\n' +
    'FC: 84 LPM\n' +
    'FR: 14 RPM\n' +
    'TA: 140/80 MMHG\n' +
    'DXT: 227, 169, 238 MG/DL\n' +
    'SAT: 97%\n' +
    'I: 410 CC\n' +
    'E: DIURESIS NO CUANTIFICADA\n' +
    'B: NC\n' +
    'EVAC: NC';
  const p = parseEstadoActualPaste(block);
  assert.equal(p.vitals.sat, 97);
  assert.equal(p.vitals.temp, 36.8);
  assert.equal(p.io.ing, 410);

  const p2 = parseEstadoActualPaste('SATURACION: 95 %');
  assert.equal(p2.vitals.sat, 95);

  const preview = formatEstadoActualParsePreview(p);
  assert.match(preview, /SATURACION 97%/);
});
