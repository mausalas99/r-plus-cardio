import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLabsForCenso, formatLabsForCensoCompact } from './censo-labs-format.mjs';

test('formatLabsForCenso estructura por fecha', () => {
  var lines = formatLabsForCenso(
    [
      {
        fecha: '29/05/2026',
        parsedBySection: {
          BH: { Hb: '5.8*', Hto: '18*', Leu: '4200' },
          QS: { Glu: '145', Cr: '1.2' },
        },
        resLabs: [],
      },
    ],
    1
  );
  assert.ok(lines.some((l) => l.includes('29/05')));
  assert.ok(lines.some((l) => l.includes('BH ·') || l.includes('BH:')));
  assert.ok(lines.some((l) => l.includes('Hb 5.8')));
});

test('formatLabsForCensoCompact solo última fecha', () => {
  var lines = formatLabsForCensoCompact([
    { fecha: '28/05/2026', parsedBySection: { BH: { Hb: '6' } }, resLabs: [] },
    { fecha: '29/05/2026', parsedBySection: { BH: { Hb: '5.8*' } }, resLabs: [] },
  ]);
  assert.ok(lines.length >= 2);
  assert.equal(lines[0], '29/05/2026');
  assert.match(lines.join('\n'), /5\.8/);
  assert.doesNotMatch(lines.join('\n'), /28\/05/);
});

test('formatLabsForCensoCompact incluye resLabs completos del día', () => {
  var lines = formatLabsForCensoCompact([
    {
      fecha: '29/05/2026',
      resLabs: [
        'BH\nHb 5.8* g/dL\nHto 18* %',
        'QS\nGlu 145 mg/dL\nCr 1.2 mg/dL',
      ],
      parsedBySection: { BH: { Hb: '5.8*' } },
    },
  ]);
  assert.equal(lines[0], '29/05/2026');
  assert.ok(lines.some((l) => l.includes('Hb 5.8')));
  assert.ok(lines.some((l) => l.includes('Glu 145')));
  assert.ok(lines.some((l) => l.includes('Cr 1.2')));
  assert.ok(lines.some((l) => l === 'BH' || l.startsWith('BH ')));
});
