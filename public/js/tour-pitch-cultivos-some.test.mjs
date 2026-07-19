import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  procesarLabs,
  extractSensCrudasForGermFromSource,
  buildAtbRisSummaryHtml,
  isParsedCultivoHeaderLine,
} from './labs.js';
import {
  PITCH_CULTIVO_ASPIRADO_1805_SOME,
  PITCH_CULTIVO_ASPIRADO_2804_SOME,
  PITCH_CULTIVO_LAB_SPECS,
} from './tour-pitch-cultivos-some.mjs';

function countCultivoTableRows(resLabs) {
  let n = 0;
  const joined = (resLabs || []).join('\n\n');
  joined.split(/\n\n+/).forEach(function (sec) {
    const lines = sec
      .split(/\r?\n/)
      .map(function (l) {
        return l.replace(/\*+$/g, '').trim();
      })
      .filter(Boolean);
    if (lines.length && isParsedCultivoHeaderLine(lines[0])) n += 1;
  });
  return n;
}

test('aspirado 18/05: dos organismos y chips ESBL para E. coli', () => {
  const { resLabs } = procesarLabs(PITCH_CULTIVO_ASPIRADO_1805_SOME);
  assert.ok(countCultivoTableRows(resLabs) >= 2);
  const sens = extractSensCrudasForGermFromSource(
    PITCH_CULTIVO_ASPIRADO_1805_SOME,
    'Escherichia coli'
  );
  assert.ok(sens && sens.length >= 10);
  const html = buildAtbRisSummaryHtml(sens);
  assert.match(html, /ESBL|cult-atb-ris/);
  const abau = extractSensCrudasForGermFromSource(
    PITCH_CULTIVO_ASPIRADO_1805_SOME,
    'Acinetobacter baumannii'
  );
  assert.ok(abau && abau.length >= 8);
});

test('aspirado 28/04: tres organismos en un informe', () => {
  const { resLabs } = procesarLabs(PITCH_CULTIVO_ASPIRADO_2804_SOME);
  assert.ok(countCultivoTableRows(resLabs) >= 3);
  assert.ok(
    extractSensCrudasForGermFromSource(PITCH_CULTIVO_ASPIRADO_2804_SOME, 'Staphylococcus aureus')
  );
  assert.ok(
    extractSensCrudasForGermFromSource(PITCH_CULTIVO_ASPIRADO_2804_SOME, 'Proteus mirabilis')
  );
});

test('PITCH_CULTIVO_LAB_SPECS: cinco informes de cultivo', () => {
  assert.equal(PITCH_CULTIVO_LAB_SPECS.length, 5);
});
