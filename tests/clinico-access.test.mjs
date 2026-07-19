import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLINICO_UNLOCK_PHRASE,
  matchesClinicoUnlockPhrase,
  isClinicoUnlocked,
  isClinicoAccessHidden,
  evaluateClinicalScope,
  computeSalaAbcdefDeficitWrite,
  patientAssignedToTeam,
  patientCoveredByGuardia,
  getCycleConfig,
  getCycleLettersForTeamCreate,
  getCycleLetterOptionsForRank,
  usesSalaR1LinePicker,
  getCycleFieldMetaForTeamCreate,
  inferMembershipCycleForJoin,
  resolveMembershipCycleForUser,
  formatMemberCycleLabel,
  letterIndexForTeam,
  isOnCallToday,
  activeCycleLetterForDate,
  isMemberOnCallToday,
  isTeamRankOnCallToday,
  salaLetterForTeamOrArea,
  salaOnCallR1,
  salaOnCallR2,
  teamGuardiaOverride,
  stampPatientClinicalSala,
  migratePatientsClinicalSala,
  isInterconsultasPatient,
  userIsOnCallForLanHost,
  resolveR4GuardiaSectorLabel,
} from '../public/js/clinico-access.mjs';

test('resolveR4GuardiaSectorLabel maps Sala rows and Torre HU', () => {
  assert.equal(resolveR4GuardiaSectorLabel({ servicio: 'Sala', area: 'A' }), 'Sala A');
  assert.equal(resolveR4GuardiaSectorLabel({ service: 'Sala', sub_area: 'B' }), 'Sala B');
  assert.equal(resolveR4GuardiaSectorLabel({ servicio: 'Sala A' }), 'Sala A');
  assert.equal(resolveR4GuardiaSectorLabel({ servicio: 'Torre HU' }), 'Torre HU');
  assert.equal(resolveR4GuardiaSectorLabel({ servicio: 'Eme' }), 'Eme');
});

test('matchesClinicoUnlockPhrase accepts exact phrase', () => {
  assert.equal(matchesClinicoUnlockPhrase(CLINICO_UNLOCK_PHRASE), true);
});

test('matchesClinicoUnlockPhrase ignores case and accents', () => {
  assert.equal(matchesClinicoUnlockPhrase('Entiendo, usare mi criterio clincio'), true);
});

test('isClinicoAccessHidden is true until unlocked', () => {
  assert.equal(isClinicoAccessHidden({}), true);
  assert.equal(isClinicoAccessHidden({ hideManejoSection: false }), false);
});

test('isClinicoUnlocked respects clinicoUnlocked flag', () => {
  assert.equal(isClinicoUnlocked({ clinicoUnlocked: true, hideManejoSection: true }), true);
  assert.equal(
    isClinicoAccessHidden({ clinicoUnlocked: true, hideManejoSection: true }),
    true
  );
  assert.equal(
    isClinicoAccessHidden({ clinicoUnlocked: true, hideManejoSection: false }),
    false
  );
});

const emptyContext = {
  teams: [],
  guardias: [],
  cycle: null,
  assignments: [],
  salaGuardiaToday: [],
  guardiaMode: false,
  now: '2026-05-31T12:00:00Z',
};

test('evaluateClinicalScope default deny without team or handoff', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2' },
    { id: 'p1', service: 'Torre HU' },
    null,
    emptyContext
  );
  assert.equal(scope.readable, false);
  assert.equal(scope.writable, false);
});

test('patientAssignedToTeam returns true when patient is in assignments', () => {
  const assignments = [
    { patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' },
    { patient_id: 'p2', team_id: 't2', effective_at: '2026-06-01T00:00:00Z' },
  ];
  const joinedTeamIds = new Set(['t1']);
  assert.equal(
    patientAssignedToTeam('p1', assignments, joinedTeamIds, '2026-06-02T00:00:00Z'),
    true
  );
  assert.equal(
    patientAssignedToTeam('p2', assignments, joinedTeamIds, '2026-06-02T00:00:00Z'),
    false
  );
});

test('R2 with joined team only sees explicitly assigned patients', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2', sala: 'Sala 1' },
    { id: 'p-struct', service: 'Sala', sub_area: 'A' },
    null,
    {
      teams: [
        {
          team_id: 't1',
          service: 'Sala',
          sub_area_fraction: 'A',
          members: [{ user_id: 'r2' }],
        },
      ],
      assignments: [],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.equal(scope.readable, false);
});

test('patientAssignedToTeam uses latest assignment after reassignment', () => {
  const assignments = [
    { patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' },
    { patient_id: 'p1', team_id: 't2', effective_at: '2026-06-10T00:00:00Z' },
  ];
  assert.equal(
    patientAssignedToTeam('p1', assignments, new Set(['t1']), '2026-06-15T00:00:00Z'),
    false
  );
  assert.equal(
    patientAssignedToTeam('p1', assignments, new Set(['t2']), '2026-06-15T00:00:00Z'),
    true
  );
});

test('patientAssignedToTeam ignores future effective_at', () => {
  const assignments = [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-06-10T00:00:00Z' }];
  const joinedTeamIds = new Set(['t1']);
  assert.equal(
    patientAssignedToTeam('p1', assignments, joinedTeamIds, '2026-06-02T00:00:00Z'),
    false
  );
});

test('patientCoveredByGuardia returns true for matching patient and user', () => {
  const guardias = [
    { patient_id: 'p1', covering_user_id: 'u1' },
    { patient_id: 'p2', covering_user_id: 'u2' },
  ];
  assert.equal(patientCoveredByGuardia('p1', 'u1', guardias), true);
  assert.equal(patientCoveredByGuardia('p1', 'u2', guardias), false);
});

test('normal mode: R1 without team sees patient in same sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', service: 'Sala', sub_area: 'Sala B', sala: 'Sala 1' },
    null,
    {
      teams: [
        {
          team_id: 't-other',
          service: 'Sala',
          sub_area_fraction: 'A',
          sala: 'Sala 1',
          members: [{ user_id: 'other' }],
        },
      ],
      assignments: [],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, true);
  assert.match(scope.reasoning, /sala/i);
});

test('normal mode: R1 on team denies other team patient in same sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', service: 'Sala', sub_area: 'Sala A', sala: 'Sala 1' },
    null,
    {
      teams: [
        {
          team_id: 't-mine',
          service: 'Sala',
          sub_area_fraction: 'B',
          sala: 'Sala 1',
          members: [{ user_id: 'r1' }],
        },
        {
          team_id: 't-other',
          service: 'Sala',
          sub_area_fraction: 'A',
          sala: 'Sala 1',
          members: [{ user_id: 'other' }],
        },
      ],
      assignments: [
        { patient_id: 'p1', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
      ],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.equal(scope.readable, false);
});

test('normal mode: R1 on team sees assigned patient', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', service: 'Sala', sub_area: 'Sala B', sala: 'Sala 1' },
    null,
    {
      teams: [
        {
          team_id: 't-mine',
          service: 'Sala',
          sub_area_fraction: 'B',
          sala: 'Sala 1',
          members: [{ user_id: 'r1' }],
        },
      ],
      assignments: [
        { patient_id: 'p1', team_id: 't-mine', effective_at: '2026-06-01T00:00:00Z' },
      ],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.match(scope.reasoning, /equipo/i);
});

test('entrega phase: R1 sees other team patient in same sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', service: 'Sala', sub_area: 'Sala A', sala: 'Sala 1' },
    null,
    {
      teams: [
        {
          team_id: 't-mine',
          service: 'Sala',
          sub_area_fraction: 'B',
          sala: 'Sala 1',
          members: [{ user_id: 'r1' }],
        },
      ],
      assignments: [
        { patient_id: 'p1', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
      ],
      guardias: [],
      entregaPhaseActive: true,
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, false);
  assert.match(scope.reasoning, /entrega/i);
});

