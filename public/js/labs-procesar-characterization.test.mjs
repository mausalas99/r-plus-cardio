import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { procesarLabs } from './labs.js';
import { PROCESAR_LABS_FIXTURES } from './labs-procesar-fixtures.mjs';

const goldens = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'labs-procesar-goldens.json'), 'utf8')
);

test('goldens cover every fixture', () => {
  assert.deepEqual(Object.keys(goldens).sort(), Object.keys(PROCESAR_LABS_FIXTURES).sort());
});

for (const [name, texto] of Object.entries(PROCESAR_LABS_FIXTURES)) {
  test('procesarLabs characterization: ' + name, () => {
    const result = procesarLabs(texto);
    // JSON round-trip so undefined-vs-missing matches the golden exactly.
    assert.deepEqual(JSON.parse(JSON.stringify(result)), goldens[name]);
  });
}

test('characterization fixtures are not vacuous', () => {
  assert.ok(goldens.demoSome.resLabs.length >= 3, 'demoSome must parse multiple sections');
  assert.ok(goldens.gasoVenosaSolo.resLabs.length >= 1, 'gaso fixture must parse GASES');
  assert.equal(goldens.headerVariants.patient.sexo, 'F');
  assert.match(goldens.headerVariants.patient.edad, /8 meses/);
});
