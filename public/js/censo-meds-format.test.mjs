import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCensoMedsFromReceta } from './censo-meds-format.mjs';

test('formatCensoMedsFromReceta solo nombre y día', () => {
  var text = formatCensoMedsFromReceta({
    items: [
      {
        nombreRaw: 'Meropenem 1g',
        viaRaw: 'INTRAVENOSA',
        frecuenciaRaw: 'c/8h',
        dosisRaw: '1 g',
        diaTratamiento: 3,
        suspendido: false,
      },
    ],
  });
  assert.equal(text, 'MEROPENEM · Día 3');
  assert.doesNotMatch(text, /IV|c\/8h|1\s*g/i);
});

test('sin día solo nombre', () => {
  var text = formatCensoMedsFromReceta({
    items: [{ nombreRaw: 'Fenitoína 100mg', suspendido: false }],
  });
  assert.equal(text, 'FENITOÍNA');
});

test('omite suspendidos', () => {
  var text = formatCensoMedsFromReceta({
    items: [{ nombreRaw: 'X', suspendido: true }],
  });
  assert.equal(text, '');
});

test('bloque null devuelve vacío', () => {
  assert.equal(formatCensoMedsFromReceta(null), '');
});
