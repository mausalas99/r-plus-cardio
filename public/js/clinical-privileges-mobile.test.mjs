import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  filterPatientsForClinicalSidebar,
} from './features/patients-clinical-filter.mjs';
import { shouldUseElevatedPatientCensus } from './clinical-privileges.mjs';

const scopeFixture = {
  teams: [
    {
      team_id: 't1',
      service: 'Sala',
      sub_area_fraction: 'B',
      sala: 'Sala 2',
      members: [{ user_id: 'u-admin' }],
    },
  ],
  assignments: [
    { patient_id: 'p-mine', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' },
    { patient_id: 'p-other', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
  ],
  guardias: [],
  cycle: null,
  enforceTeamPatientScope: true,
  now: '2026-06-02T12:00:00Z',
};

beforeEach(() => {
  globalThis.__RPC_MOBILE_WEB__ = true;
  globalThis.window = {};
});

afterEach(() => {
  delete globalThis.__RPC_MOBILE_WEB__;
  delete globalThis.window;
});

test('shouldUseElevatedPatientCensus is false on iPad even for Admin', () => {
  assert.equal(shouldUseElevatedPatientCensus({ rank: 'Admin' }), false);
  assert.equal(shouldUseElevatedPatientCensus({ rank: 'R4' }), false);
});

test('shouldUseElevatedPatientCensus is false on Safari LAN without mobile flag', () => {
  delete globalThis.__RPC_MOBILE_WEB__;
  assert.equal(shouldUseElevatedPatientCensus({ rank: 'Admin' }), false);
});

test('Admin on iPad sidebar filters by joined team', () => {
  const census = [
    { id: 'p-mine', servicio: 'Sala', area: 'Sala B', sala: 'Sala 2' },
    { id: 'p-other', servicio: 'Sala', area: 'Sala A', sala: 'Sala 2' },
  ];
  const out = filterPatientsForClinicalSidebar(
    census,
    { user_id: 'u-admin', rank: 'Admin', is_program_admin: 1, sala: 'Sala 2' },
    scopeFixture
  );
  assert.deepEqual(out.map((p) => p.id), ['p-mine']);
});

test('Admin on Safari LAN (no mobile flag) still filters by team assignment', () => {
  delete globalThis.__RPC_MOBILE_WEB__;
  const census = [
    { id: 'p-mine', servicio: 'Sala', area: 'Sala B', sala: 'Sala 2' },
    { id: 'p-reg', servicio: 'Sala', area: 'Sala B', sala: 'Sala 2', registeredByUserId: 'u-admin' },
    { id: 'p-other', servicio: 'Sala', area: 'Sala A', sala: 'Sala 2' },
  ];
  const out = filterPatientsForClinicalSidebar(
    census,
    { user_id: 'u-admin', rank: 'Admin', is_program_admin: 1, sala: 'Sala 2' },
    scopeFixture
  );
  assert.deepEqual(out.map((p) => p.id), ['p-mine']);
});

test('Admin on iPad without team membership does not get sala-wide census', () => {
  const census = [
    { id: 'p1', servicio: 'Sala', area: 'Sala A', sala: 'Sala 2' },
    { id: 'p2', servicio: 'Sala', area: 'Sala B', sala: 'Sala 2' },
  ];
  const out = filterPatientsForClinicalSidebar(
    census,
    { user_id: 'u-admin', rank: 'Admin', is_program_admin: 1, sala: 'Sala 2' },
    {
      teams: [],
      assignments: [],
      guardias: [],
      cycle: null,
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.deepEqual(out, []);
});
