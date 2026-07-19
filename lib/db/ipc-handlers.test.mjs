import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerDbIpcHandlers } from './ipc-handlers.mjs';
import { createUnlockedDbManager } from './test-open-db.mjs';
import { verifyChainRows } from './forensic-audit.mjs';
import { getTeamById } from './clinical-access-db.mjs';

function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handle(channel, fn) {
      handlers.set(channel, fn);
    },
    async invoke(channel, args) {
      const fn = handlers.get(channel);
      if (!fn) throw new Error('no handler: ' + channel);
      return fn({ sender: { id: 1 } }, args);
    },
    handlers,
  };
}

function createFakeApp(tmpDir) {
  return {
    getPath(name) {
      if (name === 'userData') return tmpDir;
      return tmpDir;
    },
    getVersion() {
      return 'test';
    },
  };
}

function createIpcHarness() {
  /** @type {string | undefined} */
  let tmpDir;
  /** @type {Awaited<ReturnType<typeof createUnlockedDbManager>> | undefined} */
  let mgr;
  /** @type {ReturnType<typeof createFakeIpcMain> | undefined} */
  let ipc;

  return {
    async init() {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-ipc-'));
      mgr = await createUnlockedDbManager(tmpDir, () => 'ipc-test-client');
      ipc = createFakeIpcMain();
      registerDbIpcHandlers({
        ipcMain: ipc,
        dbManager: mgr,
        app: createFakeApp(tmpDir),
        dialog: { showOpenDialog: async () => ({ canceled: true }) },
        safeStorage: null,
        getClientId: () => 'ipc-test-client',
      });
    },
    async teardown() {
      try {
        mgr?.lock();
      } catch { /* ignored */ }
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
      mgr = undefined;
      ipc = undefined;
    },
    get ipc() {
      if (!ipc) throw new Error('harness not initialized');
      return ipc;
    },
    get mgr() {
      if (!mgr) throw new Error('harness not initialized');
      return mgr;
    },
  };
}

describe('db IPC handlers — surface', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('registers a large handler surface', () => {
    assert.ok(harness.ipc.handlers.size >= 50);
  });
});

describe('db IPC handlers — bootstrap', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-access-bootstrap returns a user', async () => {
    const out = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R2',
      preferredUsername: 'dr_ipc_test',
    });
    assert.equal(out.ok, true);
    assert.ok(out.user?.userId);
    assert.equal(out.user.rank, 'R2');
  });
});

describe('db IPC handlers — teams', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-teams-create and list round-trip', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'lead_ipc',
    });
    const created = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Equipo IPC',
      service: 'Sala',
      onCallDayIndex: 0,
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    assert.equal(created.ok, true);
    assert.ok(created.team?.team_id);
    const listed = await harness.ipc.invoke('db:clinical-teams-list');
    assert.equal(listed.ok, true);
    assert.ok(listed.teams.some((t) => t.team_id === created.team.team_id));
  });

  it('db:clinical-teams-join adds membership', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'host_ipc',
    });
    const member = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-member',
      rank: 'R1',
      preferredUsername: 'member_ipc',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Join IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    const joined = await harness.ipc.invoke('db:clinical-teams-join', {
      teamId: team.team.team_id,
      userId: member.user.userId,
    });
    assert.equal(joined.ok, true);
    const listed = await harness.ipc.invoke('db:clinical-teams-list');
    const row = listed.teams.find((t) => t.team_id === team.team.team_id);
    assert.ok(row.members.some((m) => m.user_id === member.user.userId));
  });
});

describe('db IPC handlers — teams join guard', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-teams-join rejects missing team', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R1',
    });
    const joined = await harness.ipc.invoke('db:clinical-teams-join', {
      teamId: 'missing-team-id',
      userId: boot.user.userId,
    });
    assert.equal(joined.ok, false);
    assert.ok(joined.error);
  });
});

describe('db IPC handlers — teams admin', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-teams-member-add and remove', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'adder_ipc',
    });
    const guest = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-guest',
      rank: 'R2',
      preferredUsername: 'guest_ipc',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Member IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    const added = await harness.ipc.invoke('db:clinical-teams-member-add', {
      teamId: team.team.team_id,
      userId: guest.user.userId,
      callerUserId: boot.user.userId,
    });
    assert.equal(added.ok, true);
    const removed = await harness.ipc.invoke('db:clinical-teams-member-remove', {
      teamId: team.team.team_id,
      userId: guest.user.userId,
      callerUserId: boot.user.userId,
    });
    assert.equal(removed.ok, true);
  });
});

