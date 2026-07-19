'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHostStore, readPersistModeOverride } = require('../../lan-squad/host-store.js');

const hostStoreSrc = fs.readFileSync(
  path.join(__dirname, '../../lan-squad/host-store/persistence-runtime.js'),
  'utf8'
);

describe('host-store', () => {
  let dir;
  let filePath;
  let hostStateDir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-host-'));
    filePath = path.join(dir, 'state.json');
    hostStateDir = path.join(dir, 'lan-host');
  });

  function createStore(teamCodePlain) {
    return createHostStore({ filePath, hostStateDir, teamCodePlain });
  }

  it('readPersistModeOverride maps env rollback tokens', () => {
    const prev = process.env.R_PLUS_LAN_PERSIST_MODE;
    try {
      delete process.env.R_PLUS_LAN_PERSIST_MODE;
      assert.strictEqual(readPersistModeOverride(), null);
      process.env.R_PLUS_LAN_PERSIST_MODE = 'legacy';
      assert.strictEqual(readPersistModeOverride(), 'json-monolith');
      process.env.R_PLUS_LAN_PERSIST_MODE = 'sql';
      assert.strictEqual(readPersistModeOverride(), 'sql-v3');
    } finally {
      if (prev !== undefined) process.env.R_PLUS_LAN_PERSIST_MODE = prev;
      else delete process.env.R_PLUS_LAN_PERSIST_MODE;
    }
  });

  it('schedulePersist does not call atomicWriteJson synchronously on mutation path', () => {
    const start = hostStoreSrc.indexOf('function schedulePersist()');
    const end = hostStoreSrc.indexOf('async function awaitDurableCommit()', start);
    const fnBody = hostStoreSrc.slice(start, end);
    assert.doesNotMatch(fnBody, /atomicWriteJson\(/);
  });

  it('10 rapid lab upserts within coalesce window produce at most two disk writes', async () => {
    const atomicJson = require('../../lan-squad/atomic-json.js');
    const writes = [];
    const orig = atomicJson.writeJsonAtomic;
    atomicJson.writeJsonAtomic = async (fp, obj) => {
      writes.push(fp);
      return orig(fp, obj);
    };
    try {
      const store = createStore('cap');
      const room = store.createRoom('Sala 1');
      store.putRoomSyncBundle(room.id, {
        baseRevision: 0,
        baseEntityVersions: {},
        agenda: [],
        todos: {},
        entries: [{ patient: { id: 'p1' }, note: {} }],
      });
      await store.flush();
      writes.length = 0;
      for (let i = 0; i < 10; i += 1) {
        store.upsertPatientLabHistorySet('p1', { id: 's' + i, date: '2026-06-08' }, Date.now());
      }
      await store.flush();
      assert.ok(writes.length <= 2, 'expected coalesced writes, got ' + writes.length);
    } finally {
      atomicJson.writeJsonAtomic = orig;
    }
  });

  it('shard-only write: lab upsert touches one bundle path', async () => {
    const store = createStore('shard-lab');
    await store.ready();
    const room = store.createRoom('Sala 1');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    await store.flush();
    const bundlePath = path.join(hostStateDir, 'bundles', `${room.id}.json`);
    const metaPath = path.join(hostStateDir, 'meta.json');
    const bundleMtimeBefore = fs.statSync(bundlePath).mtimeMs;
    const metaMtimeBefore = fs.statSync(metaPath).mtimeMs;
    store.upsertPatientLabHistorySet('p1', { id: 's1', date: '2026-06-08' }, Date.now());
    await store.flush();
    assert.ok(fs.statSync(bundlePath).mtimeMs >= bundleMtimeBefore);
    assert.ok(fs.statSync(metaPath).mtimeMs >= metaMtimeBefore);
    const onDisk = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    assert.ok(!onDisk.entries[0].labHistory);
    assert.ok(onDisk.entries[0].labMeta);
    assert.strictEqual(onDisk.entries[0].labMeta.labSetCount, 1);
    const sidecarPath = path.join(hostStateDir, 'labs', room.id, 'p1.json');
    assert.ok(fs.existsSync(sidecarPath));
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    assert.strictEqual(sidecar.orderedIds[0], 's1');
    const apiBundle = store.getRoomSyncBundleForApi(room.id);
    assert.strictEqual(apiBundle.entries[0].labHistory[0].id, 's1');
    const audit = store.getLastCommitAudit();
    assert.ok(audit.shards.includes(`labs:${room.id}:p1`));
    assert.ok(audit.shards.includes(`bundle:${room.id}`));
    assert.ok(audit.shards.includes('meta'));
    assert.strictEqual(audit.persistGeneration, 'json-sharded');
  });

  it('lab upsert appends lab_upsert delta log entry for Flow B replay', () => {
    const store = createStore('lab-delta');
    const room = store.createRoom('Sala 1');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    const set = { id: 'ls_1', date: '2026-06-08', values: { na: 140 } };
    const ts = Date.now();
    const out = store.upsertPatientLabHistorySet('p1', set, ts, 'lc_a');
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.deltaSeq, 1);
    const replay = store.getRoomDeltaLog(room.id, 0);
    assert.strictEqual(replay.ok, true);
    assert.strictEqual(replay.deltas.length, 1);
    assert.strictEqual(replay.deltas[0].type, 'lab_upsert');
    assert.strictEqual(replay.deltas[0].setId, 'ls_1');
    assert.strictEqual(replay.deltas[0].patientId, 'p1');
    assert.strictEqual(replay.deltas[0].originClientId, 'lc_a');
    assert.strictEqual(replay.deltas[0].clientTimestamp, ts);
    assert.deepStrictEqual(replay.deltas[0].set, set);
    assert.strictEqual(replay.latestDeltaSeq, 1);
  });

  it('stale lab upsert does not append another delta log entry', () => {
    const store = createStore('lab-delta-stale');
    const room = store.createRoom('Sala 1');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    const set = { id: 'ls_1', date: '2026-06-08', values: { na: 140 } };
    store.upsertPatientLabHistorySet('p1', set, 200, 'lc_a');
    store.upsertPatientLabHistorySet(
      'p1',
      { id: 'ls_1', date: '2026-06-08', values: { na: 120 } },
      100,
      'lc_b'
    );
    const replay = store.getRoomDeltaLog(room.id, 0);
    assert.strictEqual(replay.ok, true);
    assert.strictEqual(replay.deltas.length, 1);
    assert.strictEqual(replay.deltas[0].set.values.na, 140);
  });

  it('createHostStore inicializa teamCodeHash y listas vacías', () => {
    const { hashTeamCode } = require('../../lan-squad/team-code.js');
    const store = createStore('abc');
    const st = store.getState();
    assert.strictEqual(st.patients.length, 0);
    assert.strictEqual(st.rooms.length, 0);
    assert.strictEqual(st.calendarEvents, undefined);
    assert.strictEqual(st.teamCodeHash, hashTeamCode('abc'));
  });

  it('upsertPatient crea y actualiza con versión', () => {
    const store = createStore('x');
    const p1 = store.upsertPatient(
      { id: 'p1', nombre: 'Uno', registro: 'R1', edad: '30', sexo: 'F' },
      null
    );
    assert.strictEqual(p1.version, 1);
    const st = store.getState();
    assert.strictEqual(st.patients.length, 1);
    const p2 = store.upsertPatient(
      { id: 'p1', nombre: 'Uno x', registro: 'R1', edad: '30', sexo: 'F' },
      1
    );
    assert.strictEqual(p2.version, 2);
    assert.strictEqual(store.getState().patients[0].nombre, 'Uno x');
  });

  it('purgePatientFromHostCensus removes flat sync-bundle entries', () => {
    const store = createStore('del-flat-bundle');
    const room = store.createRoom('Sala flat');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ id: 'p-flat', registro: 'R88', nombre: 'FLAT', note: { texto: 'n' } }],
    });
    assert.strictEqual(store.purgePatientFromHostCensus('p-flat', 'R88'), true);
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.entries.length, 0);
  });

  it('patient delete without host row still purges bundle-only charts', () => {
    const store = createStore('del-bundle-only');
    const room = store.createRoom('Sala bundle');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [
        {
          patient: { id: 'p-orphan', registro: 'R77', nombre: 'SOLO BUNDLE' },
          note: { texto: 'x' },
        },
      ],
    });
    store.setEntity({
      entityType: 'patient',
      entityId: 'p-orphan',
      version: 1,
      data: { id: 'p-orphan', registro: 'R77', _deleted: true },
      deleted: true,
    });
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.entries.length, 0);
    assert.strictEqual(
      store.getState().patients.find((p) => p.id === 'p-orphan'),
      undefined
    );
  });

  it('patient delete removes chart from all room sync-bundle entries', () => {
    const store = createStore('del');
    const room = store.createRoom('Sala 2');
    store.upsertPatient({ id: 'p-del', nombre: 'BORRAR', registro: 'R99', edad: '40', sexo: 'M' }, null);
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [
        {
          patient: { id: 'p-del', registro: 'R99', nombre: 'BORRAR' },
          note: { texto: 'x' },
        },
        {
          patient: { id: 'p-keep', registro: 'R1', nombre: 'QUEDA' },
          note: { texto: 'y' },
        },
      ],
    });
    store.setEntity({
      entityType: 'patient',
      entityId: 'p-del',
      version: 2,
      data: { id: 'p-del', registro: 'R99', _deleted: true },
      deleted: true,
    });
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.entries.length, 1);
    assert.strictEqual(bundle.entries[0].patient.id, 'p-keep');
    const row = store.getState().patients.find((p) => p.id === 'p-del');
    assert.ok(row && row._deleted);
    const got = store.getEntity({ entityType: 'patient', entityId: 'p-del' });
    assert.strictEqual(got, null);
  });

  it('createRoom y listRooms', () => {
    const store = createStore('z');
    assert.strictEqual(store.listRooms().length, 0);
    const r = store.createRoom('Sala E');
    assert.ok(r.id);
    assert.strictEqual(r.displayName, 'Sala E');
    const list = store.listRooms();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, r.id);
  });

  it('reconciles teamCodeHash when lan-team-code changed without wiping host data', async () => {
    const { hashTeamCode } = require('../../lan-squad/team-code.js');
    const storeA = createStore('old-code');
    storeA.createRoom('Sala previa');
    assert.strictEqual(storeA.listRooms().length, 1);
    await storeA.flush();
    const storeB = createStore('new-code');
    await storeB.ready();
    const st = storeB.getState();
    assert.strictEqual(st.rooms.length, 1);
    assert.strictEqual(st.rooms[0].displayName, 'Sala previa');
    assert.strictEqual(st.teamCodeHash, hashTeamCode('new-code'));
    await storeB.flush();
    const preserved = JSON.parse(fs.readFileSync(path.join(hostStateDir, 'meta.json'), 'utf8'));
    assert.strictEqual(preserved.rooms.length, 1);
    assert.strictEqual(preserved.teamCodeHash, hashTeamCode('new-code'));
  });

  it('reconciles teamCodeHash on load instead of wiping patients', async () => {
    const { hashTeamCode } = require('../../lan-squad/team-code.js');
    const newCode = 'new-code-64-hexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        teamCodeHash: hashTeamCode('old-code'),
        patients: [{ id: 'p1', nombre: 'X', version: 1 }],
        rooms: [],
        roomSyncBundles: {},
      }),
      'utf8'
    );
    const store = createHostStore({ filePath, hostStateDir, teamCodePlain: newCode });
    await store.ready();
    const st = store.getState();
    assert.strictEqual(st.patients.length, 1);
    assert.strictEqual(st.teamCodeHash, hashTeamCode(newCode));
    await store.flush();
    const preserved = JSON.parse(fs.readFileSync(path.join(hostStateDir, 'meta.json'), 'utf8'));
    assert.strictEqual(preserved.patients.length, 1);
    assert.strictEqual(preserved.teamCodeHash, hashTeamCode(newCode));
  });

  it('putRoomSyncBundle applies LWW on stale entity version', () => {
    const store = createStore('b');
    const r = store.createRoom('Sala sync');
    store.putRoomSyncBundle(r.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [
        {
          id: 'e1',
          patientId: 'p1',
          procedure: 'A',
          location: 'X',
          updatedAt: '2026-06-03T09:00:00.000Z',
        },
      ],
      todos: {},
      uploadedByClientId: 'a',
    });
    const cur = store.getRoomSyncBundle(r.id);
    const out = store.putRoomSyncBundle(r.id, {
      baseRevision: cur.revision,
      baseEntityVersions: { 'a:e1': 0 },
      agenda: [
        {
          id: 'e1',
          patientId: 'p1',
          procedure: 'STALE',
          location: 'Y',
          updatedAt: '2026-06-03T10:00:00.000Z',
        },
      ],
      todos: {},
      uploadedByClientId: 'b',
    });
    assert.ok(Array.isArray(out.lwwAppliedKeys) && out.lwwAppliedKeys.includes('a:e1'));
    assert.strictEqual(store.getRoomSyncBundle(r.id).agenda[0].procedure, 'STALE');
  });

  it('putRoomSyncBundle merges disjoint todo keys', () => {
    const store = createStore('b');
    const r = store.createRoom('Sala');
    store.putRoomSyncBundle(r.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: { p1: [{ id: 't1', text: 'one' }] },
    });
    const cur = store.getRoomSyncBundle(r.id);
    store.putRoomSyncBundle(r.id, {
      baseRevision: cur.revision,
      baseEntityVersions: {},
      agenda: [],
      todos: { p1: [{ id: 't2', text: 'two' }] },
    });
    const got = store.getRoomSyncBundle(r.id);
    assert.strictEqual(got.todos.p1.length, 2);
  });

  it('getEntity / setEntity round-trip for room todo', () => {
    const store = createStore('test');
    const room = store.createRoom('UCI');
    store.setEntity({
      roomId: room.id,
      entityType: 'todo',
      entityId: 'td1',
      patientId: 'p1',
      version: 1,
      data: { id: 'td1', text: 'Labs', completed: false, updatedAt: '2026-05-30T10:00:00.000Z' },
    });
    const got = store.getEntity({ roomId: room.id, entityType: 'todo', entityId: 'td1', patientId: 'p1' });
    assert.strictEqual(got.version, 1);
    assert.strictEqual(got.data.text, 'Labs');
    const bundle = store.getRoomSyncBundle(room.id);
    assert.ok(Array.isArray(bundle.todos.p1));
    assert.strictEqual(bundle.todos.p1[0].text, 'Labs');
  });

  it('historiaClinica entity get/set and archive', () => {
    const store = createStore('hc');
    const r = store.createRoom('Sala');
    store.setEntity({
      roomId: r.id,
      entityType: 'historiaClinica',
      entityId: 'p1',
      patientId: 'p1',
      version: 1,
      data: { patientId: 'p1', ficha: 'A', app: 'B' },
      deleted: false,
    });
    const got = store.getEntity({
      entityType: 'historiaClinica',
      entityId: 'p1',
      patientId: 'p1',
      roomId: r.id,
    });
    assert.strictEqual(got.version, 1);
    assert.strictEqual(got.data.ficha, 'A');
    const archDir = path.join(dir, 'archive', 'p1');
    const out = store.archiveHistoriaClinicaForPatient('p1', { storageRoot: dir });
    assert.strictEqual(out.archived, true);
    assert.ok(fs.existsSync(path.join(archDir, 'historia-clinica.json')));
    const missing = store.getEntity({
      entityType: 'historiaClinica',
      entityId: 'p1',
      patientId: 'p1',
      roomId: r.id,
    });
    assert.strictEqual(missing, null);
  });

  it('getEntity historiaClinica falls back to bundle.entries patient snapshot', () => {
    const store = createStore('hc-entries');
    const r = store.createRoom('Sala');
    store.putRoomSyncBundle(r.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [
        {
          patient: {
            id: 'p1',
            nombre: 'TEST',
            historiaClinica: {
              version: 3,
              data: { motivoConsulta: 'dolor', meta: { updatedAt: '2026-06-01T10:00:00.000Z' } },
            },
          },
        },
      ],
    });
    const got = store.getEntity({
      roomId: r.id,
      entityType: 'historiaClinica',
      entityId: 'p1',
      patientId: 'p1',
    });
    assert.strictEqual(got.version, 3);
    assert.strictEqual(got.data.motivoConsulta, 'dolor');
  });

  it('putRoomSyncBundle persiste manejo', () => {
    const store = createStore('b');
    const r = store.createRoom('Sala');
    store.putRoomSyncBundle(r.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [],
      manejo: {
        customProtocols: [{ id: 'p1', name: 'X' }],
        overrides: {},
        favorites: [],
        recent: [],
        updatedAt: '2026-05-26T10:00:00.000Z',
      },
    });
    const got = store.getRoomSyncBundle(r.id);
    assert.strictEqual(got.manejo.customProtocols[0].id, 'p1');
  });

  it('records last persist error when flush throws instead of swallowing', async () => {
    const hostStorePath = require.resolve('../../lan-squad/host-store.js');
    const reloadPaths = [
      hostStorePath,
      require.resolve('../../lan-squad/host-store/create-factory.js'),
      require.resolve('../../lan-squad/host-store/create-factory-helpers.js'),
      require.resolve('../../lan-squad/host-store/persistence-runtime.js'),
      require.resolve('../../lan-squad/host-store/persistence-flush-helpers.js'),
      require.resolve('../../lan-squad/host-store/persistence-sync-helpers.js'),
      require.resolve('../../lan-squad/host-store/utils.js'),
      require.resolve('../../lan-squad/host-store/lab-sidecar-runtime.js'),
      require.resolve('../../lan-squad/host-store/bundles.js'),
      require.resolve('../../lan-squad/host-store/bundle-room-helpers.js'),
      require.resolve('../../lan-squad/host-store/entities.js'),
      require.resolve('../../lan-squad/host-store/delta-commands.js'),
      require.resolve('../../lan-squad/host-store/patient-fields.js'),
      require.resolve('../../lan-squad/host-store/rooms-patients.js'),
      require.resolve('../../lan-squad/host-store/historia-audit.js'),
      require.resolve('../../lan-squad/persistence/sharded-host-persistence.js'),
      require.resolve('../../lan-squad/persistence/json-room-bundle-repository.js'),
      require.resolve('../../lan-squad/persistence/json-meta-repository.js'),
      require.resolve('../../lan-squad/persistence/lab-sidecar.js'),
    ];
    const atomicJson = require('../../lan-squad/atomic-json.js');
    const orig = atomicJson.writeJsonAtomic;
    atomicJson.writeJsonAtomic = async () => {
      throw new Error('disk-full');
    };
    for (const p of reloadPaths) delete require.cache[p];
    const { createHostStore: createStoreWithFailingFlush } = require('../../lan-squad/host-store.js');
    try {
      const store = createStoreWithFailingFlush({ filePath, hostStateDir, teamCodePlain: 'persist-err' });
      const room = store.createRoom('Sala');
      store.putRoomSyncBundle(room.id, {
        baseRevision: 0,
        baseEntityVersions: {},
        agenda: [],
        todos: {},
        entries: [{ patient: { id: 'p1' }, note: {} }],
      });
      await new Promise((r) => setTimeout(r, 250));
      const err = store.getLastPersistError();
      assert.ok(err, 'expected persist failure to be recorded');
      assert.match(err.tag, /commit-barrier|schedule-persist/);
      assert.strictEqual(err.message, 'disk-full');
      assert.ok(err.at);
    } finally {
      atomicJson.writeJsonAtomic = orig;
      for (const p of reloadPaths) delete require.cache[p];
      require('../../lan-squad/host-store.js');
    }
  });

  it('putRoomClinicalOps leaves bundle unchanged when DB merge throws', async () => {
    const { setLanDbManager, resetLanDbManagerForTests } = require('../../lib/db/lan-db-bridge.cjs');
    resetLanDbManagerForTests();
    try {
      const store = createStore('ops-reject');
      const room = store.createRoom('Ops');
      const initialOps = {
        exportedAt: '2020-01-01T00:00:00',
        teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
        team_membership: [],
      };
      store.putRoomSyncBundle(room.id, {
        baseRevision: 0,
        baseEntityVersions: {},
        clinicalOps: initialOps,
      });
      const beforeBundle = store.getState().roomSyncBundles[room.id];
      const beforeRevision = beforeBundle.revision;
      const beforeOps = JSON.parse(JSON.stringify(beforeBundle.clinicalOps));
      const baseRevision = beforeRevision;
      const incoming = {
        ...initialOps,
        exportedAt: '2099-06-01T12:00:00.000Z',
        teams: [
          ...initialOps.teams,
          { team_id: 'team-b', name: 'B', created_at: '2099-06-01T12:00:00.000Z' },
        ],
      };
      setLanDbManager({
        isUnlocked: () => true,
        withTransaction() {
          throw new Error('db-merge-fail');
        },
        getDb: () => null,
      });
      await assert.rejects(
        store.putRoomClinicalOps(room.id, {
          baseRevision,
          clientId: 'peer',
          snapshot: incoming,
        }),
        /db-merge-fail/
      );
      const afterBundle = store.getState().roomSyncBundles[room.id];
      assert.strictEqual(afterBundle.revision, beforeRevision);
      assert.deepStrictEqual(afterBundle.clinicalOps, beforeOps);
    } finally {
      resetLanDbManagerForTests();
    }
  });

  it('round-trips host state through SQLCipher when dbManager is unlocked', async () => {
    const { createUnlockedDbManager } = await import('../../lib/db/test-open-db.mjs');
    const { loadCacheFromSql } = require('../../lan-squad/persistence/sqlite-host-repositories.js');
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-host-db-'));
    const mgr = await createUnlockedDbManager(dbDir, () => 'lan-host-db-test');
    try {
      const store = createHostStore({
        filePath,
        hostStateDir,
        teamCodePlain: 'db-roundtrip',
        dbManager: mgr,
        getClientId: () => 'lan-host-db-test',
      });
      await store.ready();
      const room = store.createRoom('Sala DB');
      await store.flush();
      const { hashTeamCode } = require('../../lan-squad/team-code.js');
      const row = loadCacheFromSql(mgr.getDb(), hashTeamCode('db-roundtrip'));
      assert.ok(row);
      assert.strictEqual(row.rooms.length, 1);
      assert.strictEqual(row.rooms[0].displayName, 'Sala DB');
      const commitAudit = store.getLastCommitAudit();
      assert.strictEqual(commitAudit.persistGeneration, 'sql-v3');
      const forensicRow = mgr
        .getDb()
        .prepare(
          `SELECT event_type, client_id FROM forensic_audit_chain
           WHERE event_type = 'lan.host.commit' ORDER BY id DESC LIMIT 1`
        )
        .get();
      assert.ok(forensicRow);
      assert.strictEqual(forensicRow.client_id, 'lan-host-db-test');
      mgr.lock();
      const lockedStore = createHostStore({
        filePath,
        teamCodePlain: 'db-roundtrip',
        dbManager: mgr,
      });
      assert.throws(() => lockedStore.getState(), (e) => e.code === 'DB_LOCKED');
      assert.strictEqual(room.id, row.rooms[0].id);
    } finally {
      mgr.lock();
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  });
});