test('normal mode: R2 without team sees patient in same sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2', sala: 'Sala 2' },
    { id: 'p1', service: 'Sala', sala: 'Sala 2' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, true);
  assert.match(scope.reasoning, /sala/i);
});

test('stampPatientClinicalSala uses creator profile sala', () => {
  const patient = { id: 'p1', servicio: 'Sala', area: 'A' };
  stampPatientClinicalSala(patient, { sala: 'Sala 2' });
  assert.equal(patient.sala, 'Sala 2');
});

test('stampPatientClinicalSala prefers assigned team sala over creator profile', () => {
  const patient = { id: 'p-ic', servicio: 'Cardiología', area: '' };
  stampPatientClinicalSala(
    patient,
    { sala: 'UX' },
    {
      team: {
        team_id: 't-ic',
        service: 'Interconsultas',
        sala: 'Interconsultas',
      },
    }
  );
  assert.equal(patient.sala, 'Interconsultas');
});

test('resolveMembershipCycleForUser keeps saved member subcycle', () => {
  const team = {
    service: 'Sala',
    members: [{ user_id: 'u1', rank: 'R1', sub_area_fraction: 'D2' }],
  };
  assert.equal(resolveMembershipCycleForUser(team, 'u1', 'R1'), 'D2');
  assert.equal(resolveMembershipCycleForUser(team, 'u2', 'R1'), 'A1');
});

test('migratePatientsClinicalSala backfills only untagged charts', () => {
  const list = [
    { id: 'p1', servicio: 'Sala' },
    { id: 'p2', servicio: 'Sala', sala: 'Sala 1' },
    { id: 'demo-pitch', servicio: 'Sala', isDemo: true },
  ];
  const n = migratePatientsClinicalSala(list, { sala: 'Sala 2' });
  assert.equal(n, 1);
  assert.equal(list[0].sala, 'Sala 2');
  assert.equal(list[1].sala, 'Sala 1');
});

test('normal mode: R1 denied patient outside sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p2', service: 'Sala', sala: 'Sala 2' },
    null,
    {
      teams: [{ team_id: 't1', members: [{ user_id: 'r1' }] }],
      assignments: [{ patient_id: 'p1', team_id: 't1' }],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, false);
});

test('handoff: patient covered by guardia is visible for R2', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2x', rank: 'R2', sala: 'Sala 1' },
    { id: 'p1', service: 'Sala', sala: 'Sala 2' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [{ patient_id: 'p1', covering_user_id: 'r2x' }],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, true);
});

test('guardia mode R1: sees all in same Sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', sala: 'Sala 1' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [],
      guardiaMode: true,
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, false);
});

test('guardia mode R1: denied for different Sala', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', sala: 'Sala 2' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [],
      guardiaMode: true,
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, false);
});

test('guardia mode R2: sees handed-off patients', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2' },
    { id: 'p1' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [{ patient_id: 'p1', covering_user_id: 'r2' }],
      guardiaMode: true,
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, false);
});

test('guardia mode R1 on call: only handed-off patients', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1n', rank: 'R1', sala: 'Sala 1' },
    { id: 'p1', sala: 'Sala 1' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [{ patient_id: 'p1', covering_user_id: 'r1n' }],
      guardiaMode: true,
      onCallGuardiaReceiver: true,
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.reasoning, 'Modo Guardia R1: paciente entregado');
});

test('guardia mode R1 on call: denies sala patient without handoff', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1n', rank: 'R1', sala: 'Sala 1' },
    { id: 'p2', sala: 'Sala 1' },
    null,
    {
      teams: [],
      assignments: [],
      guardias: [],
      guardiaMode: true,
      onCallGuardiaReceiver: true,
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.readable, false);
});

test('guardia mode R4: sees Sala and Torre', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r4', rank: 'R4' },
    { id: 'p1', service: 'Sala' },
    null,
    { teams: [], assignments: [], guardias: [], guardiaMode: true, now: '2026-06-01T12:00:00Z' }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, false);
});

test('active guardia covering user has full access', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1', rank: 'R1' },
    { id: 'p1' },
    { covering_user_id: 'r1' },
    { teams: [], assignments: [], guardias: [], now: '2026-06-01T12:00:00Z' }
  );
  assert.equal(scope.writable, true);
});

