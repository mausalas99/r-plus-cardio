import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from './storage.js';
import {
  buildPitchDemoTodosForPatient,
  seedPitchDemoTodos,
  clearPitchDemoTodos,
} from './tour-pitch-demo-todos.mjs';
import { PITCH_DEMO_PATIENT_ID } from './tour-pitch-demo-seed.mjs';

test('buildPitchDemoTodosForPatient: DEMO PÉREZ con pendientes abiertos', () => {
  const todos = buildPitchDemoTodosForPatient(PITCH_DEMO_PATIENT_ID);
  assert.ok(todos.length >= 5);
  assert.ok(todos.some((t) => !t.completed && t.priority === 'alta'));
  assert.ok(todos.some((t) => t.completed));
});

test('seedPitchDemoTodos persiste en rpc-todos (localStorage)', () => {
  const store = {};
  globalThis.localStorage = {
    getItem(k) {
      return store[k] ?? null;
    },
    setItem(k, v) {
      store[k] = String(v);
    },
  };
  clearPitchDemoTodos();
  seedPitchDemoTodos();
  const todos = storage.getTodos(PITCH_DEMO_PATIENT_ID);
  assert.ok(todos.length >= 5);
  assert.ok(todos.some((t) => /ATB|antibiograma/i.test(t.text)));
  clearPitchDemoTodos();
  delete globalThis.localStorage;
});
