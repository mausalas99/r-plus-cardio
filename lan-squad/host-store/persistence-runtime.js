'use strict';

const fs = require('node:fs');
const { createRequire } = require('node:module');
const { readHostState, writeHostState } = createRequire(__filename)(
  '../../lib/db/lan-host-persistence.mjs'
);
const {
  isShardedLayout,
  loadShardedState,
  initEmptyShardedState,
  migrateMonolithToShards,
  commitDirtyShards,
  repairShardsOnBoot,
  migrateLabSidecarsOnBoot,
  repairLabSidecarsOnBoot,
} = require('../persistence/sharded-host-persistence.js');
const {
  dbHasLanHostV15,
  sqlMetaNeedsImport,
  loadCacheFromSql,
  loadLabSidecarsIntoCache,
  importFromJsonShards,
  backupJsonShardsForSqlImport,
} = require('../persistence/sqlite-host-repositories.js');
const { writeJsonAtomic } = require('../atomic-json.js');
const { readPersistModeOverride } = require('./utils.js');
const {
  assertDbUnlocked,
  defaultState,
  normalizeLoadedState,
  alignTeamCodeHash,
} = require('./utils.js');
const {
  flushSqlV3,
  flushSqlMonolith,
  flushJsonSharded,
  flushJsonMonolith,
} = require('./persistence-flush-helpers.js');
const { useDb, ensureLoadedSyncCore } = require('./persistence-sync-helpers.js');

function resolvePersistMode(ctx) {
  const override = readPersistModeOverride();
  if (override) return override;
  if (useDb(ctx) && ctx.dbManager.isUnlocked()) {
    const db = ctx.dbManager.getDb();
    if (db && dbHasLanHostV15(db)) return 'sql-v3';
    return 'sql-monolith';
  }
  if (isShardedLayout(ctx.stateDir)) return 'json-sharded';
  return 'json-monolith';
}

function markDirty(ctx, roomId) {
  if (roomId) ctx.dirtyRooms.add(String(roomId));
  else ctx.dirtyMeta = true;
}

async function persistCacheToDb(ctx, opts = {}) {
  assertDbUnlocked(ctx.dbManager);
  const snapshot = ctx.cache.get();
  const mode = resolvePersistMode(ctx);
  const byteLength =
    opts.byteLength != null ? opts.byteLength : JSON.stringify(snapshot).length;
  await ctx.dbManager.withTransaction((db, { audit }) => {
    const t0 = Date.now();
    if (mode === 'sql-v3') {
      const { persistFullCacheSql } = require('../persistence/sqlite-host-repositories.js');
      persistFullCacheSql(db, snapshot, ctx.labSidecarCache);
    } else {
      writeHostState(db, snapshot);
    }
    audit(ctx.getClientId(), 'lan.host.commit', {
      action: 'host.commit',
      byteLength,
      commitMs: Date.now() - t0,
      persistGeneration: mode,
    });
  });
}

async function flushCacheToDisk(ctx, deps) {
  if (!ctx.cache.isLoaded()) return;
  const t0 = Date.now();
  const snapshot = ctx.cache.get();
  const mode = resolvePersistMode(ctx);
  if (mode === 'sql-v3') return flushSqlV3(ctx, snapshot, t0);
  if (mode === 'sql-monolith') {
    return flushSqlMonolith(ctx, snapshot, t0, deps.persistCacheToDb);
  }
  if (isShardedLayout(ctx.stateDir)) return flushJsonSharded(ctx, t0);
  return flushJsonMonolith(ctx, snapshot, t0, ctx.filePath);
}

function schedulePersist(ctx, deps) {
  const p = ctx.commitBarrier.scheduleFlush(() =>
    ctx.queue.enqueue(() => flushCacheToDisk(ctx, deps))
  );
  p.catch((e) => ctx.reportPersistFailure('schedule-persist', e));
  return p;
}

