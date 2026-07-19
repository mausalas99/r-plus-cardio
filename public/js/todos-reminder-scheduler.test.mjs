import test, { mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
const ls = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
};
global.localStorage = ls;
global.window = { localStorage: ls };

await import('./storage.js');
const {
  configureTodoReminderScheduler,
  rescheduleAllTodos,
  resetTodoReminderSchedulerForTests,
} = await import('./todos-reminder-scheduler.mjs');

const PATIENT = 'pat-1';
const NOW = new Date('2026-06-11T12:00:00.000Z');

function todo(overrides) {
  return {
    id: 'todo-1',
    text: 'Revisar labs',
    completed: false,
    priority: 'media',
    createdAt: NOW.toISOString(),
    dueDate: null,
    reminderAt: null,
    ...overrides,
  };
}

function seedTodos(todos) {
  store['rpc-todos'] = JSON.stringify({ [PATIENT]: todos });
}

beforeEach(() => {
  ls.clear();
  resetTodoReminderSchedulerForTests();
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
});

afterEach(() => {
  resetTodoReminderSchedulerForTests();
  mock.timers.reset();
});

test('schedules future reminder', () => {
  const notifications = [];
  configureTodoReminderScheduler({
    getPatientLabel: () => 'Juan Pérez',
    showToast: (msg) => notifications.push(msg),
    onNotify: (payload) => notifications.push(payload),
  });

  const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
  seedTodos([todo({ reminderAt: future })]);

  rescheduleAllTodos(PATIENT);
  assert.equal(notifications.length, 0);

  mock.timers.tick(60 * 60 * 1000);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0], 'Pendiente: Juan Pérez — Revisar labs');
  assert.equal(notifications[1].todo.id, 'todo-1');
});

test('fires immediately for past reminderAt', () => {
  const toasts = [];
  configureTodoReminderScheduler({
    getPatientLabel: () => 'Cama 12',
    showToast: (msg) => toasts.push(msg),
  });

  const past = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
  seedTodos([todo({ reminderAt: past })]);

  rescheduleAllTodos(PATIENT);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0], 'Pendiente: Cama 12 — Revisar labs');
});

test('cancel on reschedule clears old timeout', () => {
  const toasts = [];
  configureTodoReminderScheduler({
    getPatientLabel: () => 'Paciente',
    showToast: (msg) => toasts.push(msg),
  });

  const firstFuture = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
  seedTodos([todo({ reminderAt: firstFuture })]);
  rescheduleAllTodos(PATIENT);

  const secondFuture = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
  seedTodos([todo({ reminderAt: secondFuture })]);
  rescheduleAllTodos(PATIENT);

  mock.timers.tick(30 * 60 * 1000);
  assert.equal(toasts.length, 0);

  mock.timers.tick(90 * 60 * 1000);
  assert.equal(toasts.length, 1);
});

test('completed todos not scheduled', () => {
  const toasts = [];
  configureTodoReminderScheduler({
    showToast: (msg) => toasts.push(msg),
  });

  const past = new Date(NOW.getTime() - 60 * 1000).toISOString();
  seedTodos([todo({ reminderAt: past, completed: true })]);
  rescheduleAllTodos(PATIENT);

  assert.equal(toasts.length, 0);
  mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(toasts.length, 0);
});

test('rescheduleAllTodos without patientId scans rpc-todos keys', () => {
  const toasts = [];
  configureTodoReminderScheduler({
    getPatientLabel: (pid) => pid,
    showToast: (msg) => toasts.push(msg),
  });

  const past = new Date(NOW.getTime() - 1000).toISOString();
  store['rpc-todos'] = JSON.stringify({
    'pat-a': [todo({ id: 'a1', text: 'A', reminderAt: past })],
    'pat-b': [todo({ id: 'b1', text: 'B', reminderAt: past })],
  });

  rescheduleAllTodos();
  assert.equal(toasts.length, 2);
  assert.ok(toasts.some((m) => m.includes('pat-a')));
  assert.ok(toasts.some((m) => m.includes('pat-b')));
});
