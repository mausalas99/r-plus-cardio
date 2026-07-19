import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCensoSignosColumn,
  formatCensoIoColumn,
  formatCensoSignosIoFromPatient,
} from './censo-signos-format.mjs';

test('formatCensoSignosColumn — líneas estructuradas', () => {
  var lines = formatCensoSignosColumn(
    {
      vitals: { temp: 38.7, fc: 113, fr: 19, tas: 140, tad: 60, sat: 97 },
      glucometrias: [{ value: 198 }, { value: 174 }, { value: 101 }, { value: 252 }],
    },
    { soporte: 'Aire ambiente' }
  );
  assert.deepEqual(lines, [
    'T°: 38.7 °C',
    'FC: 113 LPM',
    'FR: 19 RPM',
    'TA: 140/60 MMHG',
    'DXT: 198, 174, 101, 252 MG/DL',
    'SAT: 97% AL AIRE AMBIENTE',
  ]);
});

test('formatCensoIoColumn — ingresos, egresos NC, balance y evac', () => {
  var lines = formatCensoIoColumn(
    {
      ing: 2815,
      egr: 'NC',
      egrParts: [{ kind: 'diuresis', label: 'DIURESIS', value: 'NC' }],
      evac: 'NC',
    },
    NaN
  );
  assert.equal(lines[0], 'I: 2,815 CC');
  assert.equal(lines[1], 'E: NO CUANTIFICADA');
  assert.equal(lines[2], 'B: NC');
  assert.equal(lines[3], 'EVAC: NO REPORTADAS');
});

test('formatCensoIoColumn — evac numérico sin CC', () => {
  var lines = formatCensoIoColumn({ ing: 100, evac: 2 });
  var evacLine = lines.find(function (l) {
    return l.startsWith('EVAC:');
  });
  assert.equal(evacLine, 'EVAC: 2');
  assert.doesNotMatch(evacLine || '', /CC\b/);
});

test('formatCensoIoColumn — balance con diuresis NC y drenaje numérico', () => {
  var lines = formatCensoIoColumn(
    {
      ing: 645,
      egr: 'NC',
      egrParts: [
        { kind: 'diuresis', label: 'DIURESIS', value: 'NC' },
        { kind: 'drain', label: 'DRENAJE', value: 50 },
      ],
    },
    NaN
  );
  assert.equal(lines[2], 'B: +595 CC');
});

test('formatCensoSignosIoFromPatient — parsea textoGuardado', () => {
  var out = formatCensoSignosIoFromPatient({
    monitoreo: {
      historial: [],
      estadoClinico: { soporte: 'Aire ambiente' },
      textoGuardado: {
        text: 'T°: 37.2 °C\nFC: 88 LPM\nFR: 18 RPM\nTA: 120/80 MMHG\nDXT: 110 MG/DL\nSAT: 98% AL AIRE AMBIENTE\nI: 1500 CC\nE: NO CUANTIFICADA\nEVAC: NC',
        savedAt: null,
      },
    },
  });
  assert.match(out.signosCol, /T°: 37\.2/);
  assert.match(out.signosCol, /SAT: 98%/);
  assert.match(out.ioCol, /I: 1,500 CC/);
  assert.match(out.ioCol, /E: NO CUANTIFICADA/);
});