async function flushCacheNow(ctx, deps, { serialized } = {}) {
  const run = serialized
    ? () => flushCacheToDisk(ctx, deps)
    : () => ctx.queue.enqueue(() => flushCacheToDisk(ctx, deps));
  await ctx.commitBarrier.flushNow(run);
}

async function persistSnapshot(ctx, deps, snapshot) {
  if (useDb(ctx)) {
    ctx.cache.replace(snapshot);
    const mode = resolvePersistMode(ctx);
    if (mode === 'sql-v3') {
      markDirty(ctx, null);
      for (const rid of Object.keys(snapshot.roomSyncBundles || {})) markDirty(ctx, rid);
      await flushCacheToDisk(ctx, deps);
      return;
    }
    await persistCacheToDb(ctx);
    return;
  }
  if (isShardedLayout(ctx.stateDir)) {
    ctx.cache.replace(snapshot);
    markDirty(ctx, null);
    for (const rid of Object.keys(snapshot.roomSyncBundles || {})) markDirty(ctx, rid);
    await commitDirtyShards({
      hostStateDir: ctx.stateDir,
      cache: ctx.cache,
      dirtyMeta: true,
      dirtyRooms: new Set(Object.keys(snapshot.roomSyncBundles || {})),
      dirtyLabSidecars: ctx.dirtyLabSidecars,
      labSidecarPayloads: ctx.labSidecarCache,
    });
    ctx.dirtyMeta = false;
    ctx.dirtyRooms.clear();
    ctx.dirtyLabSidecars.clear();
    return;
  }
  await writeJsonAtomic(ctx.filePath, snapshot);
}

async function loadJsonHostState(ctx) {
  if (isShardedLayout(ctx.stateDir)) {
    let s = await loadShardedState(ctx.stateDir, ctx.teamCodeHash);
    if (!s) s = await initEmptyShardedState(ctx.stateDir, ctx.teamCodeHash);
    ctx.cache.replace(s);
    const { repairedRooms } = await repairShardsOnBoot(ctx.stateDir, ctx.cache);
    ctx.repairedRoomCount = repairedRooms.length;
    if (repairedRooms.length) {
      s = await loadShardedState(ctx.stateDir, ctx.teamCodeHash);
      ctx.cache.replace(s);
    }
    await migrateLabSidecarsOnBoot(ctx.stateDir, ctx.cache);
    const { repaired: labRepairs } = await repairLabSidecarsOnBoot(
      ctx.stateDir,
      ctx.cache,
      ctx.labSidecarCache
    );
    ctx.repairedRoomCount += labRepairs.length;
    if (labRepairs.length) {
      s = await loadShardedState(ctx.stateDir, ctx.teamCodeHash);
      ctx.cache.replace(s);
    }
    return s;
  }
  if (fs.existsSync(ctx.filePath)) {
    await migrateMonolithToShards({
      monolithPath: ctx.filePath,
      hostStateDir: ctx.stateDir,
      teamCodeHash: ctx.teamCodeHash,
    });
    const s = await loadShardedState(ctx.stateDir, ctx.teamCodeHash);
    ctx.cache.replace(s);
    return s;
  }
  const s = await initEmptyShardedState(ctx.stateDir, ctx.teamCodeHash);
  ctx.cache.replace(s);
  return s;
}

async function loadSqlV3HostState(ctx, persistSnapshotFn) {
  assertDbUnlocked(ctx.dbManager);
  if (isShardedLayout(ctx.stateDir) && sqlMetaNeedsImport(ctx.dbManager.getDb())) {
    await backupJsonShardsForSqlImport(ctx.stateDir);
    await ctx.dbManager.withTransaction((db) =>
      importFromJsonShards(db, ctx.stateDir, ctx.teamCodeHash)
    );
  }
  let s = await ctx.dbManager.withTransaction((db) =>
    loadCacheFromSql(db, ctx.teamCodeHash)
  );
  if (!s) {
    s = defaultState(ctx.teamCodeHash);
    await persistSnapshotFn(s);
    ctx.cache.replace(s);
    return s;
  }
  await ctx.dbManager.withTransaction((db) => {
    loadLabSidecarsIntoCache(db, ctx.labSidecarCache);
  });
  return s;
}

