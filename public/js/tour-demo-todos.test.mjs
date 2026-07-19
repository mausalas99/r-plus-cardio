import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTourDemoTodosForPatient } from './tour-demo-todos.mjs';
import { DEMO_PATIENT_ID } from './tour-demo-patient.mjs';

test('buildTourDemoTodosForPatient devuelve pendientes clínicos', () => {
  const todos = buildTourDemoTodosForPatient(DEMO_PATIENT_ID);
  assert.ok(todos.length >= 4);
  assert.ok(todos.some(function (t) {
    return /BH|QS/i.test(t.text);
  }));
  assert.deepEqual(buildTourDemoTodosForPatient('otro'), []);
});
