import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  listEntregaTargets,
  resolveR1GuardiaCovering,
  resolveEntregaActorRole,
  resolveEntregaSourceTeamId,
  entregaSourceTeamSelectOptions,
  resolveEntregaCensusTeamId,
  entregaSourceTeamHint,
  resolveEntregaPhaseCovering,
  loadGuardiaGridViewContext,
  startEntregaPhase,
  endEntregaPhase,
  ensureEntregaTargetUser,
  collectEntregaScopeUsers,
} from './clinical-entrega.mjs';

const users = [
  { user_id: 'r1a', username: 'r1a', rank: 'R1' },
  { user_id: 'r1b', username: 'r1b', rank: 'R1' },
  { user_id: 'r2a', username: 'r2a', rank: 'R2' },
  { user_id: 'r2b', username: 'r2b', rank: 'R2' },
  { user_id: 'r4x', username: 'r4x', rank: 'R4' },
  { user_id: 'r3x', username: 'r3x', rank: 'R3' },
];

describe('listEntregaTargets', () => {
  it('R1 targets on-call guardia for sala even from another team', () => {
    const now = '2026-06-01T12:00:00Z';
    const teams = [
      {
        team_id: 't1',
        service: 'Sala',
        sala: 'Sala 1',
        sub_area_fraction: 'A1',
        members: [{ user_id: 'r1a', rank: 'R1' }],
      },
      {
        team_id: 't2',
        service: 'Sala',
        sala: 'Sala 1',
        sub_area_fraction: 'B1',
        members: [{ user_id: 'r1b', rank: 'R1' }],
      },
    ];
    const { targets, flow } = listEntregaTargets('R1', teams, users, false, {
      currentUserId: 'r1b',
      now,
    });
    assert.equal(flow, 'r1');
    const ids = targets.map((u) => u.user_id);
    assert.ok(ids.includes('r1a'), 'on-call R1 for the sala must be an entrega target');
  });

  it('R1 targets same team or sub_area_fraction', () => {
    const teams = [
      {
        team_id: 't1',
        service: 'Sala',
        sub_area_fraction: 'A1',
        members: [
          { user_id: 'r1a', rank: 'R1' },
          { user_id: 'r1b', rank: 'R1' },
        ],
      },
      {
        team_id: 't2',
        service: 'Sala',
        sub_area_fraction: 'A1',
        members: [{ user_id: 'r1b', rank: 'R1' }],
      },
    ];
    const { targets, flow } = listEntregaTargets('R1', teams, users, false, {
      currentUserId: 'r1a',
    });
    assert.equal(flow, 'r1');
    const ids = targets.map((u) => u.user_id).sort();
    assert.deepEqual(ids, ['r1a', 'r1b']);
  });

  it('R2 handoff targets R2 guardia on-call and R4s', () => {
    const now = '2026-06-01T12:00:00Z'; // day 1 -> position 0 = A
    const teams = [
      {
        team_id: 's1',
        service: 'Sala',
        sub_area_fraction: 'A',
        sala: 'Sala 1',
        members: [
          { user_id: 'r2a', rank: 'R2' },
          { user_id: 'r2b', rank: 'R2' },
        ],
      },
      {
        team_id: 's2',
        service: 'Sala',
        sub_area_fraction: 'B',
        sala: 'Sala 2',
        members: [{ user_id: 'r3x', rank: 'R3' }],
      },
    ];
    const { targets, flow } = listEntregaTargets('R2', teams, users, false, {
      currentUserId: 'r2a',
      now,
    });
    assert.equal(flow, 'r2_handoff');
    const ids = new Set(targets.map((u) => u.user_id));
    assert.ok(ids.has('r4x'));
    assert.ok(ids.has('r2a'));
    assert.ok(ids.has('r2b'));
  });

  it('R3 suggests members on teams matching today', () => {
    const now = '2026-06-01T12:00:00Z'; // day 1 -> position 0 = A
    const teams = [
      {
        team_id: 't1',
        service: 'Torre HU',
        sub_area_fraction: 'A',
        members: [
          { user_id: 'r3x', rank: 'R3' },
          { user_id: 'r2a', rank: 'R2' },
        ],
      },
      {
        team_id: 't2',
        service: 'Eme',
        sub_area_fraction: 'B',
        members: [{ user_id: 'r2b', rank: 'R2' }],
      },
    ];
    const { flow, targets } = listEntregaTargets('R3', teams, users, false, {
      currentUserId: 'r3x',
      now,
    });
    assert.equal(flow, 'r3_suggest');
    const ids = targets.map((u) => u.user_id);
    assert.ok(ids.includes('r3x'));
    assert.ok(ids.includes('r2a'));
    assert.equal(ids.includes('r2b'), false);
  });

  it('generic flow returns all registered users', () => {
    const { flow, targets } = listEntregaTargets('Admin', [], users, false, {});
    assert.equal(flow, 'generic');
    assert.equal(targets.length, users.length);
  });
});

