import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanPatientDeleteSteps } from './lan-patient-delete-policy.mjs';

describe('resolveLanPatientDeleteSteps', () => {
  it('bundle-only tries census delete twice', () => {
    assert.deepEqual(resolveLanPatientDeleteSteps(false), ['census_delete', 'census_delete']);
  });

  it('host-only ghost purge uses census delete once', () => {
    assert.deepEqual(resolveLanPatientDeleteSteps(true, { hostOnly: true }), ['census_delete']);
    assert.deepEqual(resolveLanPatientDeleteSteps(false, { hostOnly: true }), ['census_delete']);
  });

  it('census row uses versioned then census then outbox', () => {
    assert.deepEqual(resolveLanPatientDeleteSteps(true), [
      'versioned_delete',
      'census_delete',
      'outbox_delete',
    ]);
  });
});
