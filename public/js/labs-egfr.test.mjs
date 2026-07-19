import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageYearsFromLabDemographics,
  buildEgfrPatientCtx,
  computeEgfrCkdEpi2021Creatinine,
  normalizePatientSexoForEgfr,
  parseQS_,
  procesarLabs,
} from './labs.js';

test('ageYearsFromLabDemographics convierte unidades comunes', () => {
  assert.equal(ageYearsFromLabDemographics('67', 'años'), 67);
  assert.ok(Math.abs(ageYearsFromLabDemographics('216', 'meses') - 18) < 0.02);
  assert.ok(ageYearsFromLabDemographics('', 'años') == null);
});

test('normalizePatientSexoForEgfr acepta valores del expediente', () => {
  assert.equal(normalizePatientSexoForEgfr('F'), 'F');
  assert.equal(normalizePatientSexoForEgfr('femenino'), 'F');
  assert.equal(normalizePatientSexoForEgfr('M'), 'M');
  assert.equal(normalizePatientSexoForEgfr(''), '');
});

test('computeEgfrCkdEpi2021Creatinine: valores plausibles (adultos)', () => {
  var gM = computeEgfrCkdEpi2021Creatinine(1.0, 50, false);
  assert.ok(gM > 60 && gM < 95, 'hombre 50 años Cr 1.0');
  var gF = computeEgfrCkdEpi2021Creatinine(0.9, 45, true);
  assert.ok(gF > 70 && gF < 110, 'mujer 45 años Cr 0.9');
  assert.equal(computeEgfrCkdEpi2021Creatinine(1.0, 17, false), null);
  assert.equal(computeEgfrCkdEpi2021Creatinine(-1, 40, false), null);
});

test('buildEgfrPatientCtx ignora sexo del SOME; usa expediente', () => {
  var ctx = buildEgfrPatientCtx('58', 'años', { sexo: 'F', edad: '57' });
  assert.equal(ctx.sexo, 'F');
  assert.equal(ctx.edad, '57');
  assert.equal(ctx.edadUnidad, 'años');
  assert.equal(buildEgfrPatientCtx('58', 'años', null), null);
});

test('parseQS_ añade eTFG después de Cr cuando hay edad y sexo del paciente', () => {
  var t =
    'QUIMICA SANGUINEA GLUCOSA EN SANGRE 95 mg/dL 70-110 CREATININA 1.0 mg/dL 0.7-1.2';
  var qs = parseQS_(t, { edad: '50', edadUnidad: 'años', sexo: 'M' });
  assert.match(qs, /^QS\t/);
  assert.match(qs, /\bCr\s+/);
  assert.match(qs, /\beTFG\s+\d+/);
});

test('procesarLabs: sin paciente en R+ no calcula eTFG aunque el SOME traiga sexo', () => {
  var raw = [
    'Nombre: PRUEBA PACIENTE',
    'Sexo: FEMENINO',
    'Edad: 58 años',
    'QUIMICA SANGUINEA',
    'GLUCOSA EN SANGRE 100 mg/dL',
    'CREATININA 1.05 mg/dL',
  ].join('\n');
  var r = procesarLabs(raw);
  var qsLine = (r.resLabs || []).find(function (l) {
    return String(l).startsWith('QS\t');
  });
  assert.ok(qsLine, 'debe existir línea QS');
  assert.doesNotMatch(String(qsLine), /\beTFG\s+\d+/);
});

test('procesarLabs: eTFG usa sexo del paciente, no del encabezado SOME', () => {
  var raw = [
    'Expediente: TEST-001',
    'Nombre: PRUEBA PACIENTE',
    'Sexo: MASCULINO',
    'Edad: 57 años',
    'QUIMICA SANGUINEA',
    'GLUCOSA EN SANGRE 100 mg/dL',
    'CREATININA EN SANGRE 1.4 mg/dL 0.7-1.2',
  ].join('\n');
  var r = procesarLabs(raw, { patient: { sexo: 'F', edad: '57' } });
  var qsLine = (r.resLabs || []).find(function (l) {
    return String(l).startsWith('QS\t');
  });
  assert.ok(qsLine, 'debe existir línea QS');
  assert.match(String(qsLine), /\beTFG\s+44\b/);
});
