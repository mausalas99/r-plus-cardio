'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { migrateHostStateIfNeeded } = require('../migrate-host-state.js');
const { readMeta, writeMeta, defaultMeta, metaPath } = require('./json-meta-repository.js');
const {
  readRoomBundle,
  writeRoomBundle,
  bundlePath,
} = require('./json-room-bundle-repository.js');
const {
  readLabSidecar,
  writeLabSidecar,
  sidecarPath,
  sidecarFromLabHistory,
  labMetaFromSidecar,
} = require('./lab-sidecar.js');

function isShardedLayout(hostStateDir) {
  return fs.existsSync(metaPath(hostStateDir));
}

function normalizeMonolithShape(s) {
  const state = migrateHostStateIfNeeded(s);
  state.patients = Array.isArray(state.patients) ? state.patients : [];
  state.rooms = Array.isArray(state.rooms) ? state.rooms : [];
  state.roomSyncBundles =
    state.roomSyncBundles && typeof state.roomSyncBundles === 'object'
      ? state.roomSyncBundles
      : {};
  for (const rid of Object.keys(state.roomSyncBundles)) {
    const b = state.roomSyncBundles[rid];
    if (b && typeof b === 'object' && (!b.entities || typeof b.entities !== 'object')) {
      b.entities = {};
    }
  }
  delete state.calendarEvents;
  return state;
}

function monolithCoreEqual(a, b) {
  return (
    JSON.stringify(a.patients) === JSON.stringify(b.patients) &&
    JSON.stringify(a.rooms) === JSON.stringify(b.rooms) &&
    JSON.stringify(a.roomSyncBundles) === JSON.stringify(b.roomSyncBundles) &&
    a.teamCodeHash === b.teamCodeHash &&
    Number(a.version) === Number(b.version)
  );
}

function readJsonSync(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') throw new Error('bad shape');
    return o;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function cacheFromMetaAndBundles(meta, bundlesByRoom) {
  return {
    version: Number(meta.version || 2),
    teamCodeHash: meta.teamCodeHash,
    patients: Array.isArray(meta.patients) ? meta.patients : [],
    rooms: Array.isArray(meta.rooms) ? meta.rooms : [],
    roomSyncBundles: bundlesByRoom,
  };
}

async function loadShardedState(hostStateDir, _teamCodeHash) {
  const meta = await readMeta(hostStateDir);
  if (!meta) return null;
  const bundlesByRoom = {};
  const roomIds = new Set([
    ...(Array.isArray(meta.rooms) ? meta.rooms.map((r) => r && r.id).filter(Boolean) : []),
    ...Object.keys(meta.roomRevisions || {}),
  ]);
  for (const roomId of roomIds) {
    const bundle = await readRoomBundle(hostStateDir, roomId);
    if (bundle) bundlesByRoom[roomId] = bundle;
  }
  return cacheFromMetaAndBundles(meta, bundlesByRoom);
}

function loadShardedStateSync(hostStateDir, _teamCodeHash) {
  const meta = readJsonSync(metaPath(hostStateDir));
  if (!meta) return null;
  const bundlesByRoom = {};
  const roomIds = new Set([
    ...(Array.isArray(meta.rooms) ? meta.rooms.map((r) => r && r.id).filter(Boolean) : []),
    ...Object.keys(meta.roomRevisions || {}),
  ]);
  for (const roomId of roomIds) {
    const bundle = readJsonSync(bundlePath(hostStateDir, roomId));
    if (bundle) bundlesByRoom[roomId] = bundle;
  }
  return cacheFromMetaAndBundles(meta, bundlesByRoom);
}

async function initEmptyShardedState(hostStateDir, teamCodeHash) {
  await fsp.mkdir(path.join(hostStateDir, 'bundles'), { recursive: true });
  const meta = defaultMeta(teamCodeHash);
  await writeMeta(hostStateDir, meta);
  return cacheFromMetaAndBundles(meta, {});
}

function initEmptyShardedStateSync(hostStateDir, teamCodeHash) {
  fs.mkdirSync(path.join(hostStateDir, 'bundles'), { recursive: true });
  const meta = defaultMeta(teamCodeHash);
  const dir = path.dirname(metaPath(hostStateDir));
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${metaPath(hostStateDir)}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta), 'utf8');
  fs.renameSync(tmp, metaPath(hostStateDir));
  return cacheFromMetaAndBundles(meta, {});
}