describe('resolveEntregaActorRole', () => {
  it('diurno when no existing guardia', () => {
    assert.deepEqual(resolveEntregaActorRole({ user_id: 'u1', rank: 'R1' }, null), {
      role: 'diurno',
      userId: 'u1',
      rank: 'R1',
    });
    assert.deepEqual(resolveEntregaActorRole({ user_id: 'u1' }, {}), {
      role: 'diurno',
      userId: 'u1',
      rank: '',
    });
  });

  it('guardia when updating own coverage', () => {
    assert.equal(
      resolveEntregaActorRole(
        { user_id: 'u1' },
        { guardia_id: 'g-1', covering_user_id: 'u1' }
      ).role,
      'guardia'
    );
    assert.equal(
      resolveEntregaActorRole({ user_id: 'u1' }, { guardiaId: 'g-2', covering_user_id: 'u1' })
        .role,
      'guardia'
    );
  });

  it('diurno when handoff belongs to another covering user', () => {
    assert.equal(
      resolveEntregaActorRole(
        { user_id: 'u1' },
        { guardia_id: 'g-1', covering_user_id: 'u2' }
      ).role,
      'diurno'
    );
  });
});

describe('collectEntregaScopeUsers', () => {
  it('includes session user and team members when scope users missing', () => {
    const roster = collectEntregaScopeUsers(
      {},
      [
        {
          team_id: 't1',
          members: [{ user_id: 'r1b', username: 'r1b', rank: 'R1', clinical_name: 'Ana' }],
        },
      ],
      { user_id: 'self1', username: 'msalas', rank: 'R1', clinical_name: 'Mauricio' }
    );
    const ids = roster.map((u) => u.user_id);
    assert.ok(ids.includes('self1'));
    assert.ok(ids.includes('r1b'));
  });
});

describe('ensureEntregaTargetUser', () => {
  it('adds existing covering user when absent from rank-based targets', () => {
    const targets = [{ user_id: 'r4x', username: 'r4x', rank: 'R4', clinical_name: '' }];
    const merged = ensureEntregaTargetUser(targets, users, 'r1b');
    assert.equal(merged.length, 2);
    assert.equal(merged[0].user_id, 'r1b');
  });

  it('does not duplicate when user already in list', () => {
    const targets = [{ user_id: 'r1b', username: 'r1b', rank: 'R1', clinical_name: '' }];
    const merged = ensureEntregaTargetUser(targets, users, 'r1b');
    assert.equal(merged.length, 1);
  });
});

describe('entregaSourceTeamHint', () => {
  it('prefers census assignment message when present', () => {
    assert.match(
      entregaSourceTeamHint({ hasCensusAssignment: true, hasExistingSourceTeam: true }),
      /censo/
    );
  });

  it('mentions prior entrega when only source_team exists', () => {
    assert.match(
      entregaSourceTeamHint({ hasCensusAssignment: false, hasExistingSourceTeam: true }),
      /entrega anterior/
    );
  });
});

