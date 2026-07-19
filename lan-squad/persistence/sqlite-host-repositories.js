'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {
  loadShardedStateSync,
  entryPatientId,
} = require('./sharded-host-persistence.js');
const { metaPath } = require('./json-meta-repository.js');
const {
  HOST_LAB_SET_CAP,
  upsertLabSidecar,
  readLabSidecarSync,
  sidecarFromLabHistory,
  labMetaFromSidecar,
} = require('./lab-sidecar.js');
const { loadCacheFromSql } = require('./sqlite-host-repositories-load.js');
const { loadSidecarFromSql, writeSidecarToSql } = require('./sqlite-host-repositories-sidecar.js');
const { commitDirtyShardsInTxn } = require('./sqlite-host-repositories-dirty.js');
const {
  commitRoomBundleSql,
  commitMetaSql,
  upsertBundleEntryRow,
} = require('./sqlite-host-repositories-write.js');

const V15_TABLES = [
  'lan_host_meta',
  'lan_room_bundles',
  'lan_bundle_entries',
  'lan_lab_sets',
  'lan_lab_set_order',
];

function dbHasLanHostV15(db) {
  if (!db) return false;
  for (const name of V15_TABLES) {
    const row = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name);
    if (!row) return false;
  }
  return true;
}

function sqlMetaNeedsImport(db) {
  if (!dbHasLanHostV15(db)) return false;
  const row = db.prepare('SELECT migration_generation FROM lan_host_meta WHERE id = 1').get();
  return !row || Number(row.migration_generation) !== 3;
}

function loadLabSidecarsIntoCache(db, labSidecarCache) {
  const patients = db
    .prepare('SELECT DISTINCT room_id, patient_id FROM lan_lab_set_order')
    .all();
  for (const row of patients) {
    const sidecar = loadSidecarFromSql(db, row.room_id, row.patient_id);
    labSidecarCache.set(`${row.room_id}:${row.patient_id}`, sidecar);
  }
}

function commitLabUpsertTransaction(
  db,
  { roomId, patientId, set, clientTimestamp, labMeta, revision, entry }
) {
  const sidecar = loadSidecarFromSql(db, roomId, patientId);
  const nextSidecar = upsertLabSidecar(sidecar, set, clientTimestamp);
  const txn = db.transaction(() => {
    writeSidecarToSql(db, roomId, patientId, nextSidecar);
    if (entry) {
      upsertBundleEntryRow(db, roomId, patientId, entry);
    } else {
      db.prepare(
        'UPDATE lan_bundle_entries SET lab_meta_json = ? WHERE room_id = ? AND patient_id = ?'
      ).run(JSON.stringify(labMeta), roomId, patientId);
    }
    db.prepare('UPDATE lan_room_bundles SET revision = ? WHERE room_id = ?').run(
      Number(revision || 0),
      roomId
    );
  });
  txn();
  return nextSidecar;
}

function commitDirtyShardsSql(
  db,
  { cache, dirtyMeta, dirtyRooms, dirtyLabSidecars, labSidecarPayloads }
) {
  const state = typeof cache.get === 'function' ? cache.get() : cache;
  const shards = [];
  const byteLengthRef = { value: 0 };

  const labKeys =
    dirtyLabSidecars instanceof Set
      ? [...dirtyLabSidecars]
      : dirtyLabSidecars
        ? [...dirtyLabSidecars]
        : [];
  const payloads =
    labSidecarPayloads && typeof labSidecarPayloads.get === 'function'
      ? labSidecarPayloads
      : null;

  const txn = db.transaction(() => {
    commitDirtyShardsInTxn(db, {
      state,
      labKeys,
      payloads,
      roomsToWrite: new Set(dirtyRooms || []),
      dirtyMeta,
      shards,
      byteLengthRef,
    });
  });
  txn();

  return { shards, byteLength: byteLengthRef.value };
}

function persistFullCacheSql(db, state, labSidecarCache) {
  const roomRevisions = {};
  const txn = db.transaction(() => {
    for (const [roomId, bundle] of Object.entries(state.roomSyncBundles || {})) {
      if (!bundle) continue;
      commitRoomBundleSql(db, roomId, bundle);
      roomRevisions[roomId] = Number(bundle.revision || 0);
      if (!labSidecarCache) continue;
      for (const entry of bundle.entries || []) {
        const patientId = entryPatientId(entry);
        if (!patientId) continue;
        const key = `${roomId}:${patientId}`;
        const sidecar = labSidecarCache.get(key);
        if (sidecar) writeSidecarToSql(db, roomId, patientId, sidecar);
      }
    }
    commitMetaSql(db, state, roomRevisions);
  });
  txn();
}

async function backupJsonShardsForSqlImport(hostStateDir) {
  const backupRoot = path.join(hostStateDir, '.p3-sqlite-backup');
  if (fs.existsSync(backupRoot)) return backupRoot;
  await fsp.mkdir(backupRoot, { recursive: true });
  const copyDir = async (rel) => {
    const src = path.join(hostStateDir, rel);
    const dest = path.join(backupRoot, rel);
    if (!fs.existsSync(src)) return;
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    if (fs.statSync(src).isDirectory()) {
      await fsp.cp(src, dest, { recursive: true });
    } else {
      await fsp.copyFile(src, dest);
    }
  };
  if (fs.existsSync(metaPath(hostStateDir))) {
    await copyDir('meta.json');
  }
  await copyDir('bundles');
  await copyDir('labs');
  return backupRoot;
}

function importFromJsonShards(db, hostStateDir, teamCodeHash) {
  const state = loadShardedStateSync(hostStateDir, teamCodeHash);
  if (!state) throw new Error('sharded state missing');

  const labSidecarCache = new Map();
  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles || {})) {
    if (!bundle || !Array.isArray(bundle.entries)) continue;
    for (const entry of bundle.entries) {
      const patientId = entryPatientId(entry);
      if (!patientId) continue;
      const sc =
        readLabSidecarSync(hostStateDir, roomId, patientId) ||
        (Array.isArray(entry.labHistory) && entry.labHistory.length
          ? sidecarFromLabHistory(entry.labHistory)
          : null);
      if (sc) labSidecarCache.set(`${roomId}:${patientId}`, sc);
      if (sc && entry.labMeta == null) {
        entry.labMeta = labMetaFromSidecar(sc, 0);
      }
      delete entry.labHistory;
    }
  }

  const txn = db.transaction(() => {
    persistFullCacheSql(db, state, labSidecarCache);
  });
  txn();
  return state;
}

function lanLabSetsSecondaryIndexCount(db) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM sqlite_master
       WHERE type = 'index' AND tbl_name = 'lan_lab_sets'
         AND name NOT LIKE 'sqlite_autoindex_%'`
    )
    .get().c;
}

module.exports = {
  HOST_LAB_SET_CAP,
  dbHasLanHostV15,
  sqlMetaNeedsImport,
  loadCacheFromSql,
  loadLabSidecarsIntoCache,
  loadSidecarFromSql,
  importFromJsonShards,
  backupJsonShardsForSqlImport,
  commitLabUpsertTransaction,
  commitDirtyShardsSql,
  commitMetaSql,
  commitRoomBundleSql,
  persistFullCacheSql,
  lanLabSetsSecondaryIndexCount,
};
