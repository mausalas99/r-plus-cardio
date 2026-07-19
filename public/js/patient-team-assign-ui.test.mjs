import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import {
  activePatientTeamId,
  buildPatientTeamAssignSectionHtml,
  defaultPatientRegistrationTeamId,
} from './patient-team-assign-ui.mjs';

describe('patient-team-assign-ui', () => {
  beforeEach(() => {
    clinicalSessionContext.user = { user_id: 'u1', rank: 'R2' };
    clinicalSessionContext.teams = [
      { team_id: 't1', name: 'Equipo A', members: [{ user_id: 'u1' }] },
    ];
    clinicalSessionContext.scopeContext = {
      teams: clinicalSessionContext.teams,
      assignments: [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' }],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    };
  });

  it('defaultPatientRegistrationTeamId picks sole joined team', () => {
    const user = { user_id: 'u1', sala: 'Sala 1' };
    assert.equal(defaultPatientRegistrationTeamId(user), 't1');
  });

  it('defaultPatientRegistrationTeamId prefers team in user sala', () => {
    clinicalSessionContext.teams = [
      { team_id: 't1', name: 'A', sala: 'Sala 2', members: [{ user_id: 'u1' }] },
      { team_id: 't2', name: 'B', sala: 'Sala 1', members: [{ user_id: 'u1' }] },
    ];
    const user = { user_id: 'u1', sala: 'Sala 1' };
    assert.equal(defaultPatientRegistrationTeamId(user), 't2');
  });

  it('shows team select with current team when patient is assigned', () => {
    const html = buildPatientTeamAssignSectionHtml({ id: 'p1' });
    assert.match(html, /patient-team-assign-select/);
    assert.match(html, /Equipo A/);
    assert.match(html, /Cambiar equipo/);
    assert.doesNotMatch(html, /field-readonly/);
  });

  it('shows assign select when patient has no team and user joined teams', () => {
    const html = buildPatientTeamAssignSectionHtml({ id: 'p2' });
    assert.match(html, /patient-team-assign-select/);
    assert.match(html, /Asignar a equipo/);
  });

  it('activePatientTeamId resolves latest active assignment', () => {
    assert.equal(activePatientTeamId('p1'), 't1');
    assert.equal(activePatientTeamId('p-missing'), '');
  });
});