test('incoming assignment is readable but not writable before effective_at', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2' },
    { id: 'p1', service: 'Sala A' },
    null,
    {
      teams: [{ team_id: 't1', service: 'Sala', sub_area_fraction: 'A', members: [] }],
      guardias: [],
      cycle: { preview_start_at: '2026-05-30T00:00:00Z', effective_at: '2026-06-01T00:00:00Z' },
      assignments: [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' }],
      salaGuardiaToday: [],
      now: '2026-05-31T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, false);
  assert.equal(scope.incomingPreview, true);
});

test('computeSalaAbcdefDeficitWrite is false when every Sala letter has Guardia', () => {
  const now = new Date('2026-06-01T12:00:00Z'); // day 1 → position 0 = A
  const teams = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => ({
    team_id: `team-${letter}`,
    service: 'Sala',
    sub_area_fraction: letter,
    members: [{ user_id: `u-${letter}` }],
  }));
  // Everyone on guardia today
  const salaGuardiaToday = teams.filter(t =>
    isOnCallToday(t, 'R2', now)
  ).map((t) => ({
    team_id: t.team_id,
    user_id: `u-${t.sub_area_fraction}`,
  }));
  assert.equal(computeSalaAbcdefDeficitWrite(salaGuardiaToday, teams, 'u2', now), false);
});

test('Admin has full write on non-incoming patients', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'admin', rank: 'Admin' },
    { id: 'p9', service: 'Torre HU' },
    null,
    emptyContext
  );
  assert.equal(scope.writable, true);
});

test('getCycleConfig returns Sala R2 config', () => {
  const cfg = getCycleConfig('Sala', 'R2');
  assert.deepEqual(cfg.letters, ['A','B','C','D','E','F']);
  assert.equal(cfg.length, 6);
});

test('getCycleConfig returns Sala R1 config', () => {
  const cfg = getCycleConfig('Sala', 'R1');
  assert.deepEqual(cfg.letters, ['A1','B1','C1','D1','A2','B2','C2','D2']);
  assert.equal(cfg.length, 8);
});

test('getCycleLettersForTeamCreate splits Sala R1 lines', () => {
  assert.deepEqual(getCycleLettersForTeamCreate('Sala', 'R1', 0), ['A1', 'B1', 'C1', 'D1']);
  assert.deepEqual(getCycleLettersForTeamCreate('Sala', 'R1', 1), ['A2', 'B2', 'C2', 'D2']);
  assert.deepEqual(getCycleLettersForTeamCreate('Sala', 'R2', 0), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('getCycleFieldMetaForTeamCreate describes R2 vs R1', () => {
  assert.match(getCycleFieldMetaForTeamCreate('Sala', 'R2').label, /R2/i);
  assert.match(getCycleFieldMetaForTeamCreate('Sala', 'R1', 1).label, /segunda/i);
});

test('inferMembershipCycleForJoin assigns free R1 subcycle', () => {
  const team = {
    service: 'Sala',
    members: [{ rank: 'R1', sub_area_fraction: 'D2' }],
  };
  assert.equal(inferMembershipCycleForJoin(team, 'R1'), 'A1');
});

test('formatMemberCycleLabel shows R1 subcycle', () => {
  assert.equal(
    formatMemberCycleLabel({ rank: 'R1', sub_area_fraction: 'D1' }),
    'Subciclo R1 · D1'
  );
});

test('getCycleConfig returns ABCD for non-Sala service', () => {
  const cfg = getCycleConfig('Eme', 'R2');
  assert.deepEqual(cfg.letters, ['A','B','C','D']);
  assert.equal(cfg.length, 4);
});

test('getCycleConfig returns ABCD for non-Sala any rank', () => {
  const cfg = getCycleConfig('Torre HU', 'R1');
  assert.deepEqual(cfg.letters, ['A','B','C','D']);
  assert.equal(cfg.length, 4);
});

test('getCycleConfig Torre HU R3 and R1 share ABCD letters', () => {
  assert.deepEqual(getCycleConfig('Torre HU', 'R3').letters, ['A', 'B', 'C', 'D']);
  assert.deepEqual(getCycleConfig('Torre HU', 'R1').letters, ['A', 'B', 'C', 'D']);
});

test('getCycleConfig Área A R2 and R1 share ABCD letters', () => {
  assert.deepEqual(getCycleConfig('Área A/Pensionistas', 'R2').letters, ['A', 'B', 'C', 'D']);
  assert.deepEqual(getCycleConfig('Área A/Pensionistas', 'R1').letters, ['A', 'B', 'C', 'D']);
});

test('getCycleLetterOptionsForRank uses ABCD for Torre HU join picker', () => {
  assert.deepEqual(getCycleLetterOptionsForRank('Torre HU', 'R1'), ['A', 'B', 'C', 'D']);
  assert.deepEqual(getCycleLetterOptionsForRank('Torre HU', 'R3'), ['A', 'B', 'C', 'D']);
});

test('usesSalaR1LinePicker false for Torre HU and Área A', () => {
  assert.equal(usesSalaR1LinePicker('Torre HU', 'Torre HU'), false);
  assert.equal(usesSalaR1LinePicker('Sala', 'Torre HU'), false);
  assert.equal(usesSalaR1LinePicker('Área A/Pensionistas', 'Área A/Pensionistas'), false);
  assert.equal(usesSalaR1LinePicker('Sala', 'Sala 1'), true);
});

test('getCycleLetterOptionsForRank keeps Sala R1 subcycles', () => {
  assert.deepEqual(getCycleLetterOptionsForRank('Sala', 'R1'), [
    'A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2',
  ]);
});

test('getCycleConfig normalizes service', () => {
  const cfg = getCycleConfig('Área A', 'R1');
  assert.equal(cfg.length, 4);
});

test('letterIndexForTeam returns correct index for Sala R2', () => {
  const team = { service: 'Sala', sub_area_fraction: 'C' };
  assert.equal(letterIndexForTeam(team, 'R2'), 2);
});

test('letterIndexForTeam returns correct index for Sala R1', () => {
  const team = { service: 'Sala', sub_area_fraction: 'A2' };
  assert.equal(letterIndexForTeam(team, 'R1'), 4);
});

test('letterIndexForTeam returns -1 for unknown fraction', () => {
  const team = { service: 'Sala', sub_area_fraction: 'Z' };
  assert.equal(letterIndexForTeam(team, 'R2'), -1);
});

test('letterIndexForTeam returns -1 when no sub_area_fraction', () => {
  const team = { service: 'Sala' };
  assert.equal(letterIndexForTeam(team, 'R2'), -1);
});

test('isOnCallToday returns true when dayOfMonth matches letter', () => {
  // Day 1 = position 0 = A for Sala R2
  const team = { service: 'Sala', sub_area_fraction: 'A' };
  const now = new Date('2026-06-01T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R2', now), true);
});

test('isOnCallToday returns false when dayOfMonth does not match', () => {
  // Day 2 = position 1 = B for Sala R2, team has A
  const team = { service: 'Sala', sub_area_fraction: 'A' };
  const now = new Date('2026-06-02T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R2', now), false);
});

test('isOnCallToday wraps around: day 7 = position 0 = A', () => {
  const team = { service: 'Sala', sub_area_fraction: 'A' };
  const now = new Date('2026-06-07T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R2', now), true);
});

