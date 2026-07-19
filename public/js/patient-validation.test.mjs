import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePatientForSave,
  buildExpedienteAdvice,
} from './patient-validation.mjs';

test('validatePatientForSave acepta paciente con expediente y nombre', () => {
  const r = validatePatientForSave({ nombre: 'JUAN', registro: '123', edadNum: '30', edadUnit: 'años' });
  assert.equal(r.ok, true);
  assert.equal(r.error, undefined);
  assert.equal(r.warning, undefined);
});

test('validatePatientForSave rechaza nombre vacío', () => {
  const r = validatePatientForSave({ nombre: '', registro: '123', edadNum: '30', edadUnit: 'años' });
  assert.equal(r.ok, false);
  assert.match(r.error, /nombre/i);
});

test('validatePatientForSave devuelve warning cuando falta expediente pero el resto es válido', () => {
  const r = validatePatientForSave({ nombre: 'JUAN', registro: '', edadNum: '30', edadUnit: 'años' });
  assert.equal(r.ok, true);
  assert.equal(r.warning, 'missing_expediente');
});

test('validatePatientForSave acepta expediente con espacios y los trimea implicitamente', () => {
  const r = validatePatientForSave({ nombre: 'JUAN', registro: '  ', edadNum: '30', edadUnit: 'años' });
  assert.equal(r.warning, 'missing_expediente');
});

test('validatePatientForSave rechaza edad no numérica', () => {
  const r = validatePatientForSave({ nombre: 'JUAN', registro: '1', edadNum: 'abc', edadUnit: 'años' });
  assert.equal(r.ok, false);
  assert.match(r.error, /edad/i);
});

test('validatePatientForSave acepta edad omitida (algunos pacientes legacy)', () => {
  const r = validatePatientForSave({ nombre: 'JUAN', registro: '1', edadNum: '', edadUnit: 'años' });
  assert.equal(r.ok, true);
});

test('buildExpedienteAdvice devuelve mensaje accionable', () => {
  const advice = buildExpedienteAdvice();
  assert.match(advice.title, /expediente/i);
  assert.match(advice.body, /copiar|copia/i);
  assert.match(advice.body, /Expediente/);
  assert.equal(typeof advice.confirmLabel, 'string');
  assert.equal(typeof advice.cancelLabel, 'string');
});
