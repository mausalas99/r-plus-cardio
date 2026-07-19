'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCommandRegistry,
  STALE_BASE_SEQ_REQUIRES_SNAPSHOT,
} = require('./command-registry.js');

function registry() {
  return createCommandRegistry({ staleBaseSeqWindow: 150, nowMs: () => 1718293049000 });
}

test('validateCommand rejects missing required envelope fields', () => {
  const out = registry().validateCommand({
    domain: 'estadoActual',
    op: 'updateField',
    roomId: 'sala-1',
    clientId: 'lc_a',
    clientCreatedAt: 1718293048000,
    baseSeq: 1,
    payload: { path: 'signosVitales.fc', value: 110 },
  }, { latestDeltaSeq: 2 });

  assert.equal(out.ok, false);
  assert.equal(out.code, 'INVALID_COMMAND');
  assert.deepEqual(out.missing, ['commandId']);
});

test('validateCommand returns stale snapshot fallback when baseSeq is too old', () => {
  const out = registry().validateCommand({
    commandId: 'cmd_1',
    domain: 'estadoActual',
    op: 'updateField',
    roomId: 'sala-1',
    clientId: 'lc_a',
    clientCreatedAt: 1718293048000,
    baseSeq: 10,
    payload: { path: 'signosVitales.fc', value: 110 },
  }, { latestDeltaSeq: 161 });

  assert.equal(out.ok, false);
  assert.equal(out.code, STALE_BASE_SEQ_REQUIRES_SNAPSHOT);
  assert.equal(out.latestDeltaSeq, 161);
});

test('estadoActual updateField applies LWW by timestamp, clientId, then commandId', () => {
  const r = registry();
  const first = r.applyCommand({
    commandId: 'cmd_b',
    domain: 'estadoActual',
    op: 'updateField',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:estadoActual',
    clientId: 'lc_a',
    clientCreatedAt: 1000,
    baseSeq: 0,
    payload: { path: 'signosVitales.fc', value: 100 },
  }, { data: {}, meta: {} });
  const second = r.applyCommand({
    commandId: 'cmd_a',
    domain: 'estadoActual',
    op: 'updateField',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:estadoActual',
    clientId: 'lc_b',
    clientCreatedAt: 1000,
    baseSeq: 0,
    payload: { path: 'signosVitales.fc', value: 110 },
  }, { data: first.data, meta: first.meta });

  assert.equal(second.data.signosVitales.fc, 110);
  assert.deepEqual(second.changedPaths, ['signosVitales.fc']);
});

test('eventualidades add dedupes repeated stable ids as duplicate_ignored', () => {
  const r = registry();
  const seed = r.applyCommand({
    commandId: 'cmd_ev_1',
    domain: 'eventualidades',
    op: 'add',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:eventualidades',
    clientId: 'lc_a',
    clientCreatedAt: 1000,
    baseSeq: 0,
    payload: { eventualidadId: 'ev_1', at: '2026-06-06T12:00:00.000Z', text: 'Fiebre' },
  }, { data: {}, meta: {} });
  const duplicate = r.applyCommand({
    commandId: 'cmd_ev_2',
    domain: 'eventualidades',
    op: 'add',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:eventualidades',
    clientId: 'lc_a',
    clientCreatedAt: 1001,
    baseSeq: 0,
    payload: { eventualidadId: 'ev_1', at: '2026-06-06T12:00:00.000Z', text: 'Fiebre' },
  }, { data: seed.data, meta: seed.meta });

  assert.equal(duplicate.status, 'duplicate_ignored');
  assert.equal(duplicate.data.entries.length, 1);
});

test('pendientes add update complete converge by stable item id', () => {
  const r = registry();
  const add = r.applyCommand({
    commandId: 'cmd_t_1',
    domain: 'pendientes',
    op: 'add',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:pendientes',
    clientId: 'lc_a',
    clientCreatedAt: 1000,
    baseSeq: 0,
    payload: { itemId: 'todo_1', text: 'Labs', completed: false },
  }, { data: {}, meta: {} });
  const done = r.applyCommand({
    commandId: 'cmd_t_2',
    domain: 'pendientes',
    op: 'complete',
    roomId: 'sala-1',
    patientId: 'pat_1',
    entityId: 'pat_1:pendientes',
    clientId: 'lc_a',
    clientCreatedAt: 2000,
    baseSeq: 0,
    payload: { itemId: 'todo_1', completed: true },
  }, { data: add.data, meta: add.meta });

  assert.equal(done.data.items[0].id, 'todo_1');
  assert.equal(done.data.items[0].completed, true);
});
