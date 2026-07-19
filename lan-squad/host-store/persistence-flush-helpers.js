'use strict';

const { writeJsonAtomic } = require('../atomic-json.js');
const { commitDirtyShards } = require('../persistence/sharded-host-persistence.js');
const { commitDirtyShardsSql } = require('../persistence/sqlite-host-repositories.js');

function recordCommitAudit(ctx, t0, audit) {
  ctx.lastCommitAudit = { commitMs: Date.now() - t0, coalesced: true, ...audit };
}

async function flushSqlV3(ctx, snapshot, t0) {
  const metaDirty = ctx.dirtyMeta;
  const roomsDirty = new Set(ctx.dirtyRooms);
  const labsDirty = new Set(ctx.dirtyLabSidecars);
  const result = await ctx.dbManager.withTransaction((db, { audit }) => {
    const innerT0 = Date.now();
    const out = commitDirtyShardsSql(db, {
      cache: ctx.cache,
      dirtyMeta: metaDirty,
      dirtyRooms: roomsDirty,
      dirtyLabSidecars: labsDirty,
      labSidecarPayloads: ctx.labSidecarCache,
    });
    audit(ctx.getClientId(), 'lan.host.commit', {
      action: 'host.commit',
      byteLength: out.byteLength,
      commitMs: Date.now() - innerT0,
      shards: out.shards,
      persistGeneration: 'sql-v3',
    });
    return out;
  });
  ctx.dirtyMeta = false;
  ctx.dirtyRooms.clear();
  ctx.dirtyLabSidecars.clear();
  recordCommitAudit(ctx, t0, {
    byteLength: result.byteLength,
    shards: result.shards,
    persistGeneration: 'sql-v3',
  });
}

async function flushSqlMonolith(ctx, snapshot, t0, persistCacheToDb) {
  const byteLength = JSON.stringify(snapshot).length;
  await persistCacheToDb({ byteLength });
  recordCommitAudit(ctx, t0, {
    byteLength,
    shards: ['monolith'],
    persistGeneration: 'sql-monolith',
  });
}

async function flushJsonSharded(ctx, t0) {
  const { shards, byteLength } = await commitDirtyShards({
    hostStateDir: ctx.stateDir,
    cache: ctx.cache,
    dirtyMeta: ctx.dirtyMeta,
    dirtyRooms: ctx.dirtyRooms,
    dirtyLabSidecars: ctx.dirtyLabSidecars,
    labSidecarPayloads: ctx.labSidecarCache,
  });
  ctx.dirtyMeta = false;
  ctx.dirtyRooms.clear();
  ctx.dirtyLabSidecars.clear();
  recordCommitAudit(ctx, t0, {
    byteLength,
    shards,
    persistGeneration: 'json-sharded',
  });
}

async function flushJsonMonolith(ctx, snapshot, t0, filePath) {
  const byteLength = JSON.stringify(snapshot).length;
  await writeJsonAtomic(filePath, snapshot);
  recordCommitAudit(ctx, t0, {
    byteLength,
    shards: ['monolith'],
    persistGeneration: 'json-monolith',
  });
}

module.exports = {
  flushSqlV3,
  flushSqlMonolith,
  flushJsonSharded,
  flushJsonMonolith,
};
