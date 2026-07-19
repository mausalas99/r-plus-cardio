import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEstadoActualCommand,
  buildEventualidadAddCommand,
  buildPendienteCommand,
} from './lan/orchestrator.mjs';

const base = {
  roomId: 'sala-1',
  patientId: 'pat_1',
  clientId: 'lc_a',
  baseSeq: 4,
  nowMs: () => 1718293049000,
  randomId: () => 'abc',
};

describe('LAN proof-domain command builders', () => {
  it('builds estadoActual update command', () => {
    const cmd = buildEstadoActualCommand({ ...base, path: 'signosVitales.fc', value: 110 });
    assert.equal(cmd.domain, 'estadoActual');
    assert.equal(cmd.op, 'updateField');
    assert.equal(cmd.payload.path, 'signosVitales.fc');
    assert.equal(cmd.payload.value, 110);
  });

  it('builds add-only eventualidades command', () => {
    const cmd = buildEventualidadAddCommand({
      ...base,
      eventualidadId: 'ev_1',
      text: 'Fiebre',
      at: '2026-06-06T12:00:00.000Z',
    });
    assert.equal(cmd.domain, 'eventualidades');
    assert.equal(cmd.op, 'add');
    assert.equal(cmd.payload.eventualidadId, 'ev_1');
  });

  it('builds pendientes add update complete commands', () => {
    assert.equal(buildPendienteCommand({ ...base, op: 'add', itemId: 'todo_1', text: 'Labs' }).op, 'add');
    assert.equal(
      buildPendienteCommand({ ...base, op: 'update', itemId: 'todo_1', text: 'Labs AM' }).op,
      'update'
    );
    assert.equal(buildPendienteCommand({ ...base, op: 'complete', itemId: 'todo_1' }).payload.completed, true);
  });
});
