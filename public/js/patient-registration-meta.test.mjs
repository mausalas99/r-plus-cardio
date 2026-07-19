import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergePatientRegistrationMeta,
  stampPatientRegistrationMeta,
} from './patient-registration-meta.mjs';

describe('patient-registration-meta', () => {
  it('stamps registrar once', () => {
    const p = { id: 'p1' };
    stampPatientRegistrationMeta(p, { user_id: 'u1' });
    assert.equal(p.registeredByUserId, 'u1');
    assert.ok(p.registeredAt);
    stampPatientRegistrationMeta(p, { user_id: 'u2' });
    assert.equal(p.registeredByUserId, 'u1');
  });

  it('merge keeps first registrar', () => {
    const target = { registeredByUserId: 'u1', registeredAt: '2026-06-10T12:00:00.000Z' };
    mergePatientRegistrationMeta(target, {
      registeredByUserId: 'u2',
      registeredAt: '2026-06-09T12:00:00.000Z',
    });
    assert.equal(target.registeredByUserId, 'u1');
    assert.equal(target.registeredAt, '2026-06-09T12:00:00.000Z');
  });

  it('merge fills missing registrar from source', () => {
    const target = { id: 'p1' };
    mergePatientRegistrationMeta(target, {
      registeredByUserId: 'u9',
      registeredAt: '2026-06-08T08:00:00.000Z',
    });
    assert.equal(target.registeredByUserId, 'u9');
    assert.equal(target.registeredAt, '2026-06-08T08:00:00.000Z');
  });
});
