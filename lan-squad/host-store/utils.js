'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { isShardedLayout } = require('../persistence/sharded-host-persistence.js');
const { writeJsonAtomic } = require('../atomic-json.js');
const { migrateHostStateIfNeeded } = require('../migrate-host-state.js');
const { mergeClinicalOpsSnapshotsData } = require('../../lib/db/clinical-ops-bundle-merge.cjs');
const {
  mergeClinicalOpsSnapshot,
  exportClinicalOpsSnapshot,
} = createRequire(__filename)('../../lib/db/clinical-ops-sync.mjs');
const { getLanDbManager } = require('../../lib/db/lan-db-bridge.cjs');

function getGlobalClinicalDbManager() {
  const mgr = getLanDbManager();
  return mgr && typeof mgr.isUnlocked === 'function' && mgr.isUnlocked() ? mgr : null;
}

function clinicalOpsCacheStale(cached, exported) {
  if (!exported || typeof exported !== 'object') return false;
  if (!cached || typeof cached !== 'object') return true;
  const cacheAt = cached.exportedAt ? String(cached.exportedAt) : '';
  const dbAt = exported.exportedAt ? String(exported.exportedAt) : '';
  return dbAt > cacheAt;
}

function refreshBundleClinicalOpsCacheIfStale(bundle) {
  const mgr = getGlobalClinicalDbManager();
  if (!mgr || !bundle) return;
  const db = mgr.getDb();
  if (!db) return;
  const exported = exportClinicalOpsSnapshot(db);
  if (!clinicalOpsCacheStale(bundle.clinicalOps, exported)) return;
  const cached =
    bundle.clinicalOps && typeof bundle.clinicalOps === 'object' ? bundle.clinicalOps : null;
  if (!cached) {
    bundle.clinicalOps = exported;
    return;
  }
  bundle.clinicalOps = mergeClinicalOpsSnapshotsData(cached, exported);
}

async function mergeBundleClinicalOpsIntoHostDb(snapshot, { roomId, revision } = {}) {
  const mgr = getGlobalClinicalDbManager();
  if (!mgr || !snapshot || typeof snapshot !== 'object') return null;
  let exported = null;
  await mgr.withTransaction((db, { audit }) => {
    mergeClinicalOpsSnapshot(db, snapshot);
    exported = exportClinicalOpsSnapshot(db);
    audit('host', 'lan.clinical_ops.put', {
      roomId: roomId || null,
      revision: revision != null ? revision : null,
      exportedAt: exported.exportedAt || null,
    });
  });
  return exported;
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 0), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readStateSync(filePath) {
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

function defaultState(teamCodeHash) {
  return {
    version: 2,
    teamCodeHash,
    patients: [],
    rooms: [],
    roomSyncBundles: {},
  };
}

function assertDbUnlocked(dbManager) {
  if (!dbManager.isUnlocked()) {
    const err = new Error('Database locked');
    err.code = 'DB_LOCKED';
    throw err;
  }
}

function normalizeLoadedState(s) {
  let state = migrateHostStateIfNeeded(s);
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

function alignTeamCodeHash(s, teamCodeHash) {
  if (s.teamCodeHash === teamCodeHash) return false;
  s.teamCodeHash = teamCodeHash;
  return true;
}

function persistAlignedTeamCodeHash({
  aligned,
  migrated,
  useDb,
  persistCacheToDb,
  flushCacheToDiskFn,
  resolvePersistModeFn,
  filePath,
  stateDir,
  queue,
  markDirtyFn,
  reportPersistFailure,
}) {
  if (!aligned) return;
  if (useDb()) {
    if (resolvePersistModeFn && resolvePersistModeFn() === 'sql-v3') {
      markDirtyFn(null);
      queue.enqueue(() => flushCacheToDiskFn()).catch((e) => reportPersistFailure('team-code-hash-flush', e));
      return;
    }
    queue.enqueue(() => persistCacheToDb()).catch((e) => reportPersistFailure('team-code-hash-db', e));
    return;
  }
  if (isShardedLayout(stateDir)) {
    markDirtyFn(null);
    const existing = readStateSync(path.join(stateDir, 'meta.json')) || {};
    queue.enqueue(() =>
      writeJsonAtomic(path.join(stateDir, 'meta.json'), {
        ...existing,
        version: 2,
        teamCodeHash: migrated.teamCodeHash,
        patients: migrated.patients,
        rooms: migrated.rooms,
        roomRevisions: existing.roomRevisions || {},
      })
    ).catch((e) => reportPersistFailure('team-code-hash-sharded-meta', e));
    return;
  }
  try {
    atomicWriteJson(filePath, migrated);
  } catch (_e) { void _e; }
  queue.enqueue(() => writeJsonAtomic(filePath, migrated)).catch((e) => reportPersistFailure('team-code-hash-json', e));
}

/** Env rollback: legacy | json | sql | sql-monolith (ward IT / support). */
function readPersistModeOverride() {
  const raw = String(process.env.R_PLUS_LAN_PERSIST_MODE || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const map = {
    legacy: 'json-monolith',
    monolith: 'json-monolith',
    json: 'json-sharded',
    sharded: 'json-sharded',
    sql: 'sql-v3',
    'sql-v3': 'sql-v3',
    'sql-monolith': 'sql-monolith',
  };
  return map[raw] || null;
}

module.exports = {
  getGlobalClinicalDbManager,
  clinicalOpsCacheStale,
  refreshBundleClinicalOpsCacheIfStale,
  mergeBundleClinicalOpsIntoHostDb,
  nowIso,
  newId,
  atomicWriteJson,
  readStateSync,
  defaultState,
  assertDbUnlocked,
  normalizeLoadedState,
  alignTeamCodeHash,
  persistAlignedTeamCodeHash,
  readPersistModeOverride,
};
