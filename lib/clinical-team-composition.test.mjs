import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTeamCompositionLimits,
  validateTeamRankSlot,
  OFF_CALL_INTERCONSULTAS_SERVICES,
} from './clinical-team-composition.mjs';

describe('clinical-team-composition', () => {
  it('interconsultas limits', () => {
    assert.deepEqual(getTeamCompositionLimits('Interconsultas'), { r1: 1, r2: 1, r3: 2 });
  });

  it('eme has no R2 slot', () => {
    const err = validateTeamRankSlot('Eme', 'R2', []);
    assert.match(err, /no participa/);
  });

  it('ux r3 slot full', () => {
    const members = [{ rank: 'R3' }];
    const err = validateTeamRankSlot('UX', 'R3', members);
    assert.match(err, /máximo/);
  });

  it('off-call services set', () => {
    assert.ok(OFF_CALL_INTERCONSULTAS_SERVICES.has('ux'));
    assert.ok(OFF_CALL_INTERCONSULTAS_SERVICES.has('eme'));
  });
});
