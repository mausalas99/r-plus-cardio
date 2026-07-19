import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeBundleEntriesIntoCensus,
  upsertHostCensusPatient,
} from './host-patients-snapshot-merge.mjs';

describe('host-patients-snapshot merge', () => {
  it('adds flat bundle entries missing from host patients', () => {
    const byId = new Map();
    upsertHostCensusPatient(byId, { id: 'p1', nombre: 'Host', registro: 'R1' }, { bundleOnly: false });
    mergeBundleEntriesIntoCensus(byId, [
      { id: 'p2', name: 'Flat ghost', registro: 'R2' },
      { patient: { id: 'p3', nombre: 'Nested', registro: 'R3' } },
    ]);
    assert.equal(byId.size, 3);
    assert.equal(byId.get('p2')?.nombre, 'Flat ghost');
    assert.equal(byId.get('p2')?._bundleOnly, true);
    assert.equal(byId.get('p3')?.nombre, 'Nested');
  });

  it('host row clears bundle-only flag when same id', () => {
    const byId = new Map();
    mergeBundleEntriesIntoCensus(byId, [{ id: 'p1', name: 'Only bundle' }]);
    assert.equal(byId.get('p1')?._bundleOnly, true);
    upsertHostCensusPatient(byId, { id: 'p1', nombre: 'On host', registro: 'R1' }, { bundleOnly: false });
    assert.equal(byId.get('p1')?._bundleOnly, undefined);
  });

  it('preserves registeredByUserId when bundle row lacks it', () => {
    const byId = new Map();
    upsertHostCensusPatient(
      byId,
      { id: 'p1', nombre: 'Host', registeredByUserId: 'u1', registeredAt: '2026-06-01T00:00:00.000Z' },
      { bundleOnly: false }
    );
    mergeBundleEntriesIntoCensus(byId, [{ patient: { id: 'p1', nombre: 'Host updated' } }]);
    assert.equal(byId.get('p1')?.registeredByUserId, 'u1');
  });

  it('merges audit_log from bundle entry onto host row', () => {
    const byId = new Map();
    upsertHostCensusPatient(byId, { id: 'p1', nombre: 'Host' }, { bundleOnly: false });
    mergeBundleEntriesIntoCensus(byId, [
      {
        patient: {
          id: 'p1',
          audit_log: [{ action: 'patient.create', clientId: 'dev-b' }],
        },
      },
    ]);
    assert.equal(byId.get('p1')?.audit_log?.length, 1);
    assert.equal(byId.get('p1')?.audit_log?.[0]?.clientId, 'dev-b');
  });
});
