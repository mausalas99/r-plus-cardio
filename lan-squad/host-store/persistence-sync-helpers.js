'use strict';

const fs = require('node:fs');
const { writeJsonAtomic } = require('../atomic-json.js');
const {
  isShardedLayout,
  loadShardedStateSync,
  initEmptyShardedStateSync,
} = require('../persistence/sharded-host-persistence.js');
const {
  sqlMetaNeedsImport,
  loadCacheFromSql,
  loadLabSidecarsIntoCache,
} = require('../persistence/sqlite-host-repositories.js');
const { createRequire } = require('node:module');
const { readHostState } = createRequire(__filename)('../../lib/db/lan-host-persistence.mjs');
const {
  assertDbUnlocked,
  defaultState,
  normalizeLoadedState,
  alignTeamCodeHash,
  persistAlignedTeamCodeHash,
  atomicWriteJson,
  readStateSync,
} = require('./utils.js');

function useDb(ctx) {
  return ctx.dbManager != null;
}

function loadSyncFromSqlV3(ctx, loadFromDisk) {
  if (isShardedLayout(ctx.stateDir) && sqlMetaNeedsImport(ctx.dbManager.getDb())) {
    void loadFromDisk();
    if (ctx.cache.isLoaded()) return ctx.cache.get();
  }
  const s = loadCacheFromSql(ctx.dbManager.getDb(), ctx.teamCodeHash);
  if (!s) return null;
  loadLabSidecarsIntoCache(ctx.dbManager.getDb(), ctx.labSidecarCache);
  return s;
}

function loadSyncFromDb(ctx, resolvePersistMode, loadFromDisk) {
  assertDbUnlocked(ctx.dbManager);
  if (resolvePersistMode() === 'sql-v3') {
    return loadSyncFromSqlV3(ctx, loadFromDisk);
  }
  return readHostState(ctx.dbManager.getDb());
}

function loadSyncFromJson(ctx) {
  if (isShardedLayout(ctx.stateDir)) {
    return loadShardedStateSync(ctx.stateDir, ctx.teamCodeHash);
  }
  if (fs.existsSync(ctx.filePath)) return readStateSync(ctx.filePath);
  return null;
}

function bootstrapFreshState(ctx, persistCacheToDb) {
  const fresh = defaultState(ctx.teamCodeHash);
  if (useDb(ctx)) {
    ctx.cache.replace(fresh);
    ctx.queue
      .enqueue(() => persistCacheToDb())
      .catch((e) => ctx.reportPersistFailure('ensure-loaded-fresh-db', e));
    return fresh;
  }
  if (isShardedLayout(ctx.stateDir) || !fs.existsSync(ctx.filePath)) {
    initEmptyShardedStateSync(ctx.stateDir, ctx.teamCodeHash);
  } else {
    atomicWriteJson(ctx.filePath, fresh);
  }
  ctx.cache.replace(fresh);
  return fresh;
}

function scheduleFreshSqlFlush(ctx, markDirty, flushCacheToDisk) {
  const fresh = defaultState(ctx.teamCodeHash);
  ctx.cache.replace(fresh);
  markDirty(null);
  ctx.queue
    .enqueue(() => flushCacheToDisk())
    .catch((e) => ctx.reportPersistFailure('ensure-loaded-fresh-flush', e));
  return fresh;
}

function scheduleAlignedJsonFlush(ctx, markDirty, flushCacheToDisk) {
  markDirty(null);
  ctx.queue
    .enqueue(() => flushCacheToDisk())
    .catch((e) => ctx.reportPersistFailure('ensure-loaded-aligned-flush', e));
}

function scheduleVersion2Persist(ctx, resolvePersistMode, persistCacheToDb, flushCacheToDisk, markDirty) {
  if (useDb(ctx)) {
    if (resolvePersistMode() === 'sql-v3') {
      markDirty(null);
      ctx.queue
        .enqueue(() => flushCacheToDisk())
        .catch((e) => ctx.reportPersistFailure('ensure-loaded-v2-flush', e));
      return;
    }
    ctx.queue
      .enqueue(() => persistCacheToDb())
      .catch((e) => ctx.reportPersistFailure('ensure-loaded-v2-db', e));
    return;
  }
  const migrated = ctx.cache.get();
  ctx.queue
    .enqueue(() => writeJsonAtomic(ctx.filePath, migrated))
    .catch((e) => ctx.reportPersistFailure('ensure-loaded-v2-json', e));
}

function applySyncMigrationSideEffects(ctx, args) {
  const { aligned, prevVersion, migrated, markDirty, persistCacheToDb, flushCacheToDisk, resolvePersistMode } =
    args;
  if (aligned) {
    if (!useDb(ctx) && isShardedLayout(ctx.stateDir)) {
      scheduleAlignedJsonFlush(ctx, markDirty, flushCacheToDisk);
      return;
    }
    persistAlignedTeamCodeHash({
      aligned,
      migrated,
      useDb: () => useDb(ctx),
      persistCacheToDb,
      flushCacheToDiskFn: flushCacheToDisk,
      resolvePersistModeFn: resolvePersistMode,
      filePath: ctx.filePath,
      stateDir: ctx.stateDir,
      queue: ctx.queue,
      markDirtyFn: markDirty,
      reportPersistFailure: ctx.reportPersistFailure,
    });
    return;
  }
  if (Number(migrated.version) === 2 && prevVersion !== 2) {
    scheduleVersion2Persist(
      ctx,
      resolvePersistMode,
      persistCacheToDb,
      flushCacheToDisk,
      markDirty
    );
  }
}

function ensureLoadedSyncCore(ctx, deps) {
  if (ctx.cache.isLoaded()) return ctx.cache.get();

  let s = null;
  if (useDb(ctx)) {
    s = loadSyncFromDb(ctx, deps.resolvePersistMode, deps.loadFromDisk);
  } else {
    s = loadSyncFromJson(ctx);
  }

  if (!s) {
    if (useDb(ctx) && deps.resolvePersistMode() === 'sql-v3') {
      return scheduleFreshSqlFlush(ctx, deps.markDirty, deps.flushCacheToDisk);
    }
    return bootstrapFreshState(ctx, deps.persistCacheToDb);
  }

  const aligned = alignTeamCodeHash(s, ctx.teamCodeHash);
  const prevVersion = Number(s.version);
  const migrated = normalizeLoadedState(s);
  ctx.cache.replace(migrated);
  applySyncMigrationSideEffects(ctx, {
    aligned,
    prevVersion,
    migrated,
    markDirty: deps.markDirty,
    persistCacheToDb: deps.persistCacheToDb,
    flushCacheToDisk: deps.flushCacheToDisk,
    resolvePersistMode: deps.resolvePersistMode,
  });
  return migrated;
}

module.exports = {
  useDb,
  ensureLoadedSyncCore,
};