describe('db IPC handlers — teams promote', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-teams-promote-leader updates leader', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'promote_host',
    });
    const next = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-next',
      rank: 'R3',
      preferredUsername: 'promote_next',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Promote IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    await harness.ipc.invoke('db:clinical-teams-member-add', {
      teamId: team.team.team_id,
      userId: next.user.userId,
      callerUserId: boot.user.userId,
    });
    const promoted = await harness.ipc.invoke('db:clinical-teams-promote-leader', {
      teamId: team.team.team_id,
      userId: next.user.userId,
    });
    assert.equal(promoted.ok, true);
    const dbTeam = await harness.mgr.withTransaction((db) => getTeamById(db, team.team.team_id));
    assert.equal(dbTeam.leader_user_id, next.user.userId);
  });
});

describe('db IPC handlers — teams archive', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-teams-archive marks team archived', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'archive_host',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Archive IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    const archived = await harness.ipc.invoke('db:clinical-teams-archive', {
      teamId: team.team.team_id,
      callerUserId: boot.user.userId,
    });
    assert.equal(archived.ok, true);
    const listed = await harness.ipc.invoke('db:clinical-teams-list');
    assert.equal(listed.teams.some((t) => t.team_id === team.team.team_id), false);
  });
});

describe('db IPC handlers — patient assign', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:clinical-assign-patient-to-team and patient-active-team-id', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'assign_host',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Assign IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    await harness.ipc.invoke('db:clinical-save-all', {
      blobs: { patients: JSON.stringify([{ id: 'p-ipc-1', nombre: 'PACIENTE IPC' }]) },
      auditMeta: { eventType: 'test.seed_patients' },
    });
    const assigned = await harness.ipc.invoke('db:clinical-assign-patient-to-team', {
      patientId: 'p-ipc-1',
      teamId: team.team.team_id,
      effectiveAt: '2026-06-12T00:00:00.000Z',
    });
    assert.equal(assigned.ok, true);
    const active = await harness.ipc.invoke('db:patient-active-team-id', {
      patientId: 'p-ipc-1',
      nowIso: '2026-06-12T12:00:00.000Z',
    });
    assert.equal(active.ok, true);
    assert.equal(active.teamId, team.team.team_id);
  });
});

describe('db IPC handlers — guardia', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:guardia-upsert and resolve', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'guardia_host',
    });
    const team = await harness.ipc.invoke('db:clinical-teams-create', {
      name: 'Guardia IPC',
      service: 'Sala',
      sala: 'Sala 1',
      createdBy: boot.user.userId,
      leaderUserId: boot.user.userId,
    });
    await harness.ipc.invoke('db:clinical-save-all', {
      blobs: { patients: JSON.stringify([{ id: 'p-guardia', nombre: 'GUARDIA IPC' }]) },
      auditMeta: { eventType: 'test.seed_patients' },
    });
    const upserted = await harness.ipc.invoke('db:guardia-upsert', {
      patientId: 'p-guardia',
      coveringUserId: boot.user.userId,
      sourceTeamId: team.team.team_id,
      isCritical: false,
      pendientesJson: '[]',
    });
    assert.equal(upserted.ok, true);
    assert.ok(upserted.guardia?.guardia_id);
    const resolved = await harness.ipc.invoke('db:guardia-resolve', {
      patientId: 'p-guardia',
      guardiaId: upserted.guardia.guardia_id,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.resolved, true);
  });

  it('db:guardia-upsert rejects missing patient id', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R4',
      preferredUsername: 'guardia_neg',
    });
    const upserted = await harness.ipc.invoke('db:guardia-upsert', {
      patientId: '',
      coveringUserId: boot.user.userId,
      sourceTeamId: 'missing-team',
      pendientesJson: '[]',
    });
    assert.equal(upserted.ok, false);
    assert.ok(upserted.error);
  });
});

describe('db IPC handlers — rotation and audit', () => {
  const harness = createIpcHarness();
  beforeEach(() => harness.init());
  afterEach(() => harness.teardown());

  it('db:rotation-cycle-upsert and get', async () => {
    const boot = await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'Admin',
      preferredUsername: 'rotation_admin',
    });
    const upserted = await harness.ipc.invoke('db:rotation-cycle-upsert', {
      monthEndAt: '2026-06-30T23:59:59.000Z',
      effectiveAt: '2026-06-01T00:00:00.000Z',
      previewDays: 2,
      createdBy: boot.user.userId,
    });
    assert.equal(upserted.ok, true);
    assert.ok(upserted.cycle?.cycle_id);
    const got = await harness.ipc.invoke('db:rotation-cycle-get');
    assert.equal(got.ok, true);
    assert.equal(got.cycle?.cycle_id, upserted.cycle.cycle_id);
  });

  it('db:audit-export returns verifiable chain rows after bootstrap', async () => {
    await harness.ipc.invoke('db:clinical-access-bootstrap', {
      clientId: 'ipc-test-client',
      rank: 'R1',
      preferredUsername: 'audit_user',
    });
    const exported = await harness.ipc.invoke('db:audit-export', { limit: 20 });
    assert.equal(exported.ok, true);
    assert.ok(Array.isArray(exported.entries));
    assert.ok(exported.entries.length >= 1);
    const check = verifyChainRows(exported.entries);
    assert.equal(check, null);
  });
});