test('isOnCallToday handles R1 A1 on day 1', () => {
  const team = { service: 'Sala', sub_area_fraction: 'A1' };
  const now = new Date('2026-06-01T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R1', now), true);
});

test('isOnCallToday handles R1 A2 on day 5', () => {
  const team = { service: 'Sala', sub_area_fraction: 'A2' };
  const now = new Date('2026-06-05T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R1', now), true);
});

test('activeCycleLetterForDate returns D2 on June 8 for Sala R1', () => {
  const now = new Date('2026-06-08T12:00:00Z');
  assert.equal(activeCycleLetterForDate('Sala', 'R1', now), 'D2');
});

test('isMemberOnCallToday uses membership subcycle not team letter', () => {
  const now = new Date('2026-06-08T12:00:00Z');
  const team = {
    team_id: 't-melissa',
    service: 'Sala',
    sub_area_fraction: 'A',
    members: [{ user_id: 'r1-mauri', rank: 'R1', sub_area_fraction: 'D2' }],
  };
  const member = team.members[0];
  assert.equal(isMemberOnCallToday(member, team, 'R1', now), true);
  assert.equal(isOnCallToday(team, 'R1', now), false);
  assert.equal(isTeamRankOnCallToday(team, 'R1', now), true);
});

test('salaOnCallR1 picks R1 by membership subcycle when team letter differs', () => {
  const now = new Date('2026-06-08T12:00:00Z');
  const teams = [
    {
      team_id: 't-melissa',
      sala: 'Sala 2',
      service: 'Sala',
      sub_area_fraction: 'A',
      members: [{ user_id: 'r1-mauri', rank: 'R1', sub_area_fraction: 'D2' }],
    },
    {
      team_id: 't-victor',
      sala: 'Sala 2',
      service: 'Sala',
      sub_area_fraction: 'B',
      members: [{ user_id: 'r1-esdras', rank: 'R1', sub_area_fraction: 'B1' }],
    },
  ];
  const result = salaOnCallR1(teams, 'Sala 2', now);
  assert.equal(result.length, 1);
  assert.equal(result[0].team_id, 't-melissa');
  assert.equal(result[0].user_id, 'r1-mauri');
});

test('salaLetterForTeamOrArea extracts A from A1', () => {
  const result = salaLetterForTeamOrArea({ sub_area_fraction: 'A1', service: 'Sala' });
  assert.equal(result, 'A');
});

test('salaLetterForTeamOrArea extracts B from B2', () => {
  const result = salaLetterForTeamOrArea({ sub_area_fraction: 'B2', service: 'Sala' });
  assert.equal(result, 'B');
});

test('isOnCallToday handles ABCD on day 1 = A', () => {
  const team = { service: 'Eme', sub_area_fraction: 'A' };
  const now = new Date('2026-06-01T12:00:00Z');
  assert.equal(isOnCallToday(team, 'R2', now), true);
});

test('salaOnCallR1 returns R1 on call for Sala 1 on day 1', () => {
  const now = new Date('2026-06-01T12:00:00Z'); // day 1 → position 0 = A1
  const teams = [
    { team_id: 't-a1', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'A1', members: [
      { user_id: 'r1-a1', rank: 'R1' }
    ]},
    { team_id: 't-b1', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'B1', members: [
      { user_id: 'r1-b1', rank: 'R1' }
    ]},
    { team_id: 't-s2', sala: 'Sala 2', service: 'Sala', sub_area_fraction: 'A1', members: [
      { user_id: 'r1-s2', rank: 'R1' }
    ]},
  ];
  const result = salaOnCallR1(teams, 'Sala 1', now);
  assert.equal(result.length, 1);
  assert.equal(result[0].team_id, 't-a1');
  assert.equal(result[0].user_id, 'r1-a1');
});

test('salaOnCallR1 empty when no team is on-call for that Sala', () => {
  const now = new Date('2026-06-02T12:00:00Z'); // day 2 → position 1 = B1
  const teams = [
    { team_id: 't-a', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'A1', members: [
      { user_id: 'r1-a1', rank: 'R1' }
    ]},
  ];
  const result = salaOnCallR1(teams, 'Sala 1', now);
  assert.equal(result.length, 0);
});

test('userIsOnCallForLanHost true for declared R1 guardia off-cycle', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const teams = [
    {
      team_id: 't-a',
      sala: 'Sala 1',
      service: 'Sala',
      sub_area_fraction: 'A1',
      members: [
        { user_id: 'r1-a1', rank: 'R1' },
        { user_id: 'r1-cover', rank: 'R1' },
      ],
    },
  ];
  assert.equal(
    userIsOnCallForLanHost('r1-cover', 'R1', teams, now, [
      { team_id: 't-a', user_id: 'r1-cover' },
    ]),
    true
  );
  assert.equal(userIsOnCallForLanHost('r1-a1', 'R1', teams, now, []), false);
});

test('userIsOnCallForLanHost true for R2 on cycle day', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const teams = [
    {
      team_id: 't-a',
      sala: 'Sala 1',
      service: 'Sala',
      sub_area_fraction: 'A',
      members: [{ user_id: 'r2-a', rank: 'R2' }],
    },
  ];
  assert.equal(userIsOnCallForLanHost('r2-a', 'R2', teams, now), true);
});

