import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  annotateLanHostPatientRows,
  isHostPatientOwnedByOtherClient,
  isInactiveHostPatientRow,
  isPurgeableHostCensusRow,
} from './host-patients-annotate.mjs';

describe('annotateLanHostPatientRows', () => {
  it('marks host-only rows as ghost and inactive', () => {
    const out = annotateLanHostPatientRows(
      [{ id: 'h1', nombre: 'Host only', registro: 'R1' }],
      [{ id: 'l1', nombre: 'Local', registro: 'R2' }]
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].status, 'ghost');
    assert.equal(out[0].inactive, true);
  });

  it('marks rows present locally as local and active', () => {
    const out = annotateLanHostPatientRows(
      [{ id: 'p1', nombre: 'Shared', registro: 'R9' }],
      [{ id: 'p1', nombre: 'Shared', registro: 'R9' }]
    );
    assert.equal(out[0].status, 'local');
    assert.equal(out[0].inactive, false);
  });

  it('marks archived local rows inactive', () => {
    assert.equal(isInactiveHostPatientRow({ id: 'p1' }, { id: 'p1', archived: true }, 'local'), true);
  });
});

describe('isPurgeableHostCensusRow', () => {
  it('includes bundle-only rows even when present locally', () => {
    const rows = annotateLanHostPatientRows(
      [{ id: 'p1', nombre: 'Local bundle stub', registro: 'R1', _bundleOnly: true }],
      [{ id: 'p1', nombre: 'Local bundle stub', registro: 'R1' }]
    );
    assert.equal(isPurgeableHostCensusRow(rows[0], 'dev-a'), true);
  });
});

describe('isHostPatientOwnedByOtherClient', () => {
  it('returns false when this client created the chart', () => {
    assert.equal(
      isHostPatientOwnedByOtherClient(
        { id: 'p1', audit_log: [{ action: 'patient.create', clientId: 'dev-a' }] },
        'dev-a'
      ),
      false
    );
  });

  it('returns true when another client created the chart', () => {
    assert.equal(
      isHostPatientOwnedByOtherClient(
        { id: 'p1', audit_log: [{ action: 'patient.create', clientId: 'dev-b' }] },
        'dev-a'
      ),
      true
    );
  });
});