async function migrateMonolithToShards({ monolithPath, hostStateDir, teamCodeHash }) {
  if (!fs.existsSync(monolithPath)) {
    throw new Error('monolith missing');
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(monolithPath, 'utf8'));
  } catch {
    throw new Error('monolith invalid JSON');
  }

  const state = normalizeMonolithShape(parsed);
  if (Number(state.version) !== 2) {
    throw new Error('monolith version must be 2');
  }

  const backupPath = `${monolithPath}.pre-shard-backup`;
  const tmpBackup = `${backupPath}.${process.pid}.${Date.now()}.tmp`;
  fs.copyFileSync(monolithPath, tmpBackup);
  fs.renameSync(tmpBackup, backupPath);

  let backupParsed;
  try {
    backupParsed = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  } catch {
    throw new Error('backup verification failed');
  }
  const normalizedBackup = normalizeMonolithShape(backupParsed);
  if (!monolithCoreEqual(state, normalizedBackup)) {
    throw new Error('backup verification failed');
  }

  await fsp.mkdir(path.join(hostStateDir, 'bundles'), { recursive: true });

  const roomRevisions = {};
  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles)) {
    roomRevisions[roomId] = Number(bundle.revision || 0);
    await writeRoomBundle(hostStateDir, roomId, bundle);
  }

  const meta = {
    version: 2,
    teamCodeHash: state.teamCodeHash || teamCodeHash,
    patients: state.patients,
    rooms: state.rooms,
    roomRevisions,
    shardedFrom: 'monolith',
    shardedAt: new Date().toISOString(),
  };
  await writeMeta(hostStateDir, meta);

  const migratedPath = `${monolithPath}.migrated`;
  fs.renameSync(monolithPath, migratedPath);

  return loadShardedState(hostStateDir, teamCodeHash);
}

function parseLabSidecarKey(key) {
  const raw = String(key || '');
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  return { roomId: raw.slice(0, sep), patientId: raw.slice(sep + 1) };
}

function entryPatientId(entry) {
  if (!entry) return '';
  if (entry.id) return String(entry.id);
  if (entry.patient && entry.patient.id) return String(entry.patient.id);
  return '';
}

function normalizeLabKeyList(dirtyLabSidecars) {
  if (dirtyLabSidecars instanceof Set) return [...dirtyLabSidecars];
  return dirtyLabSidecars ? [...dirtyLabSidecars] : [];
}

async function commitDirtyLabSidecars(hostStateDir, labKeys, payloads) {
  const shards = [];
  let byteLength = 0;
  for (const key of labKeys) {
    const parsed = parseLabSidecarKey(key);
    if (!parsed) continue;
    const sidecar = payloads ? payloads.get(key) : null;
    if (!sidecar) continue;
    const payload = JSON.stringify(sidecar);
    byteLength += Buffer.byteLength(payload, 'utf8');
    await writeLabSidecar(hostStateDir, parsed.roomId, parsed.patientId, sidecar);
    shards.push(`labs:${parsed.roomId}:${parsed.patientId}`);
  }
  return { shards, byteLength };
}

async function commitDirtyRoomBundles(hostStateDir, state, dirtyRooms, meta) {
  const shards = [];
  let byteLength = 0;
  for (const roomId of dirtyRooms) {
    const bundle = state.roomSyncBundles && state.roomSyncBundles[roomId];
    if (!bundle) continue;
    const payload = JSON.stringify(bundle);
    byteLength += Buffer.byteLength(payload, 'utf8');
    await writeRoomBundle(hostStateDir, roomId, bundle);
    if (!meta.roomRevisions || typeof meta.roomRevisions !== 'object') {
      meta.roomRevisions = {};
    }
    meta.roomRevisions[roomId] = Number(bundle.revision || 0);
    shards.push(`bundle:${roomId}`);
  }
  return { shards, byteLength };
}

