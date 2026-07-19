import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextTodoPriority,
  normalizeTodoPriority,
  todoPriorityLabel,
} from './todos-priority.mjs';

test('normalizeTodoPriority — default media', () => {
  assert.equal(normalizeTodoPriority('x'), 'media');
  assert.equal(normalizeTodoPriority('alta'), 'alta');
});

test('nextTodoPriority — cycles alta → media → baja', () => {
  assert.equal(nextTodoPriority('alta'), 'media');
  assert.equal(nextTodoPriority('media'), 'baja');
  assert.equal(nextTodoPriority('baja'), 'alta');
});

test('todoPriorityLabel', () => {
  assert.equal(todoPriorityLabel('alta'), 'Alta');
  assert.equal(todoPriorityLabel('media'), 'Media');
  assert.equal(todoPriorityLabel('baja'), 'Baja');
});
