import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAge, formatDobForDocs } from './age-calc.mjs';

test('calculateAge en años: cumpleaños ya pasado', () => {
  const a = calculateAge('1968-05-07', new Date('2026-05-07T12:00:00Z'));
  assert.deepEqual(a, { value: 58, unit: 'años', display: '58 años' });
});

test('calculateAge en años: cumpleaños aún no llega', () => {
  const a = calculateAge('1968-12-31', new Date('2026-05-07T12:00:00Z'));
  assert.deepEqual(a, { value: 57, unit: 'años', display: '57 años' });
});

test('calculateAge en meses cuando edad < 1 año', () => {
  const a = calculateAge('2025-08-15', new Date('2026-05-07T12:00:00Z'));
  assert.deepEqual(a, { value: 8, unit: 'meses', display: '8 meses' });
});

test('calculateAge en días cuando edad < 1 mes', () => {
  const a = calculateAge('2026-05-01', new Date('2026-05-07T12:00:00Z'));
  assert.deepEqual(a, { value: 6, unit: 'días', display: '6 días' });
});

test('calculateAge devuelve null para DOB futuro', () => {
  assert.equal(calculateAge('2030-01-01', new Date('2026-05-07T12:00:00Z')), null);
});

test('calculateAge devuelve null para DOB > 120 años', () => {
  assert.equal(calculateAge('1900-01-01', new Date('2026-05-07T12:00:00Z')), null);
});

test('calculateAge devuelve null para input inválido', () => {
  assert.equal(calculateAge('', new Date()), null);
  assert.equal(calculateAge(null, new Date()), null);
  assert.equal(calculateAge('not-a-date', new Date()), null);
  assert.equal(calculateAge('2026-13-99', new Date()), null);
});

test('calculateAge usa UTC para no fluctuar por timezone (cumpleaños exacto)', () => {
  const a = calculateAge('1968-05-07', new Date('2026-05-07T01:00:00Z'));
  assert.equal(a.value, 58);
});

test('formatDobForDocs convierte ISO a DD/MM/YYYY', () => {
  assert.equal(formatDobForDocs('1968-05-07'), '07/05/1968');
});

test('formatDobForDocs devuelve "" para input inválido', () => {
  assert.equal(formatDobForDocs(''), '');
  assert.equal(formatDobForDocs(null), '');
  assert.equal(formatDobForDocs('bad'), '');
});
