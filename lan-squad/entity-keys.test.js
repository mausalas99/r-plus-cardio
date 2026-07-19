'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  agendaEntityKey,
  todoEntityKey,
  historiaClinicaEntityKey,
  collectKeysFromBundlePayload,
} = require('./entity-keys.js');

describe('entity-keys', () => {
  it('agendaEntityKey', () => {
    assert.equal(agendaEntityKey('e1'), 'a:e1');
  });
  it('todoEntityKey', () => {
    assert.equal(todoEntityKey('p1', 't1'), 't:p1:t1');
  });
  it('historiaClinicaEntityKey', () => {
    assert.equal(historiaClinicaEntityKey('p1'), 'hc:p1');
  });
  it('collectKeysFromBundlePayload', () => {
    const keys = collectKeysFromBundlePayload({
      agenda: [{ id: 'e1' }],
      todos: { p1: [{ id: 't1' }] },
      manejo: { customProtocols: [] },
    });
    assert.ok(keys.has('a:e1'));
    assert.ok(keys.has('t:p1:t1'));
    assert.ok(keys.has('manejo'));
  });
});
