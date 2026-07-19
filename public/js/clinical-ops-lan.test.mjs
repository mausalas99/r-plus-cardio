import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalOpsMergeHadChanges } from './clinical-ops-lan.mjs';

describe('clinical-ops-lan', () => {
  it('clinicalOpsMergeHadChanges is false for empty or zero stats', () => {
    assert.equal(clinicalOpsMergeHadChanges(null), false);
    assert.equal(clinicalOpsMergeHadChanges({ usersInserted: 0, usersUpdated: 0 }), false);
  });

  it('clinicalOpsMergeHadChanges is true when any counter is positive', () => {
    assert.equal(clinicalOpsMergeHadChanges({ usersUpdated: 1 }), true);
    assert.equal(clinicalOpsMergeHadChanges({ stubsCreated: 2 }), true);
  });
});
