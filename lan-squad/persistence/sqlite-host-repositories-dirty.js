'use strict';

const { entryPatientId } = require('./sharded-host-persistence.js');
const { parseLabSidecarKey } = require('./sqlite-host-repositories-keys.js');
const { writeSidecarToSql } = require('./sqlite-host-repositories-sidecar.js');
const {
  upsertBundleEntryRow,
  upsertRoomBundleRow,
  commitRoomBundleSql,
  commitMetaSql,
} = require('./sqlite-host-repositories-write.js');

function commitDirtyLabSidecars(db, ctx) {
  const { state, labKeys, payloads, shards, byteLengthRef } = ctx;
  for (const key of labKeys) {
    const parsed = parseLabSidecarKey(key);
    if (!parsed) continue;
    const sidecar = payloads ? payloads.get(key) : null;
    if (!sidecar) continue;
    const bundle = state.roomSyncBundles && state.roomSyncBundles[parsed.roomId];
    if (!bundle) continue;
    const entry = (bundle.entries || []).find(
      (e) => entryPatientId(e) === parsed.patientId
    );
    writeSidecarToSql(db, parsed.roomId, parsed.patientId, sidecar);
    if (entry) {
      upsertBundleEntryRow(db, parsed.roomId, parsed.patientId, entry);
    }
    upsertRoomBundleRow(db, parsed.roomId, bundle);
    byteLengthRef.value += Buffer.byteLength(JSON.stringify(sidecar), 'utf8');
    shards.push(`labs:${parsed.roomId}:${parsed.patientId}`);
  }
}

function commitDirtyRoomBundles(db, ctx) {
  const { state, roomsToWrite, shards, byteLengthRef } = ctx;
  for (const roomId of roomsToWrite) {
    const bundle = state.roomSyncBundles && state.roomSyncBundles[roomId];
    if (!bundle) continue;
    commitRoomBundleSql(db, roomId, bundle);
    byteLengthRef.value += Buffer.byteLength(JSON.stringify(bundle), 'utf8');
    if (!shards.includes(`bundle:${roomId}`)) shards.push(`bundle:${roomId}`);
  }
}

function commitDirtyMetaIfNeeded(db, ctx) {
  const { state, dirtyMeta, shards, byteLengthRef } = ctx;
  if (!dirtyMeta) return;
  const roomRevisions = {};
  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles || {})) {
    if (bundle) roomRevisions[roomId] = Number(bundle.revision || 0);
  }
  commitMetaSql(db, state, roomRevisions);
  byteLengthRef.value += Buffer.byteLength(JSON.stringify(state.patients || []), 'utf8');
  byteLengthRef.value += Buffer.byteLength(JSON.stringify(state.rooms || []), 'utf8');
  shards.push('meta');
}

function commitDirtyShardsInTxn(db, ctx) {
  commitDirtyLabSidecars(db, ctx);
  commitDirtyRoomBundles(db, ctx);
  commitDirtyMetaIfNeeded(db, ctx);
}

module.exports = {
  commitDirtyLabSidecars,
  commitDirtyRoomBundles,
  commitDirtyMetaIfNeeded,
  commitDirtyShardsInTxn,
};
