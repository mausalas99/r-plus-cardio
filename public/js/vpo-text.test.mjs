import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVpoFullCopyText, formatRiskLines } from './vpo-text.mjs';

test('buildVpoFullCopyText orden institucional', () => {
  var t = buildVpoFullCopyText({
    ekgBlock: 'EKG',
    rxBlock: 'RX',
    diagnosticosBlock: 'DX',
    valoracionBlock: 'SE REALIZA VALORACIÓN PREOPERATORIA.\nLEE: 0',
  });
  assert.ok(t.indexOf('EKG') < t.indexOf('RX'));
  assert.ok(t.indexOf('RX') < t.indexOf('DX'));
  assert.ok(t.indexOf('VALORACIÓN') > t.indexOf('DX'));
});

test('formatRiskLines sin cálculo usa resultados de escalas documentados', () => {
  var lines = formatRiskLines(
    null,
    {
      scaleResults: {
        asa: 'ASA III',
        rcri: '2 puntos, clase II',
        gupta: '',
        ariscat: 'ARISCAT 26 pts, riesgo alto',
        caprini: 'Caprini 5, riesgo moderado',
      },
    },
    { noCalculatedRisk: true }
  );
  var joined = lines.join('\n');
  assert.match(joined, /ASA: ASA III/);
  assert.match(joined, /RCRI \(índice de Lee\): 2 puntos/);
  assert.match(joined, /Gupta MICA: —/);
  assert.doesNotMatch(joined, /LEE: \d+ PUNTOS/i);
  assert.doesNotMatch(joined, /GUPTA: \d+%/i);
});
