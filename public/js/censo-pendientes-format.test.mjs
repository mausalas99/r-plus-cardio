import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPendientesForCenso } from './censo-pendientes-format.mjs';

test('formatPendientesForCenso — hasta 3 alta si existen', () => {
  var lines = formatPendientesForCenso([
    { text: 'Alta 1', completed: false, priority: 'alta' },
    { text: 'Alta 2', completed: false, priority: 'alta' },
    { text: 'Alta 3', completed: false, priority: 'alta' },
    { text: 'Alta 4', completed: false, priority: 'alta' },
    { text: 'Media 1', completed: false, priority: 'media' },
  ]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines, ['Alta 1', 'Alta 2', 'Alta 3']);
});

test('formatPendientesForCenso — sin alta usa media', () => {
  var lines = formatPendientesForCenso([
    { text: 'Media 1', completed: false, priority: 'media' },
    { text: 'Baja 1', completed: false, priority: 'baja' },
    { text: 'Media 2', completed: false, priority: 'media' },
  ]);
  assert.deepEqual(lines, ['Media 1', 'Media 2']);
  assert.doesNotMatch(lines.join(' '), /Baja/);
});

test('formatPendientesForCenso — sin alta ni media usa baja', () => {
  var lines = formatPendientesForCenso([
    { text: 'Baja 1', completed: false, priority: 'baja' },
    { text: 'Baja 2', completed: false, priority: 'baja' },
  ]);
  assert.deepEqual(lines, ['Baja 1', 'Baja 2']);
});

test('formatPendientesForCenso — texto completo sin recortar', () => {
  var long = 'Solicitar resonancia magnética de abdomen con contraste y valoración por gastroenterología';
  var lines = formatPendientesForCenso([
    { text: long, completed: false, priority: 'alta' },
  ]);
  assert.equal(lines[0], long);
});

test('formatPendientesForCenso — ignora completados', () => {
  assert.deepEqual(
    formatPendientesForCenso([{ text: 'Hecho', completed: true, priority: 'alta' }]),
    []
  );
});