describe('resolveEntregaCensusTeamId', () => {
  const teams = [
    {
      team_id: 't1',
      service: 'Sala',
      sub_area_fraction: 'A1',
      members: [],
    },
  ];

  it('uses _filterTeamId tag when assignments are empty', () => {
    assert.equal(
      resolveEntregaCensusTeamId(
        'p1',
        { id: 'p1', servicio: 'Sala', area: 'Z9', _filterTeamId: 't1' },
        teams,
        [],
        new Date()
      ),
      't1'
    );
  });
});

describe('entregaSourceTeamSelectOptions', () => {
  const teams = [
    {
      team_id: 't-adrian',
      name: 'Dr. Adrian Montemayor',
      service: 'Sala',
      sala: 'Sala 2',
      members: [{ user_id: 'r2a', rank: 'R2' }],
    },
    {
      team_id: 't-mauricio',
      name: 'Dr. Mauricio',
      service: 'Sala',
      sala: 'Sala 2',
      members: [{ user_id: 'r1m', rank: 'R1' }],
    },
  ];

  it('includes census team outside actor joined teams', () => {
    const opts = entregaSourceTeamSelectOptions('t-adrian', teams, 'r1m');
    assert.equal(opts.length, 2);
    assert.equal(opts[0].team_id, 't-adrian');
    assert.equal(opts[1].team_id, 't-mauricio');
  });

  it('lists all teams for admin without requiring membership', () => {
    const opts = entregaSourceTeamSelectOptions('t-adrian', teams, 'admin1', {
      rank: 'Admin',
      is_program_admin: true,
    });
    assert.equal(opts.length, 2);
    assert.ok(opts.some((t) => t.team_id === 't-adrian'));
    assert.ok(opts.some((t) => t.team_id === 't-mauricio'));
  });
});

describe('resolveEntregaSourceTeamId', () => {
  const teams = [
    {
      team_id: 't-melissa',
      name: 'Dra. Melissa',
      service: 'Sala',
      sala: 'Sala 1',
      sub_area_fraction: 'A1',
      members: [{ user_id: 'r2m', rank: 'R2' }],
    },
    {
      team_id: 't-mauricio',
      name: 'Dr. Mauricio',
      service: 'Sala',
      sala: 'Sala 1',
      sub_area_fraction: 'B1',
      members: [{ user_id: 'r1m', rank: 'R1' }],
    },
  ];

  it('uses explicit patient_team_assignment over actor joined team', () => {
    const teamId = resolveEntregaSourceTeamId(
      'p1',
      { id: 'p1', servicio: 'Sala', area: 'B1' },
      teams,
      [{ patient_id: 'p1', team_id: 't-melissa', effective_at: '2026-06-01T00:00:00Z' }],
      null,
      'r1m'
    );
    assert.equal(teamId, 't-melissa');
  });

  it('prefers census assignment over stale guardia source team', () => {
    const teamId = resolveEntregaSourceTeamId(
      'p1',
      { id: 'p1' },
      teams,
      [{ patient_id: 'p1', team_id: 't-melissa', effective_at: '2026-06-01T00:00:00Z' }],
      { source_team_id: 't-mauricio' },
      'r1m'
    );
    assert.equal(teamId, 't-melissa');
  });

  it('falls back to actor joined team only when patient has no assignment', () => {
    const teamId = resolveEntregaSourceTeamId(
      'p2',
      { id: 'p2', servicio: 'Sala', area: 'Z9' },
      teams,
      [],
      null,
      'r1m'
    );
    assert.equal(teamId, 't-mauricio');
  });
});

