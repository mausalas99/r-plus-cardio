import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations } from '../../../lib/db/schema.mjs';
import { upsertBlob } from '../../../lib/db/clinical-blobs.mjs';
import {
  createProcedimientoItem,
  serializePendientesJson,
} from '../../../lib/entrega/entrega-pendientes.mjs';
import {
  ensureClinicalUser,
  fetchActiveGuardias,
  upsertRotationCycle,
  getActiveRotationCycle,
  createTeam,
  addTeamMember,
  removeTeamMember,
  setTeamGuardiaToday,
  getTeamGuardiaToday,
  upsertActiveGuardia,
  promoteTeamLeader,
  getTeamById,
  updateTeam,
  archiveTeam,
  findUserTeamForAutoAssign,
  claimUsername,
  resolveBootstrapClinicalUser,
  attachClinicalIdentityByUsername,
  migrateTeamMemberships,
  listTeamsBySala,
  buildActivePatientCountByTeam,
  buildLanAssignmentCountByTeam,
  loadCensusPatientIdSet,
  countTeamsInEffectiveSala,
  effectiveTeamSala,
  joinTeam,
  getSalaTeamCountWarning,
  SOFT_MAX_TEAMS_PER_SALA,
  fetchOrphanActiveGuardias,
  resolveActiveGuardia,
  getLanResolvedGuardias,
  getClinicalScopeContext,
  fetchIncomingAssignments,
  assignPatientToTeam,
  upsertClinicalProfile,
  touchClinicalUserActivity,
  completeActiveGuardiaPendiente,
  listEntregaTemplates,
  listLanDirectoryUsers,
  deleteLanDirectoryUser,
  saveEntregaTemplateUser,
  saveEntregaTemplateTeam,
  deleteEntregaTemplate,
} from '../../../lib/db/clinical-access-db.mjs';