test('salaOnCallR1 respects team_guardia_today override off-cycle', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const teams = [
    { team_id: 't-a', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'A1', members: [
      { user_id: 'r1-a1', rank: 'R1' },
      { user_id: 'r1-cover', rank: 'R1' },
    ]},
  ];
  const result = salaOnCallR1(teams, 'Sala 1', now, [{ team_id: 't-a', user_id: 'r1-cover' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].user_id, 'r1-cover');
});

test('salaOnCallR2 returns R2s with matching cycle letter today', () => {
  const now = new Date('2026-06-01T12:00:00Z'); // day 1 → position 0 = A
  const teams = [
    { team_id: 't-a', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'A', members: [
      { user_id: 'r2-a', rank: 'R2' }
    ]},
    { team_id: 't-b', sala: 'Sala 1', service: 'Sala', sub_area_fraction: 'B', members: [
      { user_id: 'r2-b', rank: 'R2' }
    ]},
  ];
  const result = salaOnCallR2(teams, now);
  const ids = result.map((r) => r.user_id);
  assert.ok(ids.includes('r2-a'));
  assert.equal(ids.includes('r2-b'), false);
});

test('salaOnCallR2 returns exactly 2 R2s on day 2 = B', () => {
  const now = new Date('2026-06-02T12:00:00Z'); // day 2 → position 1 = B
  const teams = ['A','B','C','D','E','F','A','B','C','D','E','F'].map((letter, i) => ({
    team_id: `t-${letter}-${i}`,
    sala: `Sala ${Math.floor(i/4) + 1}`,
    service: 'Sala',
    sub_area_fraction: letter,
    members: [{ user_id: `r2-${letter}-${i}`, rank: 'R2' }],
  }));
  const result = salaOnCallR2(teams, now);
  assert.equal(result.length, 2);
});

test('teamGuardiaOverride returns null when no guardia_today', () => {
  assert.equal(teamGuardiaOverride({}), null);
});

test('teamGuardiaOverride returns user_id from guardia_today', () => {
  const team = { guardia_today: { user_id: 'r1' } };
  assert.equal(teamGuardiaOverride(team), 'r1');
});

const SALA1 = 'Sala 1';
const v3Ctx = {
  teams: [],
  guardias: [],
  cycle: null,
  assignments: [],
  salaGuardiaToday: [],
  guardiaMode: false,
  now: '2026-06-01T12:00:00Z',
};

test('V3 R4: full access without program admin', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r4', rank: 'R4', sala: SALA1, is_program_admin: 0 },
    { id: 'p1', service: 'Torre HU' },
    null,
    v3Ctx
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, true);
});

test('V3 R2: joined team requires explicit assignment (no structural fallback)', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2', sala: SALA1 },
    { id: 'p1', service: 'Sala', sub_area: 'Sala A' },
    null,
    {
      ...v3Ctx,
      teams: [
        {
          team_id: 't1',
          service: 'Sala',
          sub_area_fraction: 'A',
          members: [{ user_id: 'r2', rank: 'R2' }],
        },
      ],
      assignments: [],
    }
  );
  assert.equal(scope.writable, false);
});

test('V3 R2: explicit assignment grants access when joined', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2', rank: 'R2', sala: SALA1 },
    { id: 'p1', service: 'Sala', sub_area: 'Sala A' },
    null,
    {
      ...v3Ctx,
      teams: [
        {
          team_id: 't1',
          service: 'Sala',
          sub_area_fraction: 'A',
          members: [{ user_id: 'r2', rank: 'R2' }],
        },
      ],
      assignments: [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' }],
    }
  );
  assert.equal(scope.writable, true);
});

test('V3 R3: extended service structural blocked when joined without assignment', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r3', rank: 'R3' },
    { id: 'p1', service: 'Torre HU', sub_area: 'A' },
    null,
    {
      ...v3Ctx,
      teams: [
        {
          team_id: 't-torre',
          service: 'Torre HU',
          sub_area_fraction: 'A',
          members: [{ user_id: 'r3', rank: 'R3' }],
        },
      ],
      assignments: [],
    }
  );
  assert.equal(scope.writable, false);
});

test('isInterconsultasPatient by service', () => {
  assert.equal(isInterconsultasPatient({ service: 'Interconsultas' }), true);
  assert.equal(isInterconsultasPatient({ service: 'UX' }), false);
});

test('off-call UX resident gets Interconsultas census rw', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1-ux', rank: 'R1', sala: 'UX' },
    { id: 'p-ic', service: 'Interconsultas', sub_area: 'A' },
    null,
    {
      teams: [{
        team_id: 't-ux',
        service: 'UX',
        sub_area_fraction: 'A',
        members: [{ user_id: 'r1-ux', rank: 'R1' }],
      }],
      assignments: [],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    }
  );
  assert.equal(scope.readable, true);
  assert.equal(scope.writable, true);
  assert.match(scope.reasoning, /Off-call/);
});

test('on-call UX resident denied unassigned Interconsultas patient', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r1-ux', rank: 'R1', sala: 'UX' },
    { id: 'p-ic', service: 'Interconsultas' },
    null,
    {
      teams: [{
        team_id: 't-ux',
        service: 'UX',
        sub_area_fraction: 'A',
        members: [{ user_id: 'r1-ux', rank: 'R1' }],
      }],
      assignments: [],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.writable, false);
});

test('on-call Interconsultas team sees all Interconsultas patients', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r2-ic', rank: 'R2', sala: 'Interconsultas' },
    { id: 'p-ic', service: 'Interconsultas', sub_area: 'C' },
    null,
    {
      teams: [{
        team_id: 't-ic',
        service: 'Interconsultas',
        sub_area_fraction: 'A',
        members: [{ user_id: 'r2-ic', rank: 'R2' }],
      }],
      assignments: [],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.writable, true);
  assert.match(scope.reasoning, /guardia|Interconsultas de guardia/i);
});

test('off-call Interconsultas member only via assignment', () => {
  const scope = evaluateClinicalScope(
    { user_id: 'r3-ic', rank: 'R3', sala: 'Interconsultas' },
    { id: 'p-ic', service: 'Interconsultas' },
    null,
    {
      teams: [{
        team_id: 't-ic',
        service: 'Interconsultas',
        sub_area_fraction: 'B',
        members: [{ user_id: 'r3-ic', rank: 'R3' }],
      }],
      assignments: [],
      guardias: [],
      now: '2026-06-01T12:00:00Z',
    }
  );
  assert.equal(scope.writable, false);
});