describe('resolveEntregaPhaseCovering', () => {
  const teams = [
    {
      team_id: 't-melissa',
      service: 'Sala',
      sala: 'Sala 1',
      sub_area_fraction: 'A1',
      members: [{ user_id: 'r1a', rank: 'R1', username: 'melissa' }],
      guardia_today: { user_id: 'r1a' },
    },
    {
      team_id: 't-mauricio',
      service: 'Sala',
      sala: 'Sala 1',
      sub_area_fraction: 'B1',
      members: [{ user_id: 'r1b', rank: 'R1', username: 'mauricio' }],
    },
  ];
  const users = [
    { user_id: 'r1a', username: 'melissa', rank: 'R1' },
    { user_id: 'r1b', username: 'mauricio', rank: 'R1' },
  ];

  it('uses activator when they just activated guardia hoy', () => {
    const covering = resolveEntregaPhaseCovering({
      userId: 'r1b',
      rank: 'R1',
      users,
      teams,
      sala: 'Sala 1',
      salaGuardiaToday: [],
      guardiaActivated: true,
      guardiaMode: false,
    });
    assert.equal(covering?.coveringUserId, 'r1b');
  });

  it('uses activator in guardia mode even when another team is first in sala scan', () => {
    const covering = resolveEntregaPhaseCovering({
      userId: 'r1b',
      rank: 'R1',
      users,
      teams,
      sala: 'Sala 1',
      salaGuardiaToday: [],
      guardiaActivated: false,
      guardiaMode: true,
    });
    assert.equal(covering?.coveringUserId, 'r1b');
  });

  it('falls back to sala on-call R1 when diurno activates entrega', () => {
    const covering = resolveEntregaPhaseCovering({
      userId: 'r1b',
      rank: 'R1',
      users,
      teams,
      sala: 'Sala 1',
      salaGuardiaToday: [{ team_id: 't-melissa', user_id: 'r1a' }],
      guardiaActivated: false,
      guardiaMode: false,
      now: '2026-06-01T12:00:00Z',
    });
    assert.equal(covering?.coveringUserId, 'r1a');
  });
});

describe('resolveR1GuardiaCovering', () => {
  it('returns R1 on call for the sala', () => {
    const now = '2026-06-01T12:00:00Z';
    const teams = [
      {
        team_id: 's1',
        service: 'Sala',
        sala: 'Sala 1',
        sub_area_fraction: 'A1',
        members: [{ user_id: 'r1a', rank: 'R1' }],
      },
    ];
    const covering = resolveR1GuardiaCovering(teams, users, 'Sala 1', now);
    assert.ok(covering);
    assert.equal(covering.coveringUserId, 'r1a');
    assert.equal(covering.sala, 'Sala 1');
  });

  it('prefers declared guardia user over first team in sala order', () => {
    const now = '2026-06-01T12:00:00Z';
    const salaTeams = [
      {
        team_id: 't1',
        service: 'Sala',
        sala: 'Sala 1',
        sub_area_fraction: 'A1',
        members: [{ user_id: 'r1a', rank: 'R1' }],
        guardia_today: { user_id: 'r1a' },
      },
      {
        team_id: 't2',
        service: 'Sala',
        sala: 'Sala 1',
        sub_area_fraction: 'B1',
        members: [{ user_id: 'r1b', rank: 'R1' }],
        guardia_today: { user_id: 'r1b' },
      },
    ];
    const covering = resolveR1GuardiaCovering(salaTeams, users, 'Sala 1', now, [], 'r1b');
    assert.equal(covering?.coveringUserId, 'r1b');
  });
});

describe('entrega phase session', () => {
  const mem = new Map();

  before(() => {
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => {
        mem.set(k, v);
      },
      removeItem: (k) => {
        mem.delete(k);
      },
    };
  });

  afterEach(() => {
    mem.clear();
    endEntregaPhase();
  });

  it('loadGuardiaGridViewContext is HANDOFF while phase active', () => {
    assert.equal(loadGuardiaGridViewContext(), 'GUARDIA');
    startEntregaPhase({
      coveringUserId: 'r1b',
      sala: 'Sala 1',
      coveringLabel: 'r1b · Test (R1)',
    });
    assert.equal(loadGuardiaGridViewContext(), 'HANDOFF');
    endEntregaPhase();
    assert.equal(loadGuardiaGridViewContext(), 'GUARDIA');
  });
});
