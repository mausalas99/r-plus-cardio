import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePatientFieldIds } from './ui-motion.mjs';

test('resolvePatientFieldIds — nombre desde lab', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Falta el nombre del paciente.', true),
    ['m-nombre']
  );
});

test('resolvePatientFieldIds — nombre manual', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Falta el nombre del paciente.', false),
    ['m-nombre-manual']
  );
});

test('resolvePatientFieldIds — edad', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Edad inválida', false),
    ['m-edad-num-manual']
  );
});

test('resolvePatientFieldIds — cuarto y cama', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Ingresa cuarto y cama', false),
    ['m-cuarto', 'm-cama']
  );
});

test('resolvePatientFieldIds — servicio en sala', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Ingresa Área / Servicio', true),
    ['m-servicio']
  );
});

test('resolvePatientFieldIds — área en interconsulta', () => {
  assert.deepEqual(
    resolvePatientFieldIds('Ingresa área / departamento', false),
    ['m-servicio', 'm-area']
  );
});
