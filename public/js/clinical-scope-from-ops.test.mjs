import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildClinicalScopeContextFromOpsSnapshot,
  resolveClinicalUserRowFromOpsSnapshot,
} from './clinical-scope-from-ops.mjs';
import { evaluateClinicalScope } from './clinico-access.mjs';
import { patientForScopeEvaluate } from './features/patients-clinical-filter.mjs';

/** Scope rules under test — bypass TEMP_DISABLE_TEAM_BASED_FILTERING in isPatientReadableInClinicalScope. */
function isReadableInScope(user, patient, activeGuardia, context) {
  return evaluateClinicalScope(user, patient, activeGuardia, context).readable === true;
}

const snapshot = {
  clinical_users: [
    {
      user_id: 'u-r1',
      username: 'jperez',
      rank: 'R1',
      sala: 'Sala 2',
      clinical_name: 'Dr. Perez',
    },
  ],
  teams: [
    {
      team_id: 'team-a',
      name: 'Equipo A',
      service: 'Sala',
      sala: 'Sala 2',
      created_by: 'u-r1',
    },
    {
      team_id: 'team-b',
      name: 'Equipo B',
      service: 'Sala',
      sala: 'Sala 2',
      created_by: 'u-other',
    },
  ],
  team_membership: [
    { team_id: 'team-a', user_id: 'u-r1' },
    { team_id: 'team-b', user_id: 'u-other' },
  ],
  patient_team_assignment: [
    { patient_id: 'p-mine', team_id: 'team-a', effective_at: '2026-01-01T00:00:00.000Z' },
    { patient_id: 'p-other', team_id: 'team-b', effective_at: '2026-01-01T00:00:00.000Z' },
  ],
  team_guardia_today: [],
  active_guardias: [],
  rotation_cycles: [],
};

describe('clinical-scope-from-ops', () => {
  it('resolves session user_id from @username in clinical_users', () => {
    const row = resolveClinicalUserRowFromOpsSnapshot(snapshot, {
      userId: 'jperez',
      username: 'jperez',
    });
    assert.equal(row?.user_id, 'u-r1');
  });

  it('builds teams with members and filters patients by joined team', () => {
    const ctx = buildClinicalScopeContextFromOpsSnapshot(snapshot, {
      enforceTeamPatientScope: true,
    });
    assert.equal(ctx.teams.length, 2);
    assert.equal(ctx.teams[0].members.length, 1);
    const user = { user_id: 'u-r1', rank: 'R1', sala: 'Sala 2' };
    const mine = isReadableInScope(
      user,
      patientForScopeEvaluate({ id: 'p-mine', servicio: 'Sala', sala: 'Sala 2' }),
      null,
      ctx
    );
    const other = isReadableInScope(
      user,
      patientForScopeEvaluate({ id: 'p-other', servicio: 'Sala', sala: 'Sala 2' }),
      null,
      ctx
    );
    assert.equal(mine, true);
    assert.equal(other, false);
  });

  it('admin on mobile scope still filters by joined team', () => {
    const ctx = buildClinicalScopeContextFromOpsSnapshot(
      {
        ...snapshot,
        clinical_users: [
          {
            user_id: 'u-admin',
            username: 'admin1',
            rank: 'Admin',
            sala: 'Sala 2',
            is_program_admin: 1,
          },
        ],
        team_membership: [{ team_id: 'team-a', user_id: 'u-admin' }],
      },
      { enforceTeamPatientScope: true }
    );
    const user = { user_id: 'u-admin', rank: 'Admin', is_program_admin: 1, sala: 'Sala 2' };
    const mine = isReadableInScope(
      user,
      patientForScopeEvaluate({ id: 'p-mine', servicio: 'Sala', sala: 'Sala 2' }),
      null,
      ctx
    );
    const other = isReadableInScope(
      user,
      patientForScopeEvaluate({ id: 'p-other', servicio: 'Sala', sala: 'Sala 2' }),
      null,
      ctx
    );
    assert.equal(mine, true);
    assert.equal(other, false);
  });
});