// --- evaluateClinicalScope characterization goldens (plan 006) ---

const EVALUATE_CLINICAL_SCOPE_SCENARIOS = {
  "missingUser": {
    "user": {
      "rank": "R1"
    },
    "patient": {
      "id": "p1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "missingPatient": {
    "user": {
      "user_id": "u1",
      "rank": "R1"
    },
    "patient": {},
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "adminFull": {
    "user": {
      "user_id": "admin",
      "rank": "Admin"
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "adminEnforceTeamScope": {
    "user": {
      "user_id": "admin",
      "rank": "Admin",
      "is_program_admin": true
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z",
      "enforceTeamPatientScope": true
    }
  },
  "activeGuardiaCovering": {
    "user": {
      "user_id": "r1",
      "rank": "R1"
    },
    "patient": {
      "id": "p1"
    },
    "activeGuardia": {
      "covering_user_id": "r1"
    },
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "incomingPreview": {
    "user": {
      "user_id": "r2",
      "rank": "R2"
    },
    "patient": {
      "id": "p1",
      "service": "Sala A"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t1",
          "service": "Sala",
          "sub_area_fraction": "A",
          "members": []
        }
      ],
      "guardias": [],
      "cycle": {
        "preview_start_at": "2026-05-30T00:00:00Z",
        "effective_at": "2026-06-01T00:00:00Z"
      },
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t1",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "salaGuardiaToday": [],
      "now": "2026-05-31T12:00:00Z"
    }
  },
  "interconsultasOffCallUx": {
    "user": {
      "user_id": "r1-ux",
      "rank": "R1",
      "sala": "UX"
    },
    "patient": {
      "id": "p-ic",
      "service": "Interconsultas",
      "sub_area": "A"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-ux",
          "service": "UX",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r1-ux",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "interconsultasOnCallTeam": {
    "user": {
      "user_id": "r2-ic",
      "rank": "R2",
      "sala": "Interconsultas"
    },
    "patient": {
      "id": "p-ic",
      "service": "Interconsultas",
      "sub_area": "C"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-ic",
          "service": "Interconsultas",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r2-ic",
              "rank": "R2"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR1OnCallHandoff": {
    "user": {
      "user_id": "r1n",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p1",
          "covering_user_id": "r1n"
        }
      ],
      "guardiaMode": true,
      "onCallGuardiaReceiver": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR1OnCallNoHandoff": {
    "user": {
      "user_id": "r1n",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p2",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "onCallGuardiaReceiver": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR1EnforceTeamMatch": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala B",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-mine",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "guardiaMode": true,
      "enforceTeamPatientScope": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "guardiaR1EnforceTeamDeny": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala A",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-other",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "guardiaMode": true,
      "enforceTeamPatientScope": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "guardiaR1EnforceTeamHandoff": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p9",
      "service": "Sala",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p9",
          "covering_user_id": "r1"
        }
      ],
      "guardiaMode": true,
      "enforceTeamPatientScope": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "guardiaR1SalaMatch": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR1SalaMismatch": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR2Handoff": {
    "user": {
      "user_id": "r2",
      "rank": "R2"
    },
    "patient": {
      "id": "p1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p1",
          "covering_user_id": "r2"
        }
      ],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR2NoHandoff": {
    "user": {
      "user_id": "r2",
      "rank": "R2"
    },
    "patient": {
      "id": "p1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR4SalaTorre": {
    "user": {
      "user_id": "r4",
      "rank": "R4"
    },
    "patient": {
      "id": "p1",
      "service": "Sala"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR4TorreHu": {
    "user": {
      "user_id": "r4",
      "rank": "R4"
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaR4OutOfDomain": {
    "user": {
      "user_id": "r4",
      "rank": "R4"
    },
    "patient": {
      "id": "p1",
      "service": "UX"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "guardiaRankNoCoverage": {
    "user": {
      "user_id": "r3",
      "rank": "R3"
    },
    "patient": {
      "id": "p1",
      "service": "Sala"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "guardiaMode": true,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "r4GlobalAccess": {
    "user": {
      "user_id": "r4",
      "rank": "R4",
      "sala": "Sala 1",
      "is_program_admin": 0
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "entregaR1TeamMatch": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala B",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-mine",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "entregaPhaseActive": true,
      "enforceTeamPatientScope": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "entregaR1TeamDeny": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala A",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-other",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "entregaPhaseActive": true,
      "enforceTeamPatientScope": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "entregaR1SalaCensus": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala A",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-other",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "entregaPhaseActive": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "entregaR1SalaDeny": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "entregaPhaseActive": true,
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR1TeamPatient": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala B",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-mine",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR1TeamHandoff": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p9",
      "service": "Sala",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p9",
          "covering_user_id": "r1"
        }
      ],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR1TeamDeny": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala A",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-mine",
          "service": "Sala",
          "sub_area_fraction": "B",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "r1",
              "rank": "R1"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-other",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR1SalaPatient": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala B",
      "sala": "Sala 1"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-other",
          "service": "Sala",
          "sub_area_fraction": "A",
          "sala": "Sala 1",
          "members": [
            {
              "user_id": "other"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "normalR1SalaDeny": {
    "user": {
      "user_id": "r1",
      "rank": "R1",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p2",
      "service": "Sala",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "normalR2Handoff": {
    "user": {
      "user_id": "r2x",
      "rank": "R2",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p1",
          "covering_user_id": "r2x"
        }
      ],
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "normalR2TeamPatient": {
    "user": {
      "user_id": "r2",
      "rank": "R2",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sub_area": "Sala A"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t1",
          "service": "Sala",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r2",
              "rank": "R2"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t1",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR2SalaPatient": {
    "user": {
      "user_id": "r2",
      "rank": "R2",
      "sala": "Sala 2"
    },
    "patient": {
      "id": "p1",
      "service": "Sala",
      "sala": "Sala 2"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-01T12:00:00Z"
    }
  },
  "normalR2Deny": {
    "user": {
      "user_id": "r2",
      "rank": "R2",
      "sala": "Sala 1"
    },
    "patient": {
      "id": "p-struct",
      "service": "Sala",
      "sub_area": "A"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t1",
          "service": "Sala",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r2"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR3TeamPatient": {
    "user": {
      "user_id": "r3",
      "rank": "R3"
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU",
      "sub_area": "A"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-torre",
          "service": "Torre HU",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r3",
              "rank": "R3"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t-torre",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "normalR3Deny": {
    "user": {
      "user_id": "r3",
      "rank": "R3"
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU",
      "sub_area": "B"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t-torre",
          "service": "Torre HU",
          "sub_area_fraction": "A",
          "members": [
            {
              "user_id": "r3",
              "rank": "R3"
            }
          ]
        }
      ],
      "assignments": [],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "genericTeamAssignment": {
    "user": {
      "user_id": "r5",
      "rank": "R5"
    },
    "patient": {
      "id": "p1",
      "service": "Sala"
    },
    "activeGuardia": null,
    "context": {
      "teams": [
        {
          "team_id": "t1",
          "members": [
            {
              "user_id": "r5"
            }
          ]
        }
      ],
      "assignments": [
        {
          "patient_id": "p1",
          "team_id": "t1",
          "effective_at": "2026-06-01T00:00:00Z"
        }
      ],
      "guardias": [],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "genericHandoff": {
    "user": {
      "user_id": "r5",
      "rank": "R5"
    },
    "patient": {
      "id": "p1",
      "service": "Sala"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "assignments": [],
      "guardias": [
        {
          "patient_id": "p1",
          "covering_user_id": "r5"
        }
      ],
      "now": "2026-06-02T12:00:00Z"
    }
  },
  "genericOutOfScope": {
    "user": {
      "user_id": "r5",
      "rank": "R5"
    },
    "patient": {
      "id": "p1",
      "service": "Torre HU"
    },
    "activeGuardia": null,
    "context": {
      "teams": [],
      "guardias": [],
      "cycle": null,
      "assignments": [],
      "salaGuardiaToday": [],
      "guardiaMode": false,
      "now": "2026-06-02T12:00:00Z"
    }
  }
};

const EVALUATE_CLINICAL_SCOPE_GOLDENS = {
  "missingUser": {
    "readable": false,
    "writable": false,
    "reasoning": "Usuario o paciente no identificado",
    "audit": {
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "missingPatient": {
    "readable": false,
    "writable": false,
    "reasoning": "Usuario o paciente no identificado",
    "audit": {
      "userId": "u1",
      "rank": "R1"
    }
  },
  "adminFull": {
    "readable": true,
    "writable": true,
    "reasoning": "Privilegios admin: acceso completo",
    "audit": {
      "userId": "admin",
      "rank": "Admin",
      "patientId": "p1"
    }
  },
  "adminEnforceTeamScope": {
    "readable": false,
    "writable": false,
    "reasoning": "Fuera de alcance",
    "audit": {
      "userId": "admin",
      "rank": "Admin",
      "patientId": "p1"
    }
  },
  "activeGuardiaCovering": {
    "readable": true,
    "writable": true,
    "reasoning": "Guardia activa: cobertura asignada",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "incomingPreview": {
    "readable": true,
    "writable": false,
    "reasoning": "Vista previa Incoming: lectura permitida hasta vigencia",
    "incomingPreview": true,
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "interconsultasOffCallUx": {
    "readable": true,
    "writable": true,
    "reasoning": "Off-call UX/Eme: censo Interconsultas",
    "audit": {
      "userId": "r1-ux",
      "rank": "R1",
      "patientId": "p-ic"
    }
  },
  "interconsultasOnCallTeam": {
    "readable": true,
    "writable": true,
    "reasoning": "Interconsultas de guardia: censo del día",
    "audit": {
      "userId": "r2-ic",
      "rank": "R2",
      "patientId": "p-ic"
    }
  },
  "guardiaR1OnCallHandoff": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R1: paciente entregado",
    "audit": {
      "userId": "r1n",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "guardiaR1OnCallNoHandoff": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia R1: sin entrega recibida",
    "audit": {
      "userId": "r1n",
      "rank": "R1",
      "patientId": "p2"
    }
  },
  "guardiaR1EnforceTeamMatch": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R1: paciente de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "guardiaR1EnforceTeamDeny": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia R1: fuera de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "guardiaR1EnforceTeamHandoff": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R1: paciente entregado",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p9"
    }
  },
  "guardiaR1SalaMatch": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R1: visibilidad de Sala completa",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "guardiaR1SalaMismatch": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia R1: fuera de mi Sala",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "guardiaR2Handoff": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R2: paciente entregado",
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "guardiaR2NoHandoff": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia R2: sin entrega recibida",
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "guardiaR4SalaTorre": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R4: cobertura Sala + Torre",
    "audit": {
      "userId": "r4",
      "rank": "R4",
      "patientId": "p1"
    }
  },
  "guardiaR4TorreHu": {
    "readable": true,
    "writable": false,
    "reasoning": "Modo Guardia R4: cobertura Sala + Torre",
    "audit": {
      "userId": "r4",
      "rank": "R4",
      "patientId": "p1"
    }
  },
  "guardiaR4OutOfDomain": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia R4: fuera de dominio",
    "audit": {
      "userId": "r4",
      "rank": "R4",
      "patientId": "p1"
    }
  },
  "guardiaRankNoCoverage": {
    "readable": false,
    "writable": false,
    "reasoning": "Modo Guardia: rango sin cobertura",
    "audit": {
      "userId": "r3",
      "rank": "R3",
      "patientId": "p1"
    }
  },
  "r4GlobalAccess": {
    "readable": true,
    "writable": true,
    "reasoning": "R4: acceso global",
    "audit": {
      "userId": "r4",
      "rank": "R4",
      "patientId": "p1"
    }
  },
  "entregaR1TeamMatch": {
    "readable": true,
    "writable": false,
    "reasoning": "Fase entrega R1: paciente de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "entregaR1TeamDeny": {
    "readable": false,
    "writable": false,
    "reasoning": "Fase entrega R1: fuera de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "entregaR1SalaCensus": {
    "readable": true,
    "writable": false,
    "reasoning": "Fase entrega R1: censo de sala",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "entregaR1SalaDeny": {
    "readable": false,
    "writable": false,
    "reasoning": "Fase entrega R1: fuera de mi sala",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "normalR1TeamPatient": {
    "readable": true,
    "writable": true,
    "reasoning": "R1: paciente de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "normalR1TeamHandoff": {
    "readable": true,
    "writable": true,
    "reasoning": "R1: paciente entregado",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p9"
    }
  },
  "normalR1TeamDeny": {
    "readable": false,
    "writable": false,
    "reasoning": "R1: fuera de mi equipo",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "normalR1SalaPatient": {
    "readable": true,
    "writable": true,
    "reasoning": "R1: paciente en mi sala",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p1"
    }
  },
  "normalR1SalaDeny": {
    "readable": false,
    "writable": false,
    "reasoning": "R1: fuera de mi sala",
    "audit": {
      "userId": "r1",
      "rank": "R1",
      "patientId": "p2"
    }
  },
  "normalR2Handoff": {
    "readable": true,
    "writable": true,
    "reasoning": "R2: paciente entregado",
    "audit": {
      "userId": "r2x",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "normalR2TeamPatient": {
    "readable": true,
    "writable": true,
    "reasoning": "R2: paciente de mi equipo",
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "normalR2SalaPatient": {
    "readable": true,
    "writable": true,
    "reasoning": "R2: paciente en mi sala",
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p1"
    }
  },
  "normalR2Deny": {
    "readable": false,
    "writable": false,
    "reasoning": "R2: sin equipo ni entrega",
    "audit": {
      "userId": "r2",
      "rank": "R2",
      "patientId": "p-struct"
    }
  },
  "normalR3TeamPatient": {
    "readable": true,
    "writable": true,
    "reasoning": "R3: paciente de mi equipo",
    "audit": {
      "userId": "r3",
      "rank": "R3",
      "patientId": "p1"
    }
  },
  "normalR3Deny": {
    "readable": false,
    "writable": false,
    "reasoning": "R3: fuera de alcance",
    "audit": {
      "userId": "r3",
      "rank": "R3",
      "patientId": "p1"
    }
  },
  "genericTeamAssignment": {
    "readable": true,
    "writable": true,
    "reasoning": "Paciente del equipo (asignación)",
    "audit": {
      "userId": "r5",
      "rank": "R5",
      "patientId": "p1"
    }
  },
  "genericHandoff": {
    "readable": true,
    "writable": true,
    "reasoning": "Paciente entregado (handoff)",
    "audit": {
      "userId": "r5",
      "rank": "R5",
      "patientId": "p1"
    }
  },
  "genericOutOfScope": {
    "readable": false,
    "writable": false,
    "reasoning": "Fuera de alcance",
    "audit": {
      "userId": "r5",
      "rank": "R5",
      "patientId": "p1"
    }
  }
};

/** @param {ReturnType<typeof evaluateClinicalScope>} scope */
function scopeWithoutTimestamp(scope) {
  const { audit, ...rest } = scope;
  const auditRest = { ...(audit || {}) };
  delete auditRest.timestamp;
  const auditClean = Object.fromEntries(
    Object.entries(auditRest).filter(([, value]) => value !== undefined)
  );
  return { ...rest, audit: auditClean };
}

test('evaluateClinicalScope characterization: goldens cover every scenario key', () => {
  assert.deepEqual(
    Object.keys(EVALUATE_CLINICAL_SCOPE_GOLDENS).sort(),
    Object.keys(EVALUATE_CLINICAL_SCOPE_SCENARIOS).sort()
  );
  assert.ok(Object.keys(EVALUATE_CLINICAL_SCOPE_SCENARIOS).length >= 25);
});

for (const [name, scenario] of Object.entries(EVALUATE_CLINICAL_SCOPE_SCENARIOS)) {
  test('evaluateClinicalScope characterization: ' + name, () => {
    const result = evaluateClinicalScope(
      scenario.user,
      scenario.patient,
      scenario.activeGuardia,
      scenario.context
    );
    assert.deepEqual(scopeWithoutTimestamp(result), EVALUATE_CLINICAL_SCOPE_GOLDENS[name]);
  });
}

test('evaluateClinicalScope characterization: every reachable reasoning string is pinned', () => {
  const pinned = new Set(Object.values(EVALUATE_CLINICAL_SCOPE_GOLDENS).map((g) => g.reasoning));
  const expectedReachable = [
    'Usuario o paciente no identificado',
    'Privilegios admin: acceso completo',
    'Guardia activa: cobertura asignada',
    'Vista previa Incoming: lectura permitida hasta vigencia',
    'Off-call UX/Eme: censo Interconsultas',
    'Interconsultas de guardia: censo del día',
    'Modo Guardia R1: paciente entregado',
    'Modo Guardia R1: sin entrega recibida',
    'Modo Guardia R1: paciente de mi equipo',
    'Modo Guardia R1: fuera de mi equipo',
    'Modo Guardia R1: visibilidad de Sala completa',
    'Modo Guardia R1: fuera de mi Sala',
    'Modo Guardia R2: paciente entregado',
    'Modo Guardia R2: sin entrega recibida',
    'Modo Guardia R4: cobertura Sala + Torre',
    'Modo Guardia R4: fuera de dominio',
    'Modo Guardia: rango sin cobertura',
    'R4: acceso global',
    'Fase entrega R1: paciente de mi equipo',
    'Fase entrega R1: fuera de mi equipo',
    'Fase entrega R1: censo de sala',
    'Fase entrega R1: fuera de mi sala',
    'R1: paciente de mi equipo',
    'R1: paciente entregado',
    'R1: fuera de mi equipo',
    'R1: paciente en mi sala',
    'R1: fuera de mi sala',
    'R2: paciente entregado',
    'R2: paciente de mi equipo',
    'R2: paciente en mi sala',
    'R2: sin equipo ni entrega',
    'R3: paciente de mi equipo',
    'R3: fuera de alcance',
    'Paciente del equipo (asignación)',
    'Paciente entregado (handoff)',
    'Fuera de alcance',
  ];
  for (const reasoning of expectedReachable) {
    assert.ok(pinned.has(reasoning), 'missing golden for reasoning: ' + reasoning);
  }
});
