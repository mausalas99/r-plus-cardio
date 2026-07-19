'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { createHostStore } = require('./host-store.js');
const { setLanDbManager, resetLanDbManagerForTests } = require('../lib/db/lan-db-bridge.cjs');

test('putRoomClinicalOps writes authoritative snapshot from SQLCipher when DB unlocked', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const { ensureClinicalUser, createTeam } = await import('../lib/db/clinical-access-db.mjs');
  const { exportClinicalOpsSnapshot } = await import('../lib/db/clinical-ops-sync.mjs');

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-db-'));
  const mgr = await createUnlockedDbManager(dbDir);
  resetLanDbManagerForTests();
  setLanDbManager(mgr);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-state-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });

  try {
    const { userId } = await mgr.withTransaction((db) => {
      const user = ensureClinicalUser(db, { clientId: 'host-ops-db', rank: 'R2' });
      createTeam(db, {
        name: 'Host DB Team',
        service: 'Sala',
        onCallDayIndex: 1,
        createdBy: user.userId,
      });
      return { userId: user.userId };
    });

    const room = store.createRoom('Ops DB');
    const baseSnap = await mgr.withTransaction((db) => exportClinicalOpsSnapshot(db));
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      clinicalOps: baseSnap,
    });

    const baseRevision = store.getRoomSyncBundle(room.id).revision;
    const incoming = {
      ...baseSnap,
      exportedAt: '2099-06-01T12:00:00.000Z',
      teams: [
        ...(baseSnap.teams || []),
        {
          team_id: 'lan-peer-team',
          name: 'Peer LAN Team',
          service: 'Sala',
          on_call_day_index: 2,
          created_by: userId,
          created_at: '2099-06-01T12:00:00.000Z',
          rotation_active: 1,
        },
      ],
    };

    const out = await store.putRoomClinicalOps(room.id, {
      baseRevision,
      clientId: 'peer-test',
      snapshot: incoming,
    });

    const dbSnap = await mgr.withTransaction((db) => exportClinicalOpsSnapshot(db));
    const dbTeamIds = new Set((dbSnap.teams || []).map((t) => t.team_id));
    assert.ok(dbTeamIds.has('lan-peer-team'));

    assert.deepStrictEqual(
      (out.snapshot.teams || []).map((t) => t.team_id).sort(),
      (dbSnap.teams || []).map((t) => t.team_id).sort()
    );
    assert.ok(out.snapshot.exportedAt);

    const bundle = store.getRoomSyncBundle(room.id);
    assert.deepStrictEqual(
      (bundle.clinicalOps.teams || []).map((t) => t.team_id).sort(),
      (dbSnap.teams || []).map((t) => t.team_id).sort()
    );
    assert.ok(
      (bundle.clinicalOps.teams || []).some((t) => String(t.team_id) === 'lan-peer-team')
    );
  } finally {
    resetLanDbManagerForTests();
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('putRoomClinicalOps keeps JSON merge when host DB is locked', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-locked-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  resetLanDbManagerForTests();
  setLanDbManager({
    isUnlocked: () => false,
    withTransaction() {
      throw new Error('should not call DB while locked');
    },
    getDb: () => null,
  });

  try {
    const room = store.createRoom('Ops locked');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      clinicalOps: {
        exportedAt: '2020-01-01T00:00:00',
        teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
        team_membership: [],
      },
    });
    const baseRevision = store.getRoomSyncBundle(room.id).revision;
    const out = await store.putRoomClinicalOps(room.id, {
      baseRevision,
      clientId: 'peer-json',
      snapshot: {
        exportedAt: '2025-01-01T00:00:00',
        teams: [{ team_id: 'team-b', name: 'B', created_at: '2025-01-01T00:00:00' }],
        team_membership: [],
      },
    });
    assert.strictEqual(out.snapshot.teams.length, 2);
    assert.ok(out.snapshot.teams.some((t) => t.team_id === 'team-a'));
    assert.ok(out.snapshot.teams.some((t) => t.team_id === 'team-b'));
  } finally {
    resetLanDbManagerForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sync-bundle push with empty clinicalOps must not wipe host roster (locked DB host)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-nowipe-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  resetLanDbManagerForTests();
  // LAN-only host: clinical DB locked, so roster lives only in the in-memory bundle.
  setLanDbManager({
    isUnlocked: () => false,
    withTransaction() {
      throw new Error('should not call DB while locked');
    },
    getDb: () => null,
  });

  try {
    const room = store.createRoom('No wipe');
    const userA = {
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'doctor_a',
      rank: 'R2',
      clinical_name: 'Doctor A',
      sala: 'Sala 2',
      is_program_admin: 0,
    };
    const userB = {
      user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      username: 'doctor_b',
      rank: 'R3',
      clinical_name: 'Doctor B',
      sala: 'Sala 2',
      is_program_admin: 0,
    };

    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      clinicalOps: {
        exportedAt: '2026-06-05T10:00:00.000Z',
        clinical_users: [userA],
        teams: [],
        team_membership: [],
      },
    });

    let rev = store.getRoomSyncBundle(room.id).revision;
    await store.putRoomClinicalOps(room.id, {
      baseRevision: rev,
      clientId: 'peer-b',
      snapshot: {
        exportedAt: '2026-06-05T10:01:00.000Z',
        clinical_users: [userB],
        teams: [],
        team_membership: [],
      },
    });

    let bundle = store.getRoomSyncBundle(room.id);
    assert.equal(
      (bundle.clinicalOps.clinical_users || []).length,
      2,
      'roster should accumulate both peers before the routine bundle push'
    );

    // Routine debounced sync-bundle push with an empty clinicalOps cache (carries null).
    rev = store.getRoomSyncBundle(room.id).revision;
    store.putRoomSyncBundle(room.id, {
      baseRevision: rev,
      baseEntityVersions: store.getRoomSyncBundle(room.id).entityVersions || {},
      agenda: [{ id: 'ev-1', updatedAt: '2026-06-05T10:02:00.000Z', title: 'x' }],
      clinicalOps: null,
    });

    bundle = store.getRoomSyncBundle(room.id);
    const handles = (bundle.clinicalOps && bundle.clinicalOps.clinical_users
      ? bundle.clinicalOps.clinical_users
      : []
    ).map((u) => u.username);
    assert.ok(handles.includes('doctor_a'), 'doctor_a must survive an empty-clinicalOps bundle push');
    assert.ok(handles.includes('doctor_b'), 'doctor_b must survive an empty-clinicalOps bundle push');
  } finally {
    resetLanDbManagerForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getRoomSyncBundle unions bundle clinical_users when DB export is newer but smaller', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const { ensureClinicalUser, claimUsername } = await import('../lib/db/clinical-access-db.mjs');
  const { exportClinicalOpsSnapshot } = await import('../lib/db/clinical-ops-sync.mjs');

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-union-'));
  const mgr = await createUnlockedDbManager(dbDir);
  resetLanDbManagerForTests();
  setLanDbManager(mgr);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-union-state-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });

  try {
    const localUserId = await mgr.withTransaction((db) => {
      const user = ensureClinicalUser(db, { clientId: 'host-only', rank: 'R2', clinicalName: 'Host' });
      claimUsername(db, { userId: user.userId, username: 'host_only' });
      return user.userId;
    });
    const dbSnap = await mgr.withTransaction((db) => exportClinicalOpsSnapshot(db));
    assert.equal(dbSnap.clinical_users.length, 1);

    const remoteUserId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const room = store.createRoom('Union users');
    const state = store.getState();
    state.roomSyncBundles[room.id] = {
      revision: 2,
      entityVersions: { clinicalOps: 2 },
      committedAt: '2026-06-01T00:00:00',
      uploadedByClientId: 'peer',
      entities: {},
      agenda: [],
      todos: {},
      entries: [],
      manejo: null,
      clinicalOps: {
        exportedAt: '2026-06-01T08:00:00.000Z',
        clinical_users: [
          dbSnap.clinical_users[0],
          {
            user_id: remoteUserId,
            username: 'peer_two',
            rank: 'R1',
            clinical_name: 'Peer Two',
            sala: 'Sala 2',
            is_program_admin: 0,
          },
        ],
        teams: [],
        team_membership: [
          { team_id: 'team-x', user_id: localUserId, sub_area_fraction: null },
          { team_id: 'team-x', user_id: remoteUserId, sub_area_fraction: null },
        ],
      },
      audit_log: [],
    };

    const bundle = store.getRoomSyncBundle(room.id);
    assert.ok(
      (bundle.clinicalOps.clinical_users || []).some((u) => u.user_id === remoteUserId),
      'peer from bundle cache must survive DB refresh'
    );
    assert.ok(
      (bundle.clinicalOps.clinical_users || []).some((u) => u.user_id === localUserId),
      'host user must remain'
    );
    assert.ok(
      String(bundle.clinicalOps.exportedAt) >= String(dbSnap.exportedAt),
      'merged snapshot should adopt newer exportedAt'
    );
  } finally {
    resetLanDbManagerForTests();
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('persistRoomBundleClinicalOpsToHostDb folds sync-bundle clinicalOps into SQLCipher', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const { ensureClinicalUser, claimUsername } = await import('../lib/db/clinical-access-db.mjs');
  const { exportClinicalOpsSnapshot } = await import('../lib/db/clinical-ops-sync.mjs');

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-bundle-db-'));
  const mgr = await createUnlockedDbManager(dbDir);
  resetLanDbManagerForTests();
  setLanDbManager(mgr);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-bundle-db-state-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });

  try {
    const localSnap = await mgr.withTransaction((db) => {
      const user = ensureClinicalUser(db, { clientId: 'host-bundle', rank: 'R2' });
      claimUsername(db, { userId: user.userId, username: 'host_bundle' });
      return exportClinicalOpsSnapshot(db);
    });

    const remoteUserId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const room = store.createRoom('Bundle DB');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      clinicalOps: {
        ...localSnap,
        exportedAt: '2099-06-01T12:00:00.000Z',
        clinical_users: [
          ...(localSnap.clinical_users || []),
          {
            user_id: remoteUserId,
            username: 'remote_bundle',
            rank: 'R1',
            clinical_name: 'Remote Bundle',
            sala: 'Sala 2',
            is_program_admin: 0,
          },
        ],
        team_membership: [
          ...(localSnap.team_membership || []),
          { team_id: 'team-bundle', user_id: remoteUserId, sub_area_fraction: 'A1' },
        ],
      },
    });

    await store.persistRoomBundleClinicalOpsToHostDb(room.id);
    const dbSnap = await mgr.withTransaction((db) => exportClinicalOpsSnapshot(db));
    assert.ok(
      dbSnap.clinical_users.some((u) => u.username === 'remote_bundle'),
      'peer user from bundle should land in host DB'
    );
    const bundle = store.getRoomSyncBundle(room.id);
    assert.ok(
      (bundle.clinicalOps.clinical_users || []).some((u) => u.username === 'remote_bundle')
    );
  } finally {
    resetLanDbManagerForTests();
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('getRoomSyncBundle refreshes stale clinicalOps cache from DB export', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const { ensureClinicalUser, createTeam } = await import('../lib/db/clinical-access-db.mjs');
  const { exportClinicalOpsSnapshot } = await import('../lib/db/clinical-ops-sync.mjs');

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-stale-'));
  const mgr = await createUnlockedDbManager(dbDir);
  resetLanDbManagerForTests();
  setLanDbManager(mgr);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-ops-stale-state-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });

  try {
    await mgr.withTransaction((db) => {
      const user = ensureClinicalUser(db, { clientId: 'stale-cache', rank: 'R2' });
      createTeam(db, {
        name: 'Fresh DB Team',
        service: 'Sala',
        onCallDayIndex: 3,
        createdBy: user.userId,
      });
    });

    const room = store.createRoom('Stale cache');
    const state = store.getState();
    state.roomSyncBundles[room.id] = {
      revision: 1,
      entityVersions: { clinicalOps: 1 },
      committedAt: '2020-01-01T00:00:00',
      uploadedByClientId: '',
      entities: {},
      agenda: [],
      todos: {},
      entries: [],
      manejo: null,
      clinicalOps: {
        exportedAt: '2020-01-01T00:00:00',
        teams: [],
        team_membership: [],
      },
      audit_log: [],
    };

    const bundle = store.getRoomSyncBundle(room.id);
    const dbSnap = await mgr.withTransaction((db) => exportClinicalOpsSnapshot(db));
    assert.notEqual(bundle.clinicalOps.exportedAt, '2020-01-01T00:00:00');
    assert.ok((bundle.clinicalOps.teams || []).length >= 1);
    assert.ok((dbSnap.teams || []).length >= 1);
    assert.ok(
      (bundle.clinicalOps.teams || []).some((t) =>
        (dbSnap.teams || []).some((d) => d.team_id === t.team_id)
      )
    );
  } finally {
    resetLanDbManagerForTests();
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('sql-v3 path does not write monolithic lan_host_state row on commit', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-sql-v3-'));
  const mgr = await createUnlockedDbManager(dbDir);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-sql-v3-state-'));
  const statePath = path.join(dir, 'state.json');
  const hostStateDir = path.join(dir, 'lan-host');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({
    filePath: statePath,
    hostStateDir,
    teamCodePlain: code,
    dbManager: mgr,
  });

  try {
    await store.ready();
    const room = store.createRoom('SQL v3');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    await store.flush();
    const row = mgr.getDb().prepare('SELECT json FROM lan_host_state WHERE id = 1').get();
    assert.equal(row, undefined);
    const meta = mgr.getDb().prepare('SELECT migration_generation FROM lan_host_meta WHERE id = 1').get();
    assert.equal(meta.migration_generation, 3);
    const audit = store.getLastCommitAudit();
    assert.strictEqual(audit.persistGeneration, 'sql-v3');
  } finally {
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('locked DB host keeps json-sharded persistence (no SQL v3 regression)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-locked-shard-'));
  const statePath = path.join(dir, 'state.json');
  const hostStateDir = path.join(dir, 'lan-host');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, hostStateDir, teamCodePlain: code });

  try {
    await store.ready();
    const room = store.createRoom('Shard locked');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    store.upsertPatientLabHistorySet('p1', { id: 'lab-1', date: '2026-06-08' }, Date.now());
    await store.flush();
    assert.ok(fs.existsSync(path.join(hostStateDir, 'meta.json')));
    assert.ok(fs.existsSync(path.join(hostStateDir, 'bundles', `${room.id}.json`)));
    const audit = store.getLastCommitAudit();
    assert.strictEqual(audit.persistGeneration, 'json-sharded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sql-v3 import from JSON shards preserves GET sync-bundle assembly', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const { writeMeta } = require('./persistence/json-meta-repository.js');
  const { writeRoomBundle } = require('./persistence/json-room-bundle-repository.js');
  const { writeLabSidecarSync } = require('./persistence/lab-sidecar.js');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-sql-import-'));
  const hostStateDir = path.join(dir, 'lan-host');
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const { hashTeamCode } = require('./team-code.js');
  const teamCodeHash = hashTeamCode(code);

  await writeMeta(hostStateDir, {
    version: 2,
    teamCodeHash,
    patients: [{ id: 'p1', nombre: 'Uno' }],
    rooms: [{ id: 'sala-1', displayName: 'Sala 1', version: 1 }],
    roomRevisions: { 'sala-1': 1 },
    labSidecarVersion: 1,
  });
  await writeRoomBundle(hostStateDir, 'sala-1', {
    revision: 1,
    entityVersions: {},
    agenda: [],
    todos: {},
    entries: [
      {
        patient: { id: 'p1' },
        note: {},
        labMeta: { labHistoryVersion: 1, labSetCount: 1 },
      },
    ],
    audit_log: [],
    entities: {},
  });
  writeLabSidecarSync(hostStateDir, 'sala-1', 'p1', {
    setsById: { s1: { id: 's1', date: '2026-06-08' } },
    orderedIds: ['s1'],
    updatedAt: '2026-06-08T00:00:00.000Z',
  });

  const jsonStore = createHostStore({ filePath: statePath, hostStateDir, teamCodePlain: code });
  await jsonStore.ready();
  const jsonBundle = jsonStore.getRoomSyncBundleForApi('sala-1');

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-sql-import-db-'));
  const mgr = await createUnlockedDbManager(dbDir);
  const sqlStore = createHostStore({
    filePath: statePath,
    hostStateDir,
    teamCodePlain: code,
    dbManager: mgr,
  });

  try {
    await sqlStore.ready();
    assert.ok(fs.existsSync(path.join(hostStateDir, '.p3-sqlite-backup', 'meta.json')));
    const sqlBundle = sqlStore.getRoomSyncBundleForApi('sala-1');
    assert.deepStrictEqual(
      JSON.stringify(sqlBundle.entries[0].labHistory),
      JSON.stringify(jsonBundle.entries[0].labHistory)
    );
    assert.strictEqual(sqlBundle.revision, jsonBundle.revision);
  } finally {
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});
