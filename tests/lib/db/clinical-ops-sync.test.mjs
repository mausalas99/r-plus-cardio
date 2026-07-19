import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations } from '../../../lib/db/schema.mjs';
import {
  ensureClinicalUser,
  claimUsername,
  createTeam,
  archiveTeam,
  updateTeam,
  joinTeam,
  removeTeamMember,
  listLanDirectoryUsers,
  setTeamGuardiaToday,
  upsertActiveGuardia,
  saveEntregaTemplateUser,
  saveEntregaTemplateTeam,
} from '../../../lib/db/clinical-access-db.mjs';
import {
  exportClinicalOpsSnapshot,
  mergeClinicalOpsSnapshot,
  pickNewerClinicalOpsSnapshot,
  stampRotationNuevaAt,
} from '../../../lib/db/clinical-ops-sync.mjs';
import { mergeClinicalOpsSnapshotsData } from '../../../lib/db/clinical-ops-bundle-merge.cjs';

function openDb() {
  const db = new Database(':memory:');
  applyMigrations(db);
  return db;
}

describe('clinical-ops-sync', () => {
  it('exportClinicalOpsSnapshot includes V2 tables', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    createTeam(db, { name: 'Sala A', service: 'Sala', onCallDayIndex: 1, createdBy: user.userId });
    const snap = exportClinicalOpsSnapshot(db);
    assert.ok(Array.isArray(snap.rotation_cycles));
    assert.ok(Array.isArray(snap.patient_team_assignment));
    assert.ok(Array.isArray(snap.team_guardia_today));
    assert.ok(Array.isArray(snap.teams));
    assert.equal(snap.teams.length, 1);
    assert.ok(Array.isArray(snap.entrega_template_user));
    assert.ok(Array.isArray(snap.entrega_template_team));
  });

  it('mergeClinicalOpsSnapshot last-writes entrega templates by created_at', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    const team = createTeam(db, { name: 'Sala A', service: 'Sala', onCallDayIndex: 1, createdBy: user.userId });
    const userTpl = saveEntregaTemplateUser(db, {
      userId: user.userId,
      name: 'Local user tpl',
      payload: { kind: 'imagen', label: 'TAC' },
    });
    const teamTpl = saveEntregaTemplateTeam(db, {
      teamId: team.team_id,
      createdBy: user.userId,
      name: 'Local team tpl',
      payload: { kind: 'otro', label: 'Endo' },
    });

    const local = exportClinicalOpsSnapshot(db);
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      entrega_template_user: [
        {
          template_id: userTpl.templateId,
          user_id: user.userId,
          name: 'Remote user tpl',
          payload_json: JSON.stringify({ kind: 'otro', label: 'RM' }),
          created_at: '2099-01-02T00:00:00',
        },
      ],
      entrega_template_team: [
        {
          template_id: teamTpl.templateId,
          team_id: team.team_id,
          name: 'Remote team tpl',
          payload_json: JSON.stringify({ kind: 'imagen', label: 'US' }),
          created_by: user.userId,
          created_at: '2099-01-02T00:00:00',
        },
      ],
    };

    mergeClinicalOpsSnapshot(db, incoming, local);

    const userRow = db
      .prepare(`SELECT name, payload_json FROM entrega_template_user WHERE template_id = ?`)
      .get(userTpl.templateId);
    assert.equal(userRow.name, 'Remote user tpl');
    assert.match(userRow.payload_json, /"label":"RM"/);

    const teamRow = db
      .prepare(`SELECT name, payload_json FROM entrega_template_team WHERE template_id = ?`)
      .get(teamTpl.templateId);
    assert.equal(teamRow.name, 'Remote team tpl');
    assert.match(teamRow.payload_json, /"label":"US"/);
  });

  it('mergeClinicalOpsSnapshot last-writes team_guardia_today by declared_at', () => {
    const db = openDb();
    const userA = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    const userB = ensureClinicalUser(db, { clientId: 'dev-b', rank: 'R3' });
    const team = createTeam(db, { name: 'Sala A', service: 'Sala', onCallDayIndex: 1, createdBy: userA.userId });
    setTeamGuardiaToday(db, team.team_id, userA.userId);

    const local = exportClinicalOpsSnapshot(db);
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      team_guardia_today: [
        {
          team_id: team.team_id,
          user_id: userB.userId,
          declared_at: '2099-01-02T00:00:00',
        },
      ],
    };

    mergeClinicalOpsSnapshot(db, incoming, local);
    const row = db
      .prepare(`SELECT user_id FROM team_guardia_today WHERE team_id = ?`)
      .get(team.team_id);
    assert.equal(row.user_id, userB.userId);
  });

  it('mergeClinicalOpsSnapshot does not resurrect entrega after peer resolution tombstone', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-no-resurrect', rank: 'R2' });
    const team = createTeam(db, {
      name: 'No Resurrect',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: user.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p-stale-local',
      coveringUserId: user.userId,
      sourceTeamId: team.team_id,
    });
    const local = exportClinicalOpsSnapshot(db);
    const resolvedAt = '2099-06-06T21:00:00.000Z';
    mergeClinicalOpsSnapshot(
      db,
      {
        ...local,
        exportedAt: resolvedAt,
        active_guardias: [],
        active_guardias_resolved: [{ patient_id: 'p-stale-local', assigned_at: resolvedAt }],
      },
      local
    );
    assert.equal(
      db
        .prepare(`SELECT status FROM active_guardias WHERE patient_id = ?`)
        .get('p-stale-local').status,
      'Resolved'
    );
  });

  it('mergeClinicalOpsSnapshot applies active_guardias_resolved from peer', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-resolve', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Resolve Team',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: user.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p-resolved-peer',
      coveringUserId: user.userId,
      sourceTeamId: team.team_id,
    });
    const local = exportClinicalOpsSnapshot(db);
    assert.equal(
      db
        .prepare(`SELECT status FROM active_guardias WHERE patient_id = ?`)
        .get('p-resolved-peer').status,
      'Active'
    );

    const resolvedAt = '2099-06-06T20:00:00.000Z';
    mergeClinicalOpsSnapshot(
      db,
      {
        ...local,
        exportedAt: resolvedAt,
        active_guardias: [],
        active_guardias_resolved: [
          {
            patient_id: 'p-resolved-peer',
            assigned_at: resolvedAt,
          },
        ],
      },
      local
    );

    assert.equal(
      db
        .prepare(`SELECT status FROM active_guardias WHERE patient_id = ?`)
        .get('p-resolved-peer').status,
      'Resolved'
    );
  });

  it('mergeClinicalOpsSnapshot applies rotation.nueva archive from peer', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    const team = createTeam(db, { name: 'Sala A', service: 'Sala', onCallDayIndex: 1, createdBy: user.userId });
    setTeamGuardiaToday(db, team.team_id, user.userId);
    upsertActiveGuardia(db, {
      patientId: 'p1',
      coveringUserId: user.userId,
      sourceTeamId: team.team_id,
    });

    const local = exportClinicalOpsSnapshot(db);
    assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM active_guardias`).get().c, 1);

    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      rotationNuevaAt: '2099-06-01T00:00:00',
      active_guardias: [],
      team_guardia_today: [],
      teams: local.teams.map((t) => ({ ...t, archived_at: '2099-06-01T00:00:00' })),
    };

    mergeClinicalOpsSnapshot(db, incoming, local);
    assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM active_guardias`).get().c, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM team_guardia_today`).get().c, 0);
  });

  it('pickNewerClinicalOpsSnapshot unions teams across LAN sources', () => {
    const older = {
      clinicalOps: {
        exportedAt: '2020-01-01T00:00:00',
        version: 1,
        teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
        team_membership: [],
      },
    };
    const newer = {
      clinicalOps: {
        exportedAt: '2025-01-01T00:00:00',
        version: 1,
        teams: [],
        team_membership: [],
      },
    };
    const picked = pickNewerClinicalOpsSnapshot([older, newer, {}]);
    assert.equal(picked.exportedAt, '2025-01-01T00:00:00');
    assert.equal(picked.teams.length, 1);
    assert.equal(picked.teams[0].team_id, 'team-a');
  });

  it('mergeClinicalOpsSnapshot imports remote membership after LAN users', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Sala A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
      sala: 'Sala 1',
    });
    const local = exportClinicalOpsSnapshot(db);
    const remoteUserId = '11111111-1111-1111-1111-111111111111';
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      clinical_users: [
        {
          user_id: remoteUserId,
          username: 'mgarcia',
          rank: 'R1',
          clinical_name: 'Dr. García',
          sala: 'Sala 1',
          is_program_admin: 0,
        },
      ],
      team_membership: [{ team_id: team.team_id, user_id: remoteUserId, sub_area_fraction: 'D2' }],
    };
    mergeClinicalOpsSnapshot(db, incoming, local);
    const userRow = db.prepare(`SELECT username FROM users WHERE user_id = ?`).get(remoteUserId);
    assert.equal(userRow.username, 'mgarcia');
    const member = db
      .prepare(`SELECT sub_area_fraction FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, remoteUserId);
    assert.equal(member.sub_area_fraction, 'D2');
  });

  it('mergeClinicalOpsSnapshot accepts 6.5.6 snapshots without clinical_users', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    const local = exportClinicalOpsSnapshot(db);
    const remoteTeamId = '22222222-2222-2222-2222-222222222222';
    const remoteUserId = '11111111-1111-1111-1111-111111111111';
    const incoming = {
      exportedAt: new Date().toISOString(),
      version: 1,
      rotationNuevaAt: null,
      rotation_cycles: [],
      patient_team_assignment: [],
      team_guardia_today: [],
      active_guardias: [],
      teams: [
        {
          team_id: remoteTeamId,
          name: 'Equipo remoto',
          service: 'Sala',
          sub_area_fraction: null,
          on_call_day_index: 1,
          created_by: remoteUserId,
          archived_at: null,
          sala: 'Sala 2',
          team_leader_name: null,
          leader_user_id: null,
          rotation_active: 1,
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      team_membership: [{ team_id: remoteTeamId, user_id: remoteUserId, sub_area_fraction: 'A1' }],
    };
    mergeClinicalOpsSnapshot(db, incoming, local);
    const team = db.prepare(`SELECT name FROM teams WHERE team_id = ?`).get(remoteTeamId);
    assert.equal(team.name, 'Equipo remoto');
    const member = db
      .prepare(`SELECT sub_area_fraction FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(remoteTeamId, remoteUserId);
    assert.equal(member.sub_area_fraction, 'A1');
  });

  it('mergeClinicalOpsSnapshot unions clinical_users from local and incoming', () => {
    const db = openDb();
    const localUser = ensureClinicalUser(db, { clientId: 'local-dev', rank: 'R4', clinicalName: 'Local' });
    claimUsername(db, { userId: localUser.userId, username: 'local_user' });
    const local = exportClinicalOpsSnapshot(db);

    const remoteUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      clinical_users: [
        {
          user_id: remoteUserId,
          username: 'remote_peer',
          rank: 'R1',
          clinical_name: 'Remoto',
          sala: 'Sala 2',
          is_program_admin: 0,
        },
      ],
    };

    mergeClinicalOpsSnapshot(db, incoming, local);
    assert.ok(
      db.prepare(`SELECT 1 AS ok FROM users WHERE username = ?`).get('local_user')
    );
    assert.ok(
      db.prepare(`SELECT 1 AS ok FROM users WHERE username = ?`).get('remote_peer')
    );
  });

  it('exportClinicalOpsSnapshot includes registered profile without @usuario when clinical_name is set', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, {
      clientId: 'device-pending',
      rank: 'R2',
      clinicalName: 'Dra. Nueva',
    });
    const snap = exportClinicalOpsSnapshot(db);
    const exported = snap.clinical_users.find((u) => u.user_id === user.userId);
    assert.ok(exported, 'registered LAN profile should export for directorio');
    assert.equal(exported.clinical_name, 'Dra. Nueva');
  });

  it('exportClinicalOpsSnapshot includes registered profile with clinical_name and sala', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, {
      clientId: 'device-pending-sala',
      rank: 'R2',
      clinicalName: 'Dra. Con Sala',
      sala: 'Sala 2',
    });
    const snap = exportClinicalOpsSnapshot(db);
    const exported = snap.clinical_users.find((u) => u.user_id === user.userId);
    assert.ok(exported);
    assert.equal(exported.sala, 'Sala 2');
  });

  it('listLanDirectoryUsers includes registered user without sala', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, {
      clientId: 'interconsultas-only',
      rank: 'R2',
      clinicalName: 'Dr. Interconsultas',
    });
    const listed = listLanDirectoryUsers(db);
    assert.ok(listed.some((u) => u.user_id === user.userId));
  });

  it('exportClinicalOpsSnapshot includes team members without valid @usuario when they have clinical_name', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'dev-lead', rank: 'R2', clinicalName: 'Lead' });
    claimUsername(db, { userId: leader.userId, username: 'lead_user' });
    const team = createTeam(db, {
      name: 'Sala A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
      sala: 'Sala 1',
    });
    const member = ensureClinicalUser(db, {
      clientId: 'device-only',
      rank: 'R1',
      clinicalName: 'Sin Handle',
    });
    joinTeam(db, team.team_id, member.userId);
    const snap = exportClinicalOpsSnapshot(db);
    const exported = snap.clinical_users.find((u) => u.user_id === member.userId);
    assert.ok(exported, 'member with clinical_name should export for LAN');
    assert.equal(exported.clinical_name, 'Sin Handle');
  });

  it('mergeClinicalOpsSnapshot upgrades peer stub when remote claims @usuario', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    claimUsername(db, { userId: leader.userId, username: 'leader_ok' });
    const team = createTeam(db, {
      name: 'Sala A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
    });
    const remoteUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const incomingStub = {
      exportedAt: new Date().toISOString(),
      version: 1,
      rotationNuevaAt: null,
      rotation_cycles: [],
      patient_team_assignment: [],
      team_guardia_today: [],
      active_guardias: [],
      teams: [],
      team_membership: [{ team_id: team.team_id, user_id: remoteUserId, sub_area_fraction: null }],
      clinical_users: [],
    };
    const outStub = mergeClinicalOpsSnapshot(db, incomingStub);
    assert.equal(outStub.stats.stubsCreated, 1);
    const stubRow = db.prepare(`SELECT username FROM users WHERE user_id = ?`).get(remoteUserId);
    assert.match(stubRow.username, /^peer_/);

    const local = exportClinicalOpsSnapshot(db);
    const incomingReal = {
      ...local,
      exportedAt: new Date().toISOString(),
      clinical_users: [
        {
          user_id: remoteUserId,
          username: 'claimed_peer',
          rank: 'R1',
          clinical_name: 'Dr. Claimed',
          sala: 'Sala 1',
          is_program_admin: 0,
        },
      ],
    };
    const outReal = mergeClinicalOpsSnapshot(db, incomingReal, local);
    assert.ok(outReal.stats.usersUpgradedFromStub >= 1);
    const realRow = db.prepare(`SELECT username, clinical_name FROM users WHERE user_id = ?`).get(
      remoteUserId
    );
    assert.equal(realRow.username, 'claimed_peer');
    assert.equal(realRow.clinical_name, 'Dr. Claimed');
  });

  it('mergeClinicalOpsSnapshot does not purge users re-published in incoming clinical_users', () => {
    const db = openDb();
    const user = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R1', clinicalName: 'Keep Me' });
    claimUsername(db, { userId: user.userId, username: 'keep_me' });
    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('lan_clinical_users_deleted', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(JSON.stringify([user.userId]));
    const local = exportClinicalOpsSnapshot(db);
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      clinical_users_deleted: [user.userId],
      clinical_users: [
        {
          user_id: user.userId,
          username: 'keep_me',
          rank: 'R1',
          clinical_name: 'Keep Me',
          sala: 'Sala 1',
          is_program_admin: 0,
        },
      ],
    };
    mergeClinicalOpsSnapshot(db, incoming, local);
    const row = db.prepare(`SELECT username FROM users WHERE user_id = ?`).get(user.userId);
    assert.equal(row.username, 'keep_me');
  });

  it('listLanDirectoryUsers includes active-team peer stubs', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'dev-a', rank: 'R2' });
    claimUsername(db, { userId: leader.userId, username: 'leader_dir' });
    const team = createTeam(db, {
      name: 'Sala A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
    });
    const remoteUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    mergeClinicalOpsSnapshot(db, {
      exportedAt: new Date().toISOString(),
      version: 1,
      rotationNuevaAt: null,
      rotation_cycles: [],
      patient_team_assignment: [],
      team_guardia_today: [],
      active_guardias: [],
      teams: [],
      team_membership: [{ team_id: team.team_id, user_id: remoteUserId, sub_area_fraction: null }],
      clinical_users: [],
    });
    const listed = listLanDirectoryUsers(db);
    assert.ok(listed.some((u) => u.user_id === remoteUserId));
    const peer = listed.find((u) => u.user_id === remoteUserId);
    assert.equal(peer.lanDirectoryPending, true);
  });

  it('mergeClinicalUsersData keeps both users when @usuario handle collides across user_id', () => {
    const merged = mergeClinicalOpsSnapshotsData(
      {
        exportedAt: '2026-06-01T00:00:00.000Z',
        clinical_users: [
          {
            user_id: 'user-a',
            username: 'same_handle',
            rank: 'R1',
            clinical_name: 'A',
          },
        ],
        teams: [],
        team_membership: [],
      },
      {
        exportedAt: '2026-06-02T00:00:00.000Z',
        clinical_users: [
          {
            user_id: 'user-b',
            username: 'same_handle',
            rank: 'R2',
            clinical_name: 'B',
          },
        ],
        teams: [],
        team_membership: [],
      }
    );
    assert.equal(merged.clinical_users.length, 2);
    const ids = merged.clinical_users.map((u) => u.user_id).sort();
    assert.deepEqual(ids, ['user-a', 'user-b']);
  });

  it('mergeClinicalOpsSnapshot does not re-add tombstoned user via team_membership', () => {
    const db = openDb();
    const admin = ensureClinicalUser(db, { clientId: 'admin', rank: 'R4' });
    claimUsername(db, { userId: admin.userId, username: 'admin_user' });
    const team = createTeam(db, {
      name: 'Equipo',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: admin.userId,
      sala: 'Sala 2',
    });
    const ghostId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const local = exportClinicalOpsSnapshot(db);
    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('lan_clinical_users_deleted', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(JSON.stringify([ghostId]));

    mergeClinicalOpsSnapshot(
      db,
      {
        ...local,
        exportedAt: new Date().toISOString(),
        clinical_users: [],
        clinical_users_deleted: [ghostId],
        team_membership: [{ team_id: team.team_id, user_id: ghostId, sub_area_fraction: null }],
      },
      local
    );

    assert.equal(
      db.prepare('SELECT 1 AS ok FROM users WHERE user_id = ?').get(ghostId),
      undefined
    );
    assert.equal(
      db
        .prepare('SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?')
        .get(team.team_id, ghostId),
      undefined
    );
  });

  it('mergeClinicalOpsSnapshot honors team_membership_removals over stale membership union', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'host', rank: 'R4' });
    claimUsername(db, { userId: leader.userId, username: 'host_user' });
    const team = createTeam(db, {
      name: 'Equipo LAN',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
      sala: 'Sala 2',
    });
    const peer = ensureClinicalUser(db, { clientId: 'peer-dev', rank: 'R2' });
    claimUsername(db, { userId: peer.userId, username: 'peer_user' });
    joinTeam(db, team.team_id, peer.userId);
    const peerId = peer.userId;
    const local = exportClinicalOpsSnapshot(db);

    removeTeamMember(db, team.team_id, peerId);
    const afterLeave = exportClinicalOpsSnapshot(db);
    assert.equal(
      afterLeave.team_membership.filter((row) => row.user_id === peerId).length,
      0
    );
    assert.ok(
      afterLeave.team_membership_removals.some(
        (row) => row.team_id === team.team_id && row.user_id === peerId
      )
    );

    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      team_membership: [{ team_id: team.team_id, user_id: peerId, sub_area_fraction: null }],
      team_membership_removals: [],
      team_membership_rejoins: [],
    };
    mergeClinicalOpsSnapshot(db, incoming, afterLeave);
    const member = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, peerId);
    assert.equal(member, undefined);
  });

  it('mergeClinicalOpsSnapshot lets a fresh LAN re-join override an older leave tombstone', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'host', rank: 'R4' });
    claimUsername(db, { userId: leader.userId, username: 'host_user' });
    const team = createTeam(db, {
      name: 'Equipo LAN',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
      sala: 'Sala 2',
    });
    const peer = ensureClinicalUser(db, { clientId: 'peer-dev', rank: 'R2' });
    claimUsername(db, { userId: peer.userId, username: 'peer_user' });
    joinTeam(db, team.team_id, peer.userId);
    const peerId = peer.userId;
    const beforeLeave = exportClinicalOpsSnapshot(db);

    removeTeamMember(db, team.team_id, peerId);
    const afterLeave = exportClinicalOpsSnapshot(db);

    joinTeam(db, team.team_id, peer.userId);
    const afterRejoin = exportClinicalOpsSnapshot(db);
    assert.ok(
      afterRejoin.team_membership_rejoins.some(
        (row) => row.team_id === team.team_id && row.user_id === peerId
      )
    );

    mergeClinicalOpsSnapshot(db, afterRejoin, afterLeave);
    const member = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, peerId);
    assert.ok(member);

    mergeClinicalOpsSnapshot(
      db,
      {
        ...beforeLeave,
        exportedAt: new Date().toISOString(),
        team_membership: [{ team_id: team.team_id, user_id: peerId, sub_area_fraction: null }],
        team_membership_removals: [],
        team_membership_rejoins: [],
      },
      afterLeave
    );
    const staleMember = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, peerId);
    assert.equal(staleMember, undefined);
  });

  it('mergeClinicalOpsSnapshot prunes leave tombstones for deleted or purged users', () => {
    const db = openDb();
    const leader = ensureClinicalUser(db, { clientId: 'host', rank: 'R4' });
    const team = createTeam(db, {
      name: 'Equipo LAN',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
      sala: 'Sala 2',
    });
    const ghostId = 'ghost-user-id';
    const local = exportClinicalOpsSnapshot(db);
    const incoming = {
      ...local,
      exportedAt: new Date().toISOString(),
      team_membership_removals: [
        {
          team_id: team.team_id,
          user_id: ghostId,
          removed_at: '2026-06-01T10:00:00.000Z',
        },
      ],
      clinical_users_deleted: [ghostId],
    };
    mergeClinicalOpsSnapshot(db, incoming, local);
    const after = exportClinicalOpsSnapshot(db);
    assert.equal(after.team_membership_removals.length, 0);
  });

  it('mergeClinicalOpsSnapshot keeps local team archive over stale active peer row', () => {
    const db = openDb();
    const admin = ensureClinicalUser(db, { clientId: 'admin', rank: 'R4' });
    claimUsername(db, { userId: admin.userId, username: 'admin_user' });
    const team = createTeam(db, {
      name: 'Equipo viejo',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: admin.userId,
      sala: 'Sala 2',
    });
    const beforeArchive = exportClinicalOpsSnapshot(db);
    const stalePeerTeam = beforeArchive.teams.find((row) => row.team_id === team.team_id);
    assert.ok(stalePeerTeam);

    archiveTeam(db, team.team_id, admin.userId);
    const afterArchive = exportClinicalOpsSnapshot(db);
    assert.ok(afterArchive.teams_archived.some((row) => row.team_id === team.team_id));
    assert.equal(
      db.prepare(`SELECT archived_at FROM teams WHERE team_id = ?`).get(team.team_id).archived_at,
      afterArchive.teams.find((row) => row.team_id === team.team_id).archived_at
    );

    mergeClinicalOpsSnapshot(
      db,
      {
        ...beforeArchive,
        exportedAt: new Date().toISOString(),
        teams: [{ ...stalePeerTeam, archived_at: null, name: 'Equipo viejo' }],
        teams_archived: [],
        team_membership: [{ team_id: team.team_id, user_id: admin.userId, sub_area_fraction: null }],
      },
      afterArchive
    );

    const row = db.prepare(`SELECT archived_at, name FROM teams WHERE team_id = ?`).get(team.team_id);
    assert.ok(row.archived_at);
    assert.equal(
      db.prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ?`).get(team.team_id),
      undefined
    );
  });

  it('mergeClinicalOpsSnapshot keeps newer local team rename over stale peer name', () => {
    const db = openDb();
    const admin = ensureClinicalUser(db, { clientId: 'admin', rank: 'R4' });
    claimUsername(db, { userId: admin.userId, username: 'admin_user' });
    const team = createTeam(db, {
      name: 'Equipo A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: admin.userId,
      sala: 'Sala 2',
    });
    const stale = exportClinicalOpsSnapshot(db);
    const staleTeam = stale.teams.find((row) => row.team_id === team.team_id);

    updateTeam(db, team.team_id, { name: 'Equipo renombrado', callerUserId: admin.userId });
    const local = exportClinicalOpsSnapshot(db);

    mergeClinicalOpsSnapshot(
      db,
      {
        ...stale,
        exportedAt: new Date().toISOString(),
        teams: [{ ...staleTeam, name: 'Equipo A' }],
      },
      local
    );

    const row = db.prepare(`SELECT name FROM teams WHERE team_id = ?`).get(team.team_id);
    assert.equal(row.name, 'Equipo renombrado');
  });

  it('bundle merge keeps local clinical_users when incoming omits them on rotation nueva', () => {
    const local = {
      exportedAt: '2026-06-01T10:00:00.000Z',
      rotationNuevaAt: '2026-06-01T08:00:00.000Z',
      clinical_users: [
        {
          user_id: 'u-local',
          username: 'kept_user',
          rank: 'R1',
          clinical_name: 'Kept',
          sala: 'Sala 1',
        },
      ],
      teams: [],
      team_membership: [],
    };
    const incoming = {
      exportedAt: '2026-06-02T10:00:00.000Z',
      rotationNuevaAt: '2026-06-02T09:00:00.000Z',
      teams: [{ team_id: 't-new', name: 'Nuevo', service: 'Sala' }],
      team_membership: [],
    };
    const merged = mergeClinicalOpsSnapshotsData(local, incoming);
    assert.equal(merged.clinical_users.length, 1);
    assert.equal(merged.clinical_users[0].username, 'kept_user');
  });
});
