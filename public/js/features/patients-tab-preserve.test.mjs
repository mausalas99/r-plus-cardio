import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateGranularInner } from '../expediente-tabs.mjs';

const SALA = { appMode: 'sala' };
const INTER = { appMode: 'interconsulta' };

/** Mirrors selectPatientCore tab policy when patientChanged is true. */
function innerAfterPatientSwitch(prevInner, settings) {
  return migrateGranularInner(prevInner || 'todo', settings);
}

describe('patient switch preserves expediente tab', () => {
  it('keeps estadoActual in sala when switching patients', () => {
    assert.equal(innerAfterPatientSwitch('estadoActual', SALA), 'estadoActual');
  });

  it('keeps tendencias when switching patients', () => {
    assert.equal(innerAfterPatientSwitch('tend', SALA), 'tend');
    assert.equal(innerAfterPatientSwitch('cult', INTER), 'cult');
  });

  it('only migrates invalid tabs for the current mode', () => {
    assert.equal(innerAfterPatientSwitch('estadoActual', INTER), 'todo');
    assert.equal(innerAfterPatientSwitch('notas', SALA), 'historia');
  });
});
