'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHostStore } = require('./host-store.js');
const { createCommandResolver } = require('./command-resolver.js');

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-command-'));
  return {
    dir,
    store: createHostStore({ filePath: path.join(dir, 'state.json'), teamCodePlain: '123456' }),
  };
}

function estadoCommand(overrides = {}) {
  return {
    commandId: 'cmd_1',
    domain: 'estadoActual',
    op: 'updateField',
    roomId: 'room-a',
    patientId: 'pat_1',
    entityId: 'pat_1:estadoActual',
    clientId: 'lc_a',
    clientCreatedAt: 1718293049000,
    baseSeq: 0,
    payload: { path: 'signosVitales.fc', value: 110 },
    ...overrides,
  };
}

test('applyCommand assigns deltaSeq and appends command log before ack', () => {
  const { store } = makeStore();
  const resolver = createCommandResolver(store, { nowIso: () => '2026-06-06T14:34:10.000Z' });
  const out = resolver.applyCommand(estadoCommand());

  assert.equal(out.status, 'accepted');
  assert.equal(out.deltaSeq, 1);
  assert.equal(out.commandId, 'cmd_1');
  assert.equal(out.committedAt, '2026-06-06T14:34:10.000Z');

  const replay = store.getRoomDeltaLog('room-a', 0);
  assert.equal(replay.ok, true);
  assert.equal(replay.deltas.length, 1);
  assert.equal(replay.deltas[0].type, 'command');
  assert.equal(replay.deltas[0].commandId, 'cmd_1');
});

test('applyCommand returns duplicate_ignored for repeated commandId', () => {
  const { store } = makeStore();
  const resolver = createCommandResolver(store);
  const first = resolver.applyCommand(estadoCommand());
  const second = resolver.applyCommand(estadoCommand());

  assert.equal(first.status, 'accepted');
  assert.equal(second.status, 'duplicate_ignored');
  assert.equal(second.deltaSeq, first.deltaSeq);
  assert.equal(store.getRoomDeltaLog('room-a', 0).deltas.length, 1);
});

test('applyCommand returns stale_base_seq_requires_snapshot when baseSeq is too old', () => {
  const { store } = makeStore();
  const resolver = createCommandResolver(store);
  store.ensureRoomBundleForTest('room-a').deltaSeq = 200;

  const out = resolver.applyCommand(estadoCommand({ baseSeq: 49 }));

  assert.equal(out.ok, false);
  assert.equal(out.code, 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT');
  assert.equal(out.latestDeltaSeq, 200);
});