async function loadFromDisk(ctx, deps) {
  let s;
  if (useDb(ctx)) {
    assertDbUnlocked(ctx.dbManager);
    if (resolvePersistMode(ctx) === 'sql-v3') {
      s = await loadSqlV3HostState(ctx, (snap) => persistSnapshot(ctx, deps, snap));
      const aligned = alignTeamCodeHash(s, ctx.teamCodeHash);
      s = normalizeLoadedState(s);
      if (aligned) {
        markDirty(ctx, null);
        await flushCacheNow(ctx, deps, { serialized: true });
      }
      ctx.cache.replace(s);
      return s;
    }
    s = await ctx.dbManager.withTransaction((db) => readHostState(db));
  } else {
    s = await loadJsonHostState(ctx);
    const aligned = alignTeamCodeHash(s, ctx.teamCodeHash);
    if (aligned) {
      markDirty(ctx, null);
      await flushCacheNow(ctx, deps, { serialized: true });
    }
    return s;
  }
  if (!s) {
    s = defaultState(ctx.teamCodeHash);
    await persistSnapshot(ctx, deps, s);
    ctx.cache.replace(s);
    return s;
  }
  const aligned = alignTeamCodeHash(s, ctx.teamCodeHash);
  const prevVersion = Number(s.version);
  s = normalizeLoadedState(s);
  if (Number(s.version) !== 2) {
    s.version = 2;
    await persistSnapshot(ctx, deps, s);
  } else if ((aligned || prevVersion !== 2) && useDb(ctx)) {
    await persistSnapshot(ctx, deps, s);
  } else if (aligned) {
    await persistSnapshot(ctx, deps, s);
  }
  ctx.cache.replace(s);
  return s;
}

function createPersistenceRuntime(ctx) {
  const deps = {
    persistCacheToDb: (opts) => persistCacheToDb(ctx, opts),
    flushCacheToDisk: () => flushCacheToDisk(ctx, deps),
    loadFromDisk: () => loadFromDisk(ctx, deps),
  };

  const boundMarkDirty = (roomId) => markDirty(ctx, roomId);
  const boundEnsureLoadedSync = () =>
    ensureLoadedSyncCore(ctx, {
      resolvePersistMode: () => resolvePersistMode(ctx),
      loadFromDisk: deps.loadFromDisk,
      persistCacheToDb: deps.persistCacheToDb,
      flushCacheToDisk: deps.flushCacheToDisk,
      markDirty: boundMarkDirty,
    });

  function ready() {
    if (!ctx.initPromise) {
      ctx.initPromise = deps.loadFromDisk().catch((e) => {
        ctx.initPromise = null;
        throw e;
      });
    }
    return ctx.initPromise;
  }

  return {
    resolvePersistMode: () => resolvePersistMode(ctx),
    markDirty: boundMarkDirty,
    persistCacheToDb: deps.persistCacheToDb,
    flushCacheToDisk: deps.flushCacheToDisk,
    schedulePersist: () => schedulePersist(ctx, deps),
    getLastPersistError: () => ctx.lastPersistError,
    awaitDurableCommit: () => schedulePersist(ctx, deps),
    flushCacheNow: (opts) => flushCacheNow(ctx, deps, opts),
    getLastCommitAudit: () => ctx.lastCommitAudit,
    persistSnapshot: (snapshot) => persistSnapshot(ctx, deps, snapshot),
    loadFromDisk: deps.loadFromDisk,
    ensureLoadedSync: boundEnsureLoadedSync,
    ready,
    flush: () => flushCacheNow(ctx, deps),
    getState: boundEnsureLoadedSync,
    getRepairedRoomCount: () => ctx.repairedRoomCount,
  };
}

module.exports = { createPersistenceRuntime };
