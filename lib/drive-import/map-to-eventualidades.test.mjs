import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapSectionsToEventualidades } from './map-to-eventualidades.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(dir, 'fixtures/eventos-short.txt'), 'utf8');

test('mapSectionsToEventualidades parses dd/mm bullet days', () => {
  const { entries } = mapSectionsToEventualidades({
    eventualidadesBlocks: [sample],
    referenceYear: 2026,
  });
  assert.ok(entries.length >= 2);
  assert.match(entries[0].text, /HEMODIALISIS|HEMODIÁLISIS/i);
  assert.match(entries[0].at, /^2026-/);
});

test('ignores monitoreo lines inside eventualidades block', () => {
  const { entries } = mapSectionsToEventualidades({
    eventualidadesBlocks: ['23/05\nSE INDICA DIETA\nN: ALERTA\n24/05\nOTRO'],
    referenceYear: 2026,
  });
  assert.equal(entries.length, 2);
  assert.doesNotMatch(entries[0].text, /N: ALERTA/);
});
