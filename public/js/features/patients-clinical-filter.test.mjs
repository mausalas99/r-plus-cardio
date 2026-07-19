import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClinicalScope } from '../clinico-access.mjs';
import {
  applyElevatedPatientFilters,
  filterPatientsForClinicalSidebar,
  filterPatientsForGuardiaCensus,
  patientForScopeEvaluate,
  patientMatchesCensusTeamFilter,
  patientMatchesCensusSalaFilter,
} from './patients-clinical-filter.mjs';
import { CENSUS_TEAM_FILTER_UNASSIGNED } from './clinical-census-filters-ui.mjs';

/** Scope matrix under test — bypass TEMP_DISABLE_TEAM_BASED_FILTERING in sidebar filter. */
function filterPatientsByScopeRules(patients, user, scopeContext) {
  return (patients || []).filter((p) => {
    if (!p) return false;
    const mapped = patientForScopeEvaluate(p);
    return evaluateClinicalScope(user, mapped, null, scopeContext).readable === true;
  });
}

const userR1 = { user_id: 'u1', rank: 'R1', sala: 'Sala 1' };
const patients = [
  { id: 'p1', servicio: 'Sala', area: 'Sala A', sala: 'Sala 1' },
  { id: 'p2', servicio: 'Sala', area: 'Sala A', sala: 'Sala 2' },
];

test('R1 sidebar includes only same sala when not on a team', () => {
  const out = filterPatientsByScopeRules(patients, userR1, {
    teams: [],
    guardias: [],
    assignments: [],
    cycle: null,
    now: '2026-06-01T12:00:00Z',
  });
  assert.deepEqual(out.map((p) => p.id), ['p1']);
});

