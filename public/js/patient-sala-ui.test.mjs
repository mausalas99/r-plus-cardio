import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRegistrationSalaDefault,
  buildPatientSalaFieldHtml,
} from './patient-sala-ui.mjs';

describe('patient-sala-ui', () => {
  it('resolveRegistrationSalaDefault prefers team sala over profile', () => {
    const teams = [{ team_id: 't-ux', sala: 'UX', service: 'UX' }];
    assert.equal(
      resolveRegistrationSalaDefault({ sala: 'Sala 1' }, 't-ux', teams),
      'UX'
    );
  });

  it('resolveRegistrationSalaDefault falls back to profile sala', () => {
    assert.equal(resolveRegistrationSalaDefault({ sala: 'UX' }, '', []), 'UX');
  });

  it('buildPatientSalaFieldHtml is empty in R+ Cardio (no LAN salas)', () => {
    const html = buildPatientSalaFieldHtml({ sala: 'UX' });
    assert.equal(html, '');
  });
});
