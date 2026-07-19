import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPatientFromBundleEntry } from './host-patients-bundle-entry.mjs';

describe('extractPatientFromBundleEntry', () => {
  it('reads nested patient', () => {
    const row = extractPatientFromBundleEntry({
      patient: { id: 'p1', nombre: 'A', registro: 'R1' },
      note: {},
    });
    assert.equal(row?.id, 'p1');
    assert.equal(row?.nombre, 'A');
  });

  it('reads flat entry id shape', () => {
    const row = extractPatientFromBundleEntry({
      id: 'p2',
      name: 'B flat',
      registro: 'R2',
      servicio: 'Sala 1',
    });
    assert.equal(row?.id, 'p2');
    assert.equal(row?.nombre, 'B flat');
  });

  it('skips demo ids', () => {
    assert.equal(extractPatientFromBundleEntry({ id: 'demo-x' }), null);
  });
});
