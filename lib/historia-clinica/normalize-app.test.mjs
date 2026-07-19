import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppData } from './normalize-app.mjs';

test('normalize removes dedicated ids from conditions and migrates strings', () => {
  const app = normalizeAppData({
    conditions: ['diabetes', 'alergias', 'traumaticos'],
    alergias: 'Penicilina',
    traumaticos: 'Fractura 2010',
    transfusiones: '2 U CH, sin reacción',
  });
  assert.ok(app.conditions.indexOf('alergias') < 0);
  assert.equal(app.alergiaMedicamentos.length, 1);
  assert.equal(app.traumaticosEntries.length, 1);
  assert.equal(app.transfusionesEntries.length, 1);
  assert.equal(app.alergias, undefined);
});

test('normalize migrates medicamentos string to entries', () => {
  const app = normalizeAppData({
    medicamentosActuales: 'Metformina 850 mg c/12h',
  });
  assert.equal(app.medicamentosActuales.length, 1);
  assert.match(app.medicamentosActuales[0].medication, /Metformina/);
});