async function pruneInactiveRoomShards(hostStateDir, meta, activeRoomIds) {
  for (const rid of Object.keys(meta.roomRevisions || {})) {
    if (activeRoomIds.has(rid)) continue;
    delete meta.roomRevisions[rid];
    const fp = bundlePath(hostStateDir, rid);
    try {
      await fsp.unlink(fp);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

async function commitDirtyShards({
  hostStateDir,
  cache,
  dirtyMeta,
  dirtyRooms,
  dirtyLabSidecars,
  labSidecarPayloads,
}) {
  const state = typeof cache.get === 'function' ? cache.get() : cache;
  let meta = await readMeta(hostStateDir);
  if (!meta) meta = defaultMeta(state.teamCodeHash);

  let metaNeedsWrite = !!dirtyMeta;

  const labKeys = normalizeLabKeyList(dirtyLabSidecars);
  const payloads =
    labSidecarPayloads && typeof labSidecarPayloads.get === 'function'
      ? labSidecarPayloads
      : null;

  const labCommit = await commitDirtyLabSidecars(hostStateDir, labKeys, payloads);
  const shards = [...labCommit.shards];
  let byteLength = labCommit.byteLength;

  const roomCommit = await commitDirtyRoomBundles(hostStateDir, state, dirtyRooms, meta);
  shards.push(...roomCommit.shards);
  byteLength += roomCommit.byteLength;
  if (roomCommit.shards.length) metaNeedsWrite = true;

  if (metaNeedsWrite) {
    meta.version = 2;
    meta.teamCodeHash = state.teamCodeHash;
    meta.patients = state.patients;
    meta.rooms = state.rooms;
    const activeRoomIds = new Set((state.rooms || []).map((r) => r && r.id).filter(Boolean));
    await pruneInactiveRoomShards(hostStateDir, meta, activeRoomIds);
    const metaPayload = JSON.stringify(meta);
    byteLength += Buffer.byteLength(metaPayload, 'utf8');
    await writeMeta(hostStateDir, meta);
    shards.push('meta');
  }

  return { shards, byteLength };
}

async function repairRoomRevisionOnBoot(hostStateDir, meta, roomId, bundle, metaRev) {
  const bundleRev = bundle ? Number(bundle.revision || 0) : 0;
  if (bundleRev === metaRev) return false;

  if (bundleRev > metaRev) {
    if (!meta.roomRevisions) meta.roomRevisions = {};
    meta.roomRevisions[roomId] = bundleRev;
    return true;
  }
  if (!bundle) return false;
  await writeRoomBundle(hostStateDir, roomId, bundle);
  if (!meta.roomRevisions) meta.roomRevisions = {};
  meta.roomRevisions[roomId] = bundleRev;
  return true;
}

async function repairShardsOnBoot(hostStateDir, cache) {
  const meta = await readMeta(hostStateDir);
  if (!meta) return { repairedRooms: [] };

  const state = typeof cache.get === 'function' ? cache.get() : cache;
  const repairedRooms = [];
  let metaChanged = false;

  for (const room of state.rooms || []) {
    const roomId = room && room.id;
    if (!roomId) continue;
    const metaRev = Number((meta.roomRevisions && meta.roomRevisions[roomId]) || 0);
    const bundle = state.roomSyncBundles && state.roomSyncBundles[roomId];
    const didRepair = await repairRoomRevisionOnBoot(hostStateDir, meta, roomId, bundle, metaRev);
    if (didRepair) {
      metaChanged = true;
      repairedRooms.push(roomId);
    }
  }

  if (metaChanged) {
    meta.lastRepairAt = new Date().toISOString();
    await writeMeta(hostStateDir, meta);
  }

  return { repairedRooms };
}

async function migrateEntryLabSidecar(hostStateDir, roomId, entry) {
  const patientId = entryPatientId(entry);
  if (!patientId) return false;
  const labHistory = Array.isArray(entry.labHistory) ? entry.labHistory : [];
  if (!labHistory.length) return false;

  const sidecar = sidecarFromLabHistory(labHistory);
  await writeLabSidecar(hostStateDir, roomId, patientId, sidecar);
  entry.labMeta = labMetaFromSidecar(sidecar, entry.labMeta && entry.labMeta.labHistoryVersion);
  delete entry.labHistory;
  return true;
}

async function migrateRoomLabSidecars(hostStateDir, roomId, bundle) {
  if (!bundle || !Array.isArray(bundle.entries)) return { entriesMigrated: 0, roomChanged: false };
  let entriesMigrated = 0;
  let roomChanged = false;
  for (const entry of bundle.entries) {
    const migrated = await migrateEntryLabSidecar(hostStateDir, roomId, entry);
    if (!migrated) continue;
    entriesMigrated += 1;
    roomChanged = true;
  }
  if (roomChanged) {
    await writeRoomBundle(hostStateDir, roomId, bundle);
  }
  return { entriesMigrated, roomChanged };
}

async function migrateLabSidecarsOnBoot(hostStateDir, cache) {
  const meta = await readMeta(hostStateDir);
  if (!meta) return { migrated: false, entriesMigrated: 0 };

  const sidecarVersion = Number(meta.labSidecarVersion || 0);
  if (sidecarVersion >= 1) return { migrated: false, entriesMigrated: 0 };

  const state = typeof cache.get === 'function' ? cache.get() : cache;
  let entriesMigrated = 0;
  let metaChanged = false;

  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles || {})) {
    const roomResult = await migrateRoomLabSidecars(hostStateDir, roomId, bundle);
    entriesMigrated += roomResult.entriesMigrated;
    if (roomResult.roomChanged) {
      if (!meta.roomRevisions) meta.roomRevisions = {};
      meta.roomRevisions[roomId] = Number(bundle.revision || 0);
      metaChanged = true;
    }
  }

  if (entriesMigrated > 0 || sidecarVersion < 1) {
    meta.labSidecarVersion = 1;
    metaChanged = true;
  }

  if (metaChanged) {
    await writeMeta(hostStateDir, meta);
  }

  return { migrated: entriesMigrated > 0, entriesMigrated };
}

async function repairMissingLabSidecar(hostStateDir, roomId, patientId, entry, labSidecarCache, repaired) {
  if (!Array.isArray(entry.labHistory) || !entry.labHistory.length) return;
  const rebuilt = sidecarFromLabHistory(entry.labHistory);
  await writeLabSidecar(hostStateDir, roomId, patientId, rebuilt);
  if (labSidecarCache) labSidecarCache.set(`${roomId}:${patientId}`, rebuilt);
  repaired.push(`${roomId}:${patientId}:sidecar_regenerated`);
}

async function repairEntryLabMeta(hostStateDir, roomId, patientId, entry, bundle, meta, labSidecarCache, repaired) {
  const sidecarOnDisk = await readLabSidecar(hostStateDir, roomId, patientId);
  entry.labMeta = labMetaFromSidecar(sidecarOnDisk, 0);
  delete entry.labHistory;
  if (labSidecarCache) labSidecarCache.set(`${roomId}:${patientId}`, sidecarOnDisk);
  await writeRoomBundle(hostStateDir, roomId, bundle);
  if (!meta.roomRevisions) meta.roomRevisions = {};
  meta.roomRevisions[roomId] = Number(bundle.revision || 0);
  repaired.push(`${roomId}:${patientId}:lab_meta_repaired`);
  return true;
}

async function repairLabSidecarEntry(hostStateDir, roomId, entry, bundle, meta, labSidecarCache, repaired) {
  const patientId = entryPatientId(entry);
  if (!patientId) return false;

  const fp = sidecarPath(hostStateDir, roomId, patientId);
  const sidecarOnDisk = fs.existsSync(fp) ? await readLabSidecar(hostStateDir, roomId, patientId) : null;
  const labMeta = entry.labMeta && typeof entry.labMeta === 'object' ? entry.labMeta : null;
  const labVersion = Number(labMeta && labMeta.labHistoryVersion ? labMeta.labHistoryVersion : 0);

  if (labVersion > 0 && !sidecarOnDisk) {
    await repairMissingLabSidecar(hostStateDir, roomId, patientId, entry, labSidecarCache, repaired);
    return false;
  }

  if (sidecarOnDisk && (!labMeta || labVersion === 0)) {
    return repairEntryLabMeta(hostStateDir, roomId, patientId, entry, bundle, meta, labSidecarCache, repaired);
  }

  if (sidecarOnDisk && labSidecarCache) {
    labSidecarCache.set(`${roomId}:${patientId}`, sidecarOnDisk);
  }
  return false;
}

async function repairLabSidecarsOnBoot(hostStateDir, cache, labSidecarCache) {
  const state = typeof cache.get === 'function' ? cache.get() : cache;
  const repaired = [];
  let metaChanged = false;
  const meta = await readMeta(hostStateDir);
  if (!meta) return { repaired };

  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles || {})) {
    if (!bundle || !Array.isArray(bundle.entries)) continue;
    for (const entry of bundle.entries) {
      const metaChangedForEntry = await repairLabSidecarEntry(
        hostStateDir,
        roomId,
        entry,
        bundle,
        meta,
        labSidecarCache,
        repaired
      );
      if (metaChangedForEntry) metaChanged = true;
    }
  }

  if (metaChanged) {
    meta.lastRepairAt = new Date().toISOString();
    await writeMeta(hostStateDir, meta);
  }

  return { repaired };
}

module.exports = {
  isShardedLayout,
  loadShardedState,
  loadShardedStateSync,
  initEmptyShardedState,
  initEmptyShardedStateSync,
  migrateMonolithToShards,
  commitDirtyShards,
  repairShardsOnBoot,
  migrateLabSidecarsOnBoot,
  repairLabSidecarsOnBoot,
  entryPatientId,
};