test('R1 on team sidebar excludes other team in same sala', () => {
  const census = [
    { id: 'p-mine', servicio: 'Sala', area: 'Sala B', sala: 'Sala 1' },
    { id: 'p-other', servicio: 'Sala', area: 'Sala A', sala: 'Sala 1' },
  ];
  const out = filterPatientsByScopeRules(census, userR1, {
    teams: [
      {
        team_id: 't1',
        service: 'Sala',
        sub_area_fraction: 'B',
        sala: 'Sala 1',
        members: [{ user_id: 'u1' }],
      },
    ],
    assignments: [
      { patient_id: 'p-mine', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' },
      { patient_id: 'p-other', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
    ],
    guardias: [],
    cycle: null,
    now: '2026-06-02T12:00:00Z',
  });
  assert.deepEqual(out.map((p) => p.id), ['p-mine']);
});

test('Admin guardia census includes all patients with Todos equipos filter on desktop', () => {
  const census = [
    { id: 'p1', servicio: 'Sala', area: 'Sala A', sala: 'Sala 1' },
    { id: 'p2', servicio: 'Sala', area: 'Sala B', sala: 'Sala 2' },
  ];
  const out = filterPatientsForGuardiaCensus(
    census,
    { user_id: 'admin', rank: 'Admin' },
    { teams: [], guardias: [], assignments: [], cycle: null, now: '2026-06-01T12:00:00Z' },
    null,
    { sala: '__all__', teamId: '', service: '' }
  );
  assert.equal(out.length, 2);
});

test('R4 sidebar includes all patients', () => {
  const out = filterPatientsForClinicalSidebar(
    patients,
    { user_id: 'r4', rank: 'R4', is_program_admin: 0 },
    { teams: [], guardias: [], assignments: [], cycle: null, now: '2026-06-01T12:00:00Z' }
  );
  assert.equal(out.length, 2);
});

test('team filter matches explicit patient_team_assignment', () => {
  const team = {
    team_id: 't1',
    name: 'Equipo A',
    service: 'Sala',
    sub_area_fraction: 'Z',
    sala: 'Sala 1',
  };
  const patient = { id: 'p1', servicio: 'Cardiología', area: '', sala: 'Sala 1' };
  const assignments = [
    { patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' },
  ];
  assert.equal(
    patientMatchesCensusTeamFilter(patient, 't1', [team], assignments, '2026-06-02T12:00:00Z'),
    true
  );
  const out = filterPatientsForGuardiaCensus(
    [patient, { id: 'p2', servicio: 'Sala', area: 'B', sala: 'Sala 1' }],
    { user_id: 'admin', rank: 'R1', is_program_admin: 1 },
    {
      teams: [team],
      guardias: [],
      assignments,
      cycle: null,
      now: '2026-06-02T12:00:00Z',
    },
    null,
    { sala: '__all__', teamId: 't1', service: '' }
  );
  assert.deepEqual(out.map((p) => p.id), ['p1']);
});

test('team filter matches structural Sala slice when unassigned', () => {
  const melissaTeam = {
    team_id: 't-melissa',
    name: 'Dra. Melissa',
    service: 'Sala',
    sub_area_fraction: 'A',
    sala: 'Sala 1',
  };
  const patient = { id: 'p1', servicio: 'Sala', area: 'A', sala: 'Sala 1' };
  const teams = [melissaTeam];
  assert.equal(
    patientMatchesCensusTeamFilter(patient, 't-melissa', teams, [], '2026-06-01T12:00:00Z'),
    true
  );
  const out = filterPatientsForGuardiaCensus(
    [patient, { id: 'p2', servicio: 'Sala', area: 'B', sala: 'Sala 1' }],
    { user_id: 'r4', rank: 'R4' },
    { teams, guardias: [], assignments: [], cycle: null, now: '2026-06-01T12:00:00Z' },
    null,
    { sala: '__all__', teamId: 't-melissa', service: '' }
  );
  assert.deepEqual(out.map((p) => p.id), ['p1']);
});

test('R4 elevated filter shows only patients without explicit team assignment', () => {
  const census = [
    { id: 'p-assigned', sala: 'Sala 1', servicio: 'Sala', _noExplicitTeamAssignment: false },
    { id: 'p-open', sala: 'Sala 1', servicio: 'Sala', _noExplicitTeamAssignment: true },
  ];
  const out = applyElevatedPatientFilters(census, {
    teamId: CENSUS_TEAM_FILTER_UNASSIGNED,
  });
  assert.deepEqual(out.map((p) => p.id), ['p-open']);
});

test('iPad Filtros censo narrows team-mirror sidebar by equipo', () => {
  globalThis.__RPC_MOBILE_WEB__ = true;
  globalThis.window = {};
  try {
    const team = {
      team_id: 't-melissa',
      name: 'Dra. Melissa',
      service: 'Sala',
      sub_area_fraction: 'A',
      sala: 'Sala 2',
      members: [{ user_id: 'u-admin' }],
    };
    const census = [
      { id: 'p-melissa', servicio: 'Sala', area: 'A', sala: 'Sala 2' },
      { id: 'p-other', servicio: 'Sala', area: 'B', sala: 'Sala 2' },
    ];
    const scope = {
      teams: [team],
      guardias: [],
      assignments: [
        { patient_id: 'p-melissa', team_id: 't-melissa', effective_at: '2026-06-01T00:00:00Z' },
        { patient_id: 'p-other', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
      ],
      cycle: null,
      now: '2026-06-02T12:00:00Z',
    };
    const user = { user_id: 'u-admin', rank: 'Admin', sala: 'Sala 2' };
    const mirrored = filterPatientsForGuardiaCensus(census, user, scope, null, {
      sala: '__all__',
      teamId: '',
      service: '',
    });
    assert.deepEqual(mirrored.map((p) => p.id), ['p-melissa']);
    const narrowed = filterPatientsForGuardiaCensus(census, user, scope, null, {
      sala: '__all__',
      teamId: 't-melissa',
      service: '',
    });
    assert.deepEqual(narrowed.map((p) => p.id), ['p-melissa']);
  } finally {
    delete globalThis.__RPC_MOBILE_WEB__;
    delete globalThis.window;
  }
});

test('R2 sidebar without team includes same-sala census', () => {
  const out = filterPatientsByScopeRules(
    patients,
    { user_id: 'r2', rank: 'R2', sala: 'Sala 1', is_program_admin: 0 },
    { teams: [], guardias: [], assignments: [], cycle: null, now: '2026-06-01T12:00:00Z' }
  );
  assert.deepEqual(out.map((p) => p.id), ['p1']);
});

test('Interconsultas sala filter includes patient assigned to Interconsultas team with UX stamp', () => {
  const icTeam = {
    team_id: 't-ic',
    name: 'Interconsultas A',
    service: 'Interconsultas',
    sub_area_fraction: 'A',
    sala: 'Interconsultas',
  };
  const patient = {
    id: 'p-ic',
    servicio: 'Cardiología',
    area: '',
    sala: 'UX',
  };
  const assignments = [
    { patient_id: 'p-ic', team_id: 't-ic', effective_at: '2026-06-01T00:00:00Z' },
  ];
  assert.equal(
    patientMatchesCensusSalaFilter(patient, 'Interconsultas', [icTeam], assignments, '2026-06-02T12:00:00Z'),
    true
  );
  const out = filterPatientsForGuardiaCensus(
    [patient],
    { user_id: 'admin', rank: 'Admin' },
    {
      teams: [icTeam],
      guardias: [],
      assignments,
      cycle: null,
      now: '2026-06-02T12:00:00Z',
    },
    null,
    { sala: 'Interconsultas', teamId: '', service: '' }
  );
  assert.deepEqual(out.map((p) => p.id), ['p-ic']);
});