describe('clinical-access-db', () => {
  /** @type {import('better-sqlite3').Database} */
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
  });

  it('ensureClinicalUser creates and reuses a device user', () => {
    const first = ensureClinicalUser(db, { clientId: 'client-a', rank: 'R2' });
    const second = ensureClinicalUser(db, { clientId: 'client-a', rank: 'R4' });
    assert.equal(first.userId, second.userId);
    assert.equal(second.rank, 'R2');
    assert.match(first.publicKeyPem, /BEGIN PUBLIC KEY/);
    assert.match(first.privateKeyPem, /BEGIN PRIVATE KEY/);
  });

  it('derives preview_start_at from effective_at and preview_days', () => {
    db.prepare(
      `INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key)
       VALUES ('u-admin', 'u-admin', 'x', 'Admin', 'pk', 'ek')`
    ).run();
    const cycle = upsertRotationCycle(db, {
      monthEndAt: '2026-05-31T23:59:59',
      effectiveAt: '2026-06-01T00:00:00',
      previewDays: 2,
      createdBy: 'u-admin',
    });
    assert.equal(cycle.preview_start_at, '2026-05-30T00:00:00');
    assert.equal(getActiveRotationCycle(db)?.cycle_id, cycle.cycle_id);
  });

  it('declares team Guardia with last-write per team_id', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'a', rank: 'R2' });
    const u2 = ensureClinicalUser(db, { clientId: 'b', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Sala A',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: u1.userId,
    });
    assert.equal(team.leader_user_id, u1.userId);
    assert.equal(team.rotation_active, 1);
    addTeamMember(db, team.team_id, u1.userId);
    setTeamGuardiaToday(db, team.team_id, u1.userId);
    setTeamGuardiaToday(db, team.team_id, u2.userId);
    const g = getTeamGuardiaToday(db, team.team_id);
    assert.equal(g.user_id, u2.userId);
  });

  it('upserts guardia row for Entrega', () => {
    const u = ensureClinicalUser(db, { clientId: 'r1', rank: 'R1' });
    const team = createTeam(db, {
      name: 'A1',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p1',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      isCritical: 1,
      pendientesJson: '[]',
      vitalsFrequency: '2h',
    });
    const rows = fetchActiveGuardias(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].patient_id, 'p1');
    assert.equal(rows[0].is_critical, 1);
    assert.equal(rows[0].vitals_frequency, '2h');
  });

  it('fetchActiveGuardias filters by covering user', () => {
    const user = ensureClinicalUser(db, { clientId: 'u1' });
    const other = ensureClinicalUser(db, { clientId: 'u2' });
    db.prepare(
      `INSERT INTO active_guardias (guardia_id, patient_id, covering_user_id, source_team_id, status)
       VALUES ('g1', 'p1', ?, 't1', 'Active')`
    ).run(user.userId);
    db.prepare(
      `INSERT INTO active_guardias (guardia_id, patient_id, covering_user_id, source_team_id, status)
       VALUES ('g2', 'p2', ?, 't1', 'Active')`
    ).run(other.userId);

    const mine = fetchActiveGuardias(db, user.userId);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].patient_id, 'p1');
  });

  it('promoteTeamLeader updates leader_user_id and returns full team row', () => {
    const u = ensureClinicalUser(db, { clientId: 'leader', rank: 'R2' });
    const newLeader = ensureClinicalUser(db, { clientId: 'new-leader', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Team A',
      service: 'Sala',
      onCallDayIndex: 2,
      createdBy: u.userId,
    });
    assert.equal(team.leader_user_id, u.userId);

    const updated = promoteTeamLeader(db, team.team_id, newLeader.userId);
    assert.ok(updated);
    assert.equal(updated.team_id, team.team_id);
    assert.equal(updated.leader_user_id, newLeader.userId);
    assert.equal(updated.name, 'Team A');
    assert.equal(updated.service, 'Sala');
    assert.equal(updated.on_call_day_index, 2);
    assert.equal(updated.rotation_active, 1);
    assert.equal(updated.archived_at, null);
  });

  it('getTeamById returns full team row', () => {
    const u = ensureClinicalUser(db, { clientId: 'u', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Team B',
      service: 'Sala',
      onCallDayIndex: 1,
      sala: 'Sala 1',
      teamLeaderName: 'Dr. Smith',
      createdBy: u.userId,
    });

    const fetched = getTeamById(db, team.team_id);
    assert.ok(fetched);
    assert.equal(fetched.team_id, team.team_id);
    assert.equal(fetched.name, 'Team B');
    assert.equal(fetched.service, 'Sala');
    assert.equal(fetched.on_call_day_index, 1);
    assert.equal(fetched.sala, 'Sala 1');
    assert.equal(fetched.team_leader_name, 'Dr. Smith');
    assert.equal(fetched.leader_user_id, u.userId);
    assert.equal(fetched.rotation_active, 1);
    assert.equal(fetched.sub_area_fraction, null);
    assert.equal(fetched.archived_at, null);
  });

  it('getTeamById returns undefined for nonexistent team', () => {
    assert.equal(getTeamById(db, 'nonexistent-id'), undefined);
  });

  it('findUserTeamForAutoAssign returns team_id for active team member', () => {
    const u = ensureClinicalUser(db, { clientId: 'r1', rank: 'R1' });
    const leader = ensureClinicalUser(db, { clientId: 'r2leader', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Auto Team',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: leader.userId,
    });
    addTeamMember(db, team.team_id, u.userId);

    const result = findUserTeamForAutoAssign(db, u.userId);
    assert.ok(result);
    assert.equal(result.team_id, team.team_id);
  });

  it('findUserTeamForAutoAssign returns null for non-member', () => {
    const u = ensureClinicalUser(db, { clientId: 'nonmember', rank: 'R1' });
    assert.equal(findUserTeamForAutoAssign(db, u.userId), null);
  });

  it('findUserTeamForAutoAssign returns null when team is archived', () => {
    const u = ensureClinicalUser(db, { clientId: 'archived-r1', rank: 'R1' });
    const leader = ensureClinicalUser(db, { clientId: 'archived-r2', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Archived Team',
      service: 'Sala',
      onCallDayIndex: 3,
      createdBy: leader.userId,
    });
    addTeamMember(db, team.team_id, u.userId);
    db.prepare(`UPDATE teams SET archived_at = ?, rotation_active = 0 WHERE team_id = ?`).run(
      new Date().toISOString(),
      team.team_id
    );

    assert.equal(findUserTeamForAutoAssign(db, u.userId), null);
  });

  it('findUserTeamForAutoAssign returns null when rotation_active is 0', () => {
    const u = ensureClinicalUser(db, { clientId: 'inactive-r1', rank: 'R1' });
    const leader = ensureClinicalUser(db, { clientId: 'inactive-r2', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Inactive Team',
      service: 'Sala',
      onCallDayIndex: 4,
      createdBy: leader.userId,
    });
    addTeamMember(db, team.team_id, u.userId);
    db.prepare(`UPDATE teams SET rotation_active = 0 WHERE team_id = ?`).run(team.team_id);

    assert.equal(findUserTeamForAutoAssign(db, u.userId), null);
  });

  it('removeTeamMember blocks leave when active guardia covers team', () => {
    const leader = ensureClinicalUser(db, { clientId: 'lead-leave', rank: 'R2' });
    const r1 = ensureClinicalUser(db, { clientId: 'r1leave', rank: 'R1' });
    const team = createTeam(db, {
      name: 'Leave Block',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: leader.userId,
    });
    addTeamMember(db, team.team_id, r1.userId);
    upsertActiveGuardia(db, {
      patientId: 'p-leave-1',
      coveringUserId: r1.userId,
      sourceTeamId: team.team_id,
    });
    assert.throws(
      () => removeTeamMember(db, team.team_id, r1.userId),
      /entregas activas/
    );
    db.prepare(`DELETE FROM active_guardias WHERE patient_id = ?`).run('p-leave-1');
    removeTeamMember(db, team.team_id, r1.userId);
    const row = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, r1.userId);
    assert.equal(row, undefined);
  });

  it('buildActivePatientCountByTeam ignores LAN stubs without census chart', () => {
    const leader = ensureClinicalUser(db, { clientId: 'lead-stub-count', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Stub Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: leader.userId,
    });
    const now = new Date().toISOString();
    assignPatientToTeam(db, { patientId: 'stub-only', teamId: team.team_id, effectiveAt: now });
    assignPatientToTeam(db, { patientId: 'p-real', teamId: team.team_id, effectiveAt: now });
    db.prepare(`INSERT OR IGNORE INTO patients (id) VALUES ('p-real')`).run();
    upsertBlob(db, 'patients', JSON.stringify([{ id: 'p-real', nombre: 'REAL' }]));
    const censusCounts = buildActivePatientCountByTeam(db, now);
    const lanCounts = buildLanAssignmentCountByTeam(db, now);
    assert.equal(censusCounts.get(team.team_id), 1);
    assert.equal(lanCounts.get(team.team_id), 2);
  });

  it('buildActivePatientCountByTeam counts latest assignment per patient', () => {
    const leader = ensureClinicalUser(db, { clientId: 'lead-pat-count', rank: 'R2' });
    const teamA = createTeam(db, {
      name: 'Team A',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: leader.userId,
    });
    const teamB = createTeam(db, {
      name: 'Team B',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: leader.userId,
    });
    const now = new Date().toISOString();
    assignPatientToTeam(db, { patientId: 'p1', teamId: teamA.team_id, effectiveAt: '2026-06-01T00:00:00.000Z' });
    assignPatientToTeam(db, { patientId: 'p2', teamId: teamA.team_id, effectiveAt: '2026-06-01T00:00:00.000Z' });
    assignPatientToTeam(db, { patientId: 'p1', teamId: teamB.team_id, effectiveAt: now });
    upsertBlob(
      db,
      'patients',
      JSON.stringify([
        { id: 'p1', nombre: 'P1' },
        { id: 'p2', nombre: 'P2' },
      ])
    );
    const counts = buildActivePatientCountByTeam(db, now);
    assert.equal(counts.get(teamA.team_id), 1);
    assert.equal(counts.get(teamB.team_id), 1);
  });

  it('listTeamsBySala returns members, joinEligible, and patientCount', () => {
    const leader = ensureClinicalUser(db, { clientId: 'lead', rank: 'R2' });
    const r1 = ensureClinicalUser(db, { clientId: 'r1join', rank: 'R1' });
    const team = createTeam(db, {
      name: 'Sala Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: leader.userId,
    });
    addTeamMember(db, team.team_id, leader.userId);
    const rows = listTeamsBySala(db, { sala: 'Sala 1', forUserId: r1.userId });
    assert.ok(rows.length >= 1);
    const row = rows.find((t) => t.team_id === team.team_id);
    assert.ok(row);
    assert.ok(Array.isArray(row.members));
    assert.equal(row.joinEligible, true);
    assert.equal(row.patientCount, 0);
    joinTeam(db, team.team_id, r1.userId);
    const after = listTeamsBySala(db, { sala: 'Sala 1', forUserId: r1.userId });
    const joined = after.find((t) => t.team_id === team.team_id);
    assert.equal(joined?.isMember, true);
  });

  it('R2 can join a team that already has two R1s', () => {
    const r2join = ensureClinicalUser(db, { clientId: 'r2-join-full', rank: 'R2', sala: 'Sala 1' });
    const r1a = ensureClinicalUser(db, { clientId: 'r1a-full', rank: 'R1', sala: 'Sala 1' });
    const r1b = ensureClinicalUser(db, { clientId: 'r1b-full', rank: 'R1', sala: 'Sala 1' });
    const team = createTeam(db, {
      name: 'Full R1 Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: r1a.userId,
    });
    addTeamMember(db, team.team_id, r1a.userId);
    addTeamMember(db, team.team_id, r1b.userId);

    const rows = listTeamsBySala(db, { sala: 'Sala 1', forUserId: r2join.userId });
    const row = rows.find((t) => t.team_id === team.team_id);
    assert.ok(row);
    assert.equal(row.joinEligible, true);

    joinTeam(db, team.team_id, r2join.userId);
    const member = db
      .prepare(`SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?`)
      .get(team.team_id, r2join.userId);
    assert.ok(member);
  });

  it('R1 can join a team that already has two R1s with a soft warning', () => {
    const r1a = ensureClinicalUser(db, { clientId: 'r1a-soft', rank: 'R1', sala: 'Sala 1' });
    const r1b = ensureClinicalUser(db, { clientId: 'r1b-soft', rank: 'R1', sala: 'Sala 1' });
    const r1c = ensureClinicalUser(db, { clientId: 'r1c-soft', rank: 'R1', sala: 'Sala 1' });
    const team = createTeam(db, {
      name: 'Soft R1 Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: r1a.userId,
    });
    addTeamMember(db, team.team_id, r1a.userId);
    addTeamMember(db, team.team_id, r1b.userId);

    const rows = listTeamsBySala(db, { sala: 'Sala 1', forUserId: r1c.userId });
    const row = rows.find((t) => t.team_id === team.team_id);
    assert.ok(row);
    assert.equal(row.joinEligible, true);
    assert.match(String(row.joinWarning || ''), /recomendado máximo/);

    const { warnings } = joinTeam(db, team.team_id, r1c.userId);
    assert.ok(Array.isArray(warnings));
    assert.match(String(warnings[0] || ''), /recomendado máximo/);
  });

  it('allows more than SOFT_MAX_TEAMS_PER_SALA teams with a sala count warning', () => {
    for (let i = 0; i < SOFT_MAX_TEAMS_PER_SALA; i += 1) {
      const leader = ensureClinicalUser(db, {
        clientId: `sala-max-lead-${i}`,
        rank: 'R2',
        sala: 'Sala 1',
      });
      const team = createTeam(db, {
        name: `Team ${i + 1}`,
        service: 'Sala',
        onCallDayIndex: 0,
        sala: 'Sala 1',
        createdBy: leader.userId,
      });
      addTeamMember(db, team.team_id, leader.userId);
    }
    assert.match(String(getSalaTeamCountWarning(db, 'Sala 1') || ''), /recomendado máximo/);
    const extraLeader = ensureClinicalUser(db, {
      clientId: 'sala-max-lead-extra',
      rank: 'R2',
      sala: 'Sala 1',
    });
    const extra = createTeam(db, {
      name: 'Team extra',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: extraLeader.userId,
    });
    assert.ok(extra.team_id);
    assert.equal(countTeamsInEffectiveSala(db, 'Sala 1'), SOFT_MAX_TEAMS_PER_SALA + 1);
  });

  it('fetchOrphanActiveGuardias returns entregas missing from census blob', () => {
    const u = ensureClinicalUser(db, { clientId: 'orphan-guardia', rank: 'R2' });
    const team = createTeam(db, {
      name: 'Orphan Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: u.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'orphan-patient',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      vitalsFrequency: '2h',
    });
    upsertActiveGuardia(db, {
      patientId: 'local-patient',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      vitalsFrequency: '1h',
    });
    upsertBlob(db, 'patients', JSON.stringify([{ id: 'local-patient', nombre: 'LOCAL' }]));

    const orphans = fetchOrphanActiveGuardias(db, u.userId);
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].patient_id, 'orphan-patient');
  });

  it('resolveActiveGuardia records LAN resolution tombstone', () => {
    const u = ensureClinicalUser(db, { clientId: 'resolve-tombstone', rank: 'R1' });
    const team = createTeam(db, {
      name: 'Tombstone Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: u.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p-tombstone',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
    });
    const res = resolveActiveGuardia(db, { patientId: 'p-tombstone' });
    assert.equal(res.resolved, true);
    const tombstones = getLanResolvedGuardias(db);
    assert.equal(tombstones.length, 1);
    assert.equal(tombstones[0].patient_id, 'p-tombstone');
    assert.ok(tombstones[0].assigned_at);
  });

  it('resolveActiveGuardia marks entrega as Resolved', () => {
    const u = ensureClinicalUser(db, { clientId: 'resolve-guardia', rank: 'R1' });
    const team = createTeam(db, {
      name: 'Resolve Team',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: u.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p-resolve',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
    });
    const res = resolveActiveGuardia(db, { patientId: 'p-resolve' });
    assert.equal(res.resolved, true);
    assert.equal(fetchActiveGuardias(db, u.userId).length, 0);
    const row = db
      .prepare(`SELECT status FROM active_guardias WHERE patient_id = ?`)
      .get('p-resolve');
    assert.equal(row.status, 'Resolved');
  });

  it('countTeamsInEffectiveSala includes teams inferred from creator', () => {
    const leader = ensureClinicalUser(db, {
      clientId: 'lead-count-sala',
      rank: 'R2',
      sala: 'Sala 2',
    });
    createTeam(db, {
      name: 'Inferred Sala Team',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: leader.userId,
    });
    assert.equal(countTeamsInEffectiveSala(db, 'Sala 2'), 1);
  });

  it('listTeamsBySala matches teams without sala via creator profile', () => {
    const leader = ensureClinicalUser(db, {
      clientId: 'lead-infer-sala',
      rank: 'R2',
      sala: 'Sala 2',
    });
    const r1 = ensureClinicalUser(db, { clientId: 'r1-infer-sala', rank: 'R1', sala: 'Sala 2' });
    const team = createTeam(db, {
      name: 'Legacy Team',
      service: 'Torre HU',
      onCallDayIndex: 0,
      createdBy: leader.userId,
    });
    assert.equal(effectiveTeamSala(db, team), 'Sala 2');
    addTeamMember(db, team.team_id, leader.userId);
    const rows = listTeamsBySala(db, { sala: 'Sala 2', forUserId: r1.userId });
    assert.ok(rows.some((t) => t.team_id === team.team_id));
  });

  it('claimUsername updates row and rejects duplicate', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R1' });
    const u2 = ensureClinicalUser(db, { clientId: 'device-b', rank: 'R1' });
    claimUsername(db, { userId: u1.userId, username: 'mgarcia' });
    const row = db.prepare('SELECT username FROM users WHERE user_id = ?').get(u1.userId);
    assert.equal(row.username, 'mgarcia');
    assert.throws(
      () => claimUsername(db, { userId: u2.userId, username: 'mgarcia' }),
      /ya está en uso/
    );
  });

  it('resolveBootstrapClinicalUser prefers LAN handle over new device row', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R1' });
    claimUsername(db, { userId: u1.userId, username: 'msalas' });
    const ghost = ensureClinicalUser(db, { clientId: 'device-b', rank: 'R1' });
    assert.notEqual(ghost.userId, u1.userId);
    const resumed = resolveBootstrapClinicalUser(db, {
      clientId: 'device-b',
      rank: 'R1',
      preferredUsername: 'msalas',
    });
    assert.equal(resumed.userId, u1.userId);
    assert.equal(resumed.username, 'msalas');
  });

  it('resolveBootstrapClinicalUser prefers stored user id', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R2' });
    const resumed = resolveBootstrapClinicalUser(db, {
      clientId: 'other-device',
      preferredUserId: u1.userId,
    });
    assert.equal(resumed.userId, u1.userId);
  });

  it('resolveBootstrapClinicalUser ignores stale user id when LAN handle is set', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R1' });
    claimUsername(db, { userId: u1.userId, username: 'msalas' });
    const ghost = ensureClinicalUser(db, { clientId: 'device-b', rank: 'R1' });
    const resumed = resolveBootstrapClinicalUser(db, {
      clientId: 'device-b',
      preferredUserId: ghost.userId,
      preferredUsername: 'msalas',
    });
    assert.equal(resumed.userId, u1.userId);
    assert.equal(resumed.username, 'msalas');
  });

  it('migrateTeamMemberships moves rows to recovered user', () => {
    const ghost = ensureClinicalUser(db, { clientId: 'ghost-dev', rank: 'R1' });
    const real = ensureClinicalUser(db, { clientId: 'real-dev', rank: 'R1' });
    claimUsername(db, { userId: real.userId, username: 'msalas' });
    const team = createTeam(db, {
      name: 'Equipo',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: ghost.userId,
    });
    joinTeam(db, team.team_id, ghost.userId);
    const moved = migrateTeamMemberships(db, {
      fromUserId: ghost.userId,
      toUserId: real.userId,
    });
    assert.equal(moved.moved, 1);
    const members = db
      .prepare('SELECT user_id FROM team_membership WHERE team_id = ?')
      .all(team.team_id);
    assert.equal(members.length, 1);
    assert.equal(members[0].user_id, real.userId);
  });

  it('attachClinicalIdentityByUsername returns existing LAN user', () => {
    const u1 = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R1' });
    claimUsername(db, { userId: u1.userId, username: 'msalas' });
    const found = attachClinicalIdentityByUsername(db, 'msalas');
    assert.equal(found.userId, u1.userId);
    assert.throws(() => attachClinicalIdentityByUsername(db, 'nope'), /No encontramos/);
  });

  it('touchClinicalUserActivity and profile upsert record last_activity_at', () => {
    const u = ensureClinicalUser(db, { clientId: 'activity-dev', rank: 'R2' });
    touchClinicalUserActivity(db, u.userId, '2026-06-10T10:00:00.000Z');
    let row = db.prepare('SELECT last_activity_at FROM users WHERE user_id = ?').get(u.userId);
    assert.equal(row.last_activity_at, '2026-06-10T10:00:00.000Z');
    touchClinicalUserActivity(db, u.userId, '2026-06-09T08:00:00.000Z');
    row = db.prepare('SELECT last_activity_at FROM users WHERE user_id = ?').get(u.userId);
    assert.equal(row.last_activity_at, '2026-06-10T10:00:00.000Z');
    upsertClinicalProfile(db, {
      userId: u.userId,
      clinicalName: 'Dr. Activo',
      rank: 'R2',
      sala: 'Sala 1',
    });
    row = db.prepare('SELECT last_activity_at FROM users WHERE user_id = ?').get(u.userId);
    assert.ok(String(row.last_activity_at || '').length > 0);
  });

  it('upsertClinicalProfile requires admin code when enabling program admin', () => {
    const u = ensureClinicalUser(db, { clientId: 'device-a', rank: 'R1' });
    assert.throws(
      () =>
        upsertClinicalProfile(db, {
          userId: u.userId,
          clinicalName: 'Dr. Test',
          rank: 'R1',
          sala: 'Sala 1',
          isProgramAdmin: true,
        }),
      /Código de administración incorrecto/
    );
    const profile = upsertClinicalProfile(db, {
      userId: u.userId,
      clinicalName: 'Dr. Test',
      rank: 'R1',
      sala: 'Sala 1',
      isProgramAdmin: true,
      adminAccessCode: 'Msg170699',
    });
    assert.equal(profile.is_program_admin, 1);
  });

  it('updateTeam and archiveTeam require elevated roster privileges', () => {
    const r2 = ensureClinicalUser(db, { clientId: 'r2-dev', rank: 'R2' });
    const r4 = ensureClinicalUser(db, { clientId: 'r4-dev', rank: 'R4' });
    const team = createTeam(db, {
      name: 'Equipo A',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: r4.userId,
    });

    assert.throws(
      () => updateTeam(db, team.team_id, { name: 'Nuevo', callerUserId: r2.userId }),
      /privilegios de administración/
    );
    assert.throws(
      () => archiveTeam(db, team.team_id, r2.userId),
      /privilegios de administración/
    );

    const updated = updateTeam(db, team.team_id, {
      name: 'Equipo renombrado',
      sala: 'Sala 2',
      callerUserId: r4.userId,
    });
    assert.equal(updated.name, 'Equipo renombrado');
    assert.equal(updated.sala, 'Sala 2');

    const archived = archiveTeam(db, team.team_id, r4.userId);
    assert.ok(archived.archived_at);
    assert.equal(getTeamById(db, team.team_id).archived_at, archived.archived_at);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS cnt FROM team_membership WHERE team_id = ?').get(team.team_id)
        .cnt,
      0
    );
  });

  it('completeActiveGuardiaPendiente marks item and persists v2 JSON', () => {
    const u = ensureClinicalUser(db, { clientId: 'r1-complete', rank: 'R1' });
    const team = createTeam(db, {
      name: 'A1',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    const item = createProcedimientoItem({ label: 'TAC', kind: 'imagen' });
    const pendientesJson = serializePendientesJson({ version: 2, items: [item] });
    upsertActiveGuardia(db, {
      patientId: 'p-complete',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      pendientesJson,
    });

    const completed = completeActiveGuardiaPendiente(db, {
      patientId: 'p-complete',
      itemId: item.id,
      completedBy: { kind: 'interno', name: 'Ana' },
    });
    assert.ok(completed?.completedAt);
    assert.equal(completed.completedBy.name, 'Ana');

    const row = fetchActiveGuardias(db).find((g) => g.patient_id === 'p-complete');
    const stored = JSON.parse(row.pendientes_json);
    assert.equal(stored.items[0].completedAt, completed.completedAt);

    const again = completeActiveGuardiaPendiente(db, {
      patientId: 'p-complete',
      itemId: item.id,
      completedBy: { kind: 'interno', name: 'Other' },
    });
    assert.equal(again.completedAt, completed.completedAt);
  });

  it('completeActiveGuardiaPendiente returns null when patient or item missing', () => {
    assert.equal(
      completeActiveGuardiaPendiente(db, {
        patientId: 'missing',
        itemId: 'x',
        completedBy: { kind: 'interno' },
      }),
      null
    );
  });

  it('listEntregaTemplates returns user and team templates', () => {
    const u = ensureClinicalUser(db, { clientId: 'tpl-user', rank: 'R1' });
    const team = createTeam(db, {
      name: 'TplTeam',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    const payload = {
      kind: 'imagen',
      label: 'TAC',
      requires: { consentimiento: true },
      comentado: false,
      autorizado: false,
      agendado: false,
    };
    saveEntregaTemplateUser(db, { userId: u.userId, name: 'Mi TAC', payload });
    saveEntregaTemplateTeam(db, {
      teamId: team.team_id,
      createdBy: u.userId,
      name: 'Equipo TAC',
      payload,
    });

    const listed = listEntregaTemplates(db, { userId: u.userId, teamIds: [team.team_id] });
    assert.equal(listed.user.length, 1);
    assert.equal(listed.user[0].name, 'Mi TAC');
    assert.equal(listed.user[0].payload.kind, 'imagen');
    assert.equal(listed.team.length, 1);
    assert.equal(listed.team[0].teamId, team.team_id);
    assert.equal(listed.team[0].payload.requires.consentimiento, true);
  });

  it('saveEntregaTemplateUser updates existing template by id', () => {
    const u = ensureClinicalUser(db, { clientId: 'tpl-update', rank: 'R1' });
    const saved = saveEntregaTemplateUser(db, {
      userId: u.userId,
      name: 'Original',
      payload: { kind: 'otro', label: 'X' },
    });
    const updated = saveEntregaTemplateUser(db, {
      userId: u.userId,
      templateId: saved.templateId,
      name: 'Renombrada',
      payload: { kind: 'imagen', label: 'MRI' },
    });
    assert.equal(updated.templateId, saved.templateId);
    assert.equal(updated.name, 'Renombrada');
    assert.equal(updated.payload.kind, 'imagen');
  });

  it('deleteEntregaTemplate removes user or team row by scope', () => {
    const u = ensureClinicalUser(db, { clientId: 'tpl-del', rank: 'R1' });
    const team = createTeam(db, {
      name: 'DelTeam',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    const userTpl = saveEntregaTemplateUser(db, {
      userId: u.userId,
      name: 'Borrar',
      payload: { label: 'A' },
    });
    const teamTpl = saveEntregaTemplateTeam(db, {
      teamId: team.team_id,
      name: 'Borrar equipo',
      payload: { label: 'B' },
    });

    assert.equal(deleteEntregaTemplate(db, { scope: 'user', templateId: userTpl.templateId }), true);
    assert.equal(
      deleteEntregaTemplate(db, { scope: 'team', templateId: teamTpl.templateId }),
      true
    );
    const listed = listEntregaTemplates(db, { userId: u.userId, teamIds: [team.team_id] });
    assert.equal(listed.user.length, 0);
    assert.equal(listed.team.length, 0);
  });

  it('getClinicalScopeContext includes active patient team assignments', () => {
    const admin = ensureClinicalUser(db, { clientId: 'admin-scope', rank: 'Admin' });
    const team = createTeam(db, {
      name: 'Equipo A',
      service: 'Sala',
      onCallDayIndex: 1,
      sala: 'Sala 1',
      createdBy: admin.userId,
    });
    assignPatientToTeam(db, {
      patientId: 'p-active',
      teamId: team.team_id,
      effectiveAt: '2026-06-01T00:00:00Z',
    });
    const ctx = getClinicalScopeContext(db, admin.userId);
    assert.ok(Array.isArray(ctx.assignments));
    assert.equal(
      ctx.assignments.some((row) => row.patient_id === 'p-active' && row.team_id === team.team_id),
      true
    );
  });

  it('fetchIncomingAssignments uses only patients columns present in schema', () => {
    const admin = ensureClinicalUser(db, { clientId: 'admin', rank: 'Admin' });
    upsertRotationCycle(db, {
      monthEndAt: '2026-05-31T23:59:59',
      effectiveAt: '2026-06-01T00:00:00',
      previewDays: 2,
      createdBy: admin.userId,
    });
    db.prepare(`INSERT INTO patients (id) VALUES ('p-incoming')`).run();
    const team = createTeam(db, {
      name: 'Sala 2',
      service: 'Sala',
      onCallDayIndex: 1,
      sala: 'Sala 2',
      createdBy: admin.userId,
    });
    assignPatientToTeam(db, {
      patientId: 'p-incoming',
      teamId: team.team_id,
      effectiveAt: '2026-06-01T00:00:00',
    });
    const nowIso = '2026-05-30T12:00:00';
    const rows = fetchIncomingAssignments(db, nowIso);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].patient_id, 'p-incoming');
    assert.doesNotThrow(() => getClinicalScopeContext(db));
  });

  it('listLanDirectoryUsers includes registered handles and teammates pending @usuario', () => {
    const admin = ensureClinicalUser(db, {
      clientId: 'admin-dir',
      rank: 'R4',
      clinicalName: 'Admin',
    });
    claimUsername(db, { userId: admin.userId, username: 'admin_dir' });

    const legacy = ensureClinicalUser(db, {
      clientId: 'lc_pending_device',
      rank: 'R1',
      clinicalName: 'Residente Pendiente',
      sala: 'Sala 1',
    });
    const team = createTeam(db, {
      name: 'Equipo dir',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: admin.userId,
    });
    addTeamMember(db, team.team_id, legacy.userId);

    const listed = listLanDirectoryUsers(db);
    const adminRow = listed.find((u) => u.user_id === admin.userId);
    const legacyRow = listed.find((u) => u.user_id === legacy.userId);
    assert.ok(adminRow);
    assert.equal(adminRow.lanDirectoryPending, false);
    assert.ok(legacyRow);
    assert.equal(legacyRow.lanDirectoryPending, true);
  });

  it('deleteLanDirectoryUser removes user and blocks listLanDirectoryUsers', () => {
    const admin = ensureClinicalUser(db, {
      clientId: 'admin-del',
      rank: 'R4',
      clinicalName: 'Admin Del',
    });
    claimUsername(db, { userId: admin.userId, username: 'admin_del' });

    const target = ensureClinicalUser(db, {
      clientId: 'target-del-device',
      rank: 'R1',
      clinicalName: 'Borrar Yo',
      sala: 'Sala 1',
    });
    claimUsername(db, { userId: target.userId, username: 'borrar_yo' });
    const team = createTeam(db, {
      name: 'Equipo del',
      service: 'Sala',
      onCallDayIndex: 1,
      createdBy: admin.userId,
      sala: 'Sala 1',
    });
    joinTeam(db, team.team_id, target.userId);

    deleteLanDirectoryUser(db, {
      targetUserId: target.userId,
      callerUserId: admin.userId,
    });

    assert.equal(
      db.prepare('SELECT 1 AS ok FROM users WHERE user_id = ?').get(target.userId),
      undefined
    );
    assert.equal(
      db
        .prepare('SELECT 1 AS ok FROM team_membership WHERE team_id = ? AND user_id = ?')
        .get(team.team_id, target.userId),
      undefined
    );
    const listed = listLanDirectoryUsers(db);
    assert.ok(!listed.some((u) => u.user_id === target.userId));
    assert.throws(
      () =>
        deleteLanDirectoryUser(db, {
          targetUserId: admin.userId,
          callerUserId: admin.userId,
        }),
      /No puedes eliminar tu propio usuario/
    );
  });
});
