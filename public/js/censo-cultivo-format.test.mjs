import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCultivosForCenso } from './censo-cultivo-format.mjs';

test('formatCultivosForCenso usa texto de copiar informe', () => {
  var chunk = [
    'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
    'ATB R: CAZ | I: FEP | S: CIPRO, IMI, LVX, MERO, PIP/TAZO, TOBRA',
    'Cuenta: +100 UFC',
  ].join('\n');
  var history = [
    {
      id: 'set-1',
      fecha: '07/05/2026',
      hora: '',
      resLabs: [chunk],
    },
  ];
  var out = formatCultivosForCenso(history);
  assert.match(out, /LIQUIDO PERITONEAL 07\/05: PSEUDOMONAS AERUGINOSA/);
  assert.doesNotMatch(out, /07\/05\/2026/);
  assert.match(out, /^ATB R:/m);
  assert.match(out, /Cuenta: \+100 UFC/);
});

test('formatCultivosForCenso detecta cultivo por encabezado de sitio en mayúsculas', () => {
  var chunk = [
    'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
    'ATB R: CAZ',
    'Cuenta: +100 UFC',
  ].join('\n');
  var history = [
    {
      id: 'set-caps',
      fecha: '07/05/2026',
      hora: '',
      resLabs: [chunk],
    },
  ];
  var out = formatCultivosForCenso(history);
  assert.match(out, /LIQUIDO PERITONEAL 07\/05: PSEUDOMONAS AERUGINOSA/);
});
