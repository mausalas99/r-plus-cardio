import test from 'node:test';
import assert from 'node:assert/strict';
import {
  refreshTodoUIsForPatient,
  refreshTodoUIsForPatients,
} from './features/todos.mjs';

test('refreshTodoUIsForPatient — exported and no-op without patient id', () => {
  assert.equal(typeof refreshTodoUIsForPatient, 'function');
  assert.doesNotThrow(function () {
    refreshTodoUIsForPatient('');
    refreshTodoUIsForPatient(null);
  });
});

test('refreshTodoUIsForPatients — exported and no-op on empty input', () => {
  assert.equal(typeof refreshTodoUIsForPatients, 'function');
  assert.doesNotThrow(function () {
    refreshTodoUIsForPatients([]);
  });
});
