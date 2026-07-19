'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  dbHasLanHostV15,
  loadCacheFromSql,
  importFromJsonShards,
  commitLabUpsertTransaction,
  commitDirtyShardsSql,
  commitMetaSql,
  commitRoomBundleSql,
  lanLabSetsSecondaryIndexCount,
  loadSidecarFromSql,
} = require('./sqlite-host-repositories.js');
const { writeMeta } = require('./json-meta-repository.js');
const { writeRoomBundle } = require('./json-room-bundle-repository.js');
const { writeLabSidecarSync } = require('./lab-sidecar.js');

describe('sqlite-host-repositories', () => {
  let db;

  beforeEach(async () => {
    const { openTestDb } = await import('../../lib/db/test-open-db.mjs');
    ({ db } = openTestDb('ab'.repeat(32)));
  });

  it('dbHasLanHostV15 is true after schema migration', () => {
    assert.ok(dbHasLanHostV15(db));
    assert.equal(lanLabSetsSecondaryIndexCount(db), 0);
  });

  it('importFromJsonShards round-trips sharded JSON into SQL cache shape', async () => {
    const hostStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-import-'));
    const teamCodeHash = 'hash-import-test';
    await writeMeta(hostStateDir, {
      version: 2,
      teamCodeHash,
      patients: [{ id: 'p1', nombre: 'Uno' }],
      rooms: [{ id: 'sala-1', displayName: 'Sala 1' }],
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
          note: { text: 'n' },
          labMeta: { labHistoryVersion: 1, labSetCount: 1 },
        },
      ],
      audit_log: [],
      entities: {},
    });
    writeLabSidecarSync(hostStateDir, 'sala-1', 'p1', {
      setsById: { s1: { id: 's1', date: '2026-06-08', _clientTimestamp: 100 } },
      orderedIds: ['s1'],
      updatedAt: '2026-06-08T00:00:00.000Z',
    });

    importFromJsonShards(db, hostStateDir, teamCodeHash);
    const loaded = loadCacheFromSql(db, teamCodeHash);
    assert.ok(loaded);
    assert.equal(loaded.patients.length, 1);
    assert.equal(loaded.rooms[0].id, 'sala-1');
    const bundle = loaded.roomSyncBundles['sala-1'];
    assert.equal(bundle.revision, 1);
    assert.equal(bundle.entries[0].labMeta.labSetCount, 1);
    const sidecar = loadSidecarFromSql(db, 'sala-1', 'p1');
    assert.deepEqual(sidecar.orderedIds, ['s1']);
    const meta = db.prepare('SELECT migration_generation FROM lan_host_meta WHERE id = 1').get();
    assert.equal(meta.migration_generation, 3);
    fs.rmSync(hostStateDir, { recursive: true, force: true });
  });

  it('commitLabUpsertTransaction enforces cap and bumps revision', () => {
    commitMetaSql(
      db,
      { version: 2, teamCodeHash: 'h', patients: [], rooms: [{ id: 'sala-1' }] },
      { 'sala-1': 0 }
    );
    commitRoomBundleSql(db, 'sala-1', {
      revision: 0,
      entityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, labMeta: { labHistoryVersion: 0, labSetCount: 0 } }],
      audit_log: [],
      entities: {},
    });

    for (let i = 0; i < 25; i += 1) {
      commitLabUpsertTransaction(db, {
        roomId: 'sala-1',
        patientId: 'p1',
        set: { id: `s${i}`, date: '2026-06-08' },
        clientTimestamp: 1000 + i,
        labMeta: { labHistoryVersion: i + 1, labSetCount: Math.min(i + 1, 20) },
        revision: i + 1,
        entry: {
          patient: { id: 'p1' },
          labMeta: { labHistoryVersion: i + 1, labSetCount: Math.min(i + 1, 20) },
        },
      });
    }

    const orderCount = db
      .prepare(
        'SELECT COUNT(*) AS c FROM lan_lab_set_order WHERE room_id = ? AND patient_id = ?'
      )
      .get('sala-1', 'p1').c;
    assert.equal(orderCount, 20);
    const rev = db.prepare('SELECT revision FROM lan_room_bundles WHERE room_id = ?').get('sala-1');
    assert.equal(rev.revision, 25);
  });

  it('500 lab upserts do not grow transaction time linearly', () => {
    commitMetaSql(
      db,
      { version: 2, teamCodeHash: 'bench', patients: [], rooms: [{ id: 'sala-1' }] },
      { 'sala-1': 0 }
    );
    commitRoomBundleSql(db, 'sala-1', {
      revision: 0,
      entityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, labMeta: { labHistoryVersion: 0, labSetCount: 0 } }],
      audit_log: [],
      entities: {},
    });

    const hrMs = () => Number(process.hrtime.bigint()) / 1e6;
    const times = [];
    for (let i = 0; i < 500; i += 1) {
      const t0 = hrMs();
      commitLabUpsertTransaction(db, {
        roomId: 'sala-1',
        patientId: 'p1',
        set: { id: `bench-${i}`, date: '2026-06-08' },
        clientTimestamp: 2000 + i,
        labMeta: { labHistoryVersion: i + 1, labSetCount: Math.min(i + 1, 20) },
        revision: i + 1,
        entry: {
          patient: { id: 'p1' },
          labMeta: { labHistoryVersion: i + 1, labSetCount: Math.min(i + 1, 20) },
        },
      });
      times.push(hrMs() - t0);
    }
    const p50 = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const early = p50(times.slice(0, 50));
    const late = p50(times.slice(450));
    assert.ok(early > 0, 'expected measurable upsert timings');
    assert.ok(late < early * 3, `late p50 ${late} vs early p50 ${early}`);
  });

  it('commitDirtyShardsSql writes meta and room shards', () => {
    const cache = {
      get() {
        return {
          version: 2,
          teamCodeHash: 'dirty',
          patients: [],
          rooms: [{ id: 'sala-1' }],
          roomSyncBundles: {
            'sala-1': {
              revision: 2,
              entityVersions: {},
              agenda: [],
              todos: {},
              entries: [],
              audit_log: [],
              entities: {},
            },
          },
        };
      },
    };
    const { shards, byteLength } = commitDirtyShardsSql(db, {
      cache,
      dirtyMeta: true,
      dirtyRooms: new Set(['sala-1']),
      dirtyLabSidecars: new Set(),
      labSidecarPayloads: new Map(),
    });
    assert.ok(shards.includes('meta'));
    assert.ok(shards.includes('bundle:sala-1'));
    assert.ok(byteLength > 0);
    const row = db.prepare('SELECT revision FROM lan_room_bundles WHERE room_id = ?').get('sala-1');
    assert.equal(row.revision, 2);
  });
});
