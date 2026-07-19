'use strict';

const { mergeBundlePut } = require('../bundle-merge.js');
const { mergeClinicalOpsSnapshotsData } = require('../../lib/db/clinical-ops-bundle-merge.cjs');
const { appendAudit } = require('../audit-log.js');
const {
  nowIso,
  refreshBundleClinicalOpsCacheIfStale,
  mergeBundleClinicalOpsIntoHostDb,
} = require('./utils.js');
const {
  ensureRoomRecord,
  ensureRoomBundle,
  findRoomForPatient,
  findBundleEntry,
} = require('./bundle-room-helpers.js');

function throwBundleConflict(serverBundle, conflicts) {
  const err = new Error('conflict');
  err.code = 'CONFLICT';
  err.serverBundle = serverBundle;
  err.conflicts = conflicts;
  throw err;
}

function usesLegacyBundleClock(incoming) {
  return (
    incoming.baseRevision == null &&
    incoming.baseEntityVersions == null &&
    incoming.updatedAt != null
  );
}

function legacyBundleConflict(cur, incoming) {
  return {
    key: '*',
    kind: 'bundle',
    local: { updatedAt: incoming.updatedAt },
    server: { revision: cur.revision },
  };
}

function buildLegacyMergeInput(cur, incoming) {
  return {
    baseRevision: Number(cur && cur.revision ? cur.revision : 0),
    baseEntityVersions:
      cur && cur.entityVersions && typeof cur.entityVersions === 'object'
        ? { ...cur.entityVersions }
        : {},
    agenda: Array.isArray(incoming.agenda) ? incoming.agenda : [],
    todos: incoming.todos && typeof incoming.todos === 'object' ? incoming.todos : {},
    entries: Array.isArray(incoming.entries) ? incoming.entries : [],
    manejo: incoming.manejo,
    clinicalOps:
      incoming.clinicalOps && typeof incoming.clinicalOps === 'object'
        ? incoming.clinicalOps
        : null,
    clientId: incoming.uploadedByClientId || incoming.clientId || '',
  };
}

function buildMergeInput(cur, incoming, legacyClock) {
  if (legacyClock) return buildLegacyMergeInput(cur, incoming);
  return { ...incoming, clientId: incoming.uploadedByClientId || incoming.clientId || '' };
}

function getRoomSyncBundle(ctx, roomId) {
  const state = ctx.ensureLoadedSync();
  const rid = String(roomId || '');
  const b = state.roomSyncBundles && state.roomSyncBundles[rid];
  if (!b || typeof b !== 'object') return null;
  refreshBundleClinicalOpsCacheIfStale(b);
  return b;
}

function getRoomSyncBundleForApi(ctx, roomId) {
  const bundle = getRoomSyncBundle(ctx, roomId);
  if (!bundle) return null;
  return ctx.assembleBundleLabsForApi(bundle, roomId);
}

function getRoomClinicalOpsForApi(ctx, roomId) {
  const bundle = getRoomSyncBundle(ctx, roomId);
  if (!bundle) return null;
  return {
    clinicalOps: bundle.clinicalOps || null,
    entityVersions: bundle.entityVersions || {},
    revision: bundle.revision,
  };
}

function putRoomSyncBundle(ctx, roomId, bundle) {
  const state = ctx.ensureLoadedSync();
  const rid = String(roomId || '');
  if (!rid) throw new Error('room id required');
  const incoming = bundle && typeof bundle === 'object' ? bundle : {};
  ensureRoomRecord(state, rid, incoming.roomDisplayName);
  if (!state.roomSyncBundles) state.roomSyncBundles = {};
  const cur = state.roomSyncBundles[rid];
  const legacyClock = usesLegacyBundleClock(incoming);

  if (legacyClock && cur && Number(cur.revision || 0) > 0) {
    throwBundleConflict(cur, [legacyBundleConflict(cur, incoming)]);
  }

  const mergeInput = buildMergeInput(cur, incoming, legacyClock);
  const result = mergeBundlePut(cur, mergeInput, {
    clientId: mergeInput.clientId,
    nowIso,
  });

  if (!result.ok) {
    throwBundleConflict(result.bundle, result.conflicts);
  }

  state.roomSyncBundles[rid] = result.bundle;
  if (ctx.stripRoomBundleLabsToSidecars(rid, result.bundle)) ctx.markDirty(rid);
  ctx.markDirty(rid);
  void ctx.schedulePersist();
  return {
    bundle: result.bundle,
    lwwAppliedKeys: Array.isArray(result.lwwAppliedKeys) ? result.lwwAppliedKeys : [],
  };
}

async function persistRoomBundleClinicalOpsToHostDb(ctx, roomId) {
  const state = ctx.ensureLoadedSync();
  const rid = String(roomId || '');
  if (!rid || !state.roomSyncBundles) return null;
  const bundle = state.roomSyncBundles[rid];
  if (!bundle || !bundle.clinicalOps || typeof bundle.clinicalOps !== 'object') return null;
  const authoritative = await mergeBundleClinicalOpsIntoHostDb(bundle.clinicalOps, {
    roomId: rid,
    revision: bundle.revision,
  });
  if (authoritative) {
    bundle.clinicalOps = authoritative;
    ctx.markDirty(rid);
    void ctx.schedulePersist();
  }
  return authoritative;
}

function mergeIncomingClinicalOps(bundle, incomingSnapshot) {
  const serverOps =
    bundle.clinicalOps && typeof bundle.clinicalOps === 'object' ? bundle.clinicalOps : null;
  if (!incomingSnapshot) return serverOps;
  return serverOps
    ? mergeClinicalOpsSnapshotsData(serverOps, incomingSnapshot)
    : incomingSnapshot;
}

async function applyClinicalOpsPut(ctx, bundle, rid, incomingSnapshot, nextRevision) {
  const mergedOps = mergeIncomingClinicalOps(bundle, incomingSnapshot);
  if (!mergedOps || typeof mergedOps !== 'object') return;
  const authoritative = await mergeBundleClinicalOpsIntoHostDb(mergedOps, {
    roomId: rid,
    revision: nextRevision,
  });
  bundle.clinicalOps = authoritative || mergedOps;
}

function finalizeClinicalOpsBundle(bundle, clientId) {
  if (!bundle.entityVersions || typeof bundle.entityVersions !== 'object') {
    bundle.entityVersions = {};
  }
  bundle.entityVersions.clinicalOps = Number(bundle.entityVersions.clinicalOps || 0) + 1;
  bundle.committedAt = nowIso();
  bundle.uploadedByClientId = clientId;
  if (!Array.isArray(bundle.audit_log)) bundle.audit_log = [];
  appendAudit(
    {
      at: bundle.committedAt,
      clientId: clientId || 'host',
      action: 'clinical_ops.put',
      detail: { revision: bundle.revision },
    },
    bundle.audit_log
  );
}

async function putRoomClinicalOps(ctx, roomId, body) {
  const state = ctx.ensureLoadedSync();
  const rid = String(roomId || '');
  if (!rid) throw new Error('room id required');
  const incoming = body && typeof body === 'object' ? body : {};
  ensureRoomRecord(state, rid, incoming.roomDisplayName);
  const bundle = ensureRoomBundle(state, rid);
  const clientId = String(incoming.clientId || incoming.uploadedByClientId || '');
  const baseRevision = Number(incoming.baseRevision != null ? incoming.baseRevision : 0);
  const serverRevision = Number(bundle.revision || 0);
  const lwwAppliedKeys = [];
  const revisionSkew = serverRevision > 0 && baseRevision !== serverRevision;

  if (revisionSkew) {
    refreshBundleClinicalOpsCacheIfStale(bundle);
    lwwAppliedKeys.push('clinicalOps');
  }

  const incomingSnapshot =
    incoming.snapshot && typeof incoming.snapshot === 'object' ? incoming.snapshot : null;
  const nextRevision = serverRevision + 1;
  await applyClinicalOpsPut(ctx, bundle, rid, incomingSnapshot, nextRevision);

  bundle.revision = nextRevision;
  finalizeClinicalOpsBundle(bundle, clientId);
  state.roomSyncBundles[rid] = bundle;
  ctx.markDirty(rid);
  void ctx.schedulePersist();
  const out = { snapshot: bundle.clinicalOps, revision: bundle.revision };
  if (lwwAppliedKeys.length) out.lwwAppliedKeys = lwwAppliedKeys;
  return out;
}

function createBundleHandlers(ctx) {
  return {
    ensureRoomRecord,
    ensureRoomBundle,
    findRoomForPatient,
    findBundleEntry,
    getRoomSyncBundle: (roomId) => getRoomSyncBundle(ctx, roomId),
    getRoomSyncBundleForApi: (roomId) => getRoomSyncBundleForApi(ctx, roomId),
    getRoomClinicalOpsForApi: (roomId) => getRoomClinicalOpsForApi(ctx, roomId),
    putRoomSyncBundle: (roomId, bundle) => putRoomSyncBundle(ctx, roomId, bundle),
    persistRoomBundleClinicalOpsToHostDb: (roomId) =>
      persistRoomBundleClinicalOpsToHostDb(ctx, roomId),
    putRoomClinicalOps: (roomId, body) => putRoomClinicalOps(ctx, roomId, body),
    ensureRoomBundleForTest: (roomId) => ensureRoomBundle(ctx.ensureLoadedSync(), roomId),
  };
}

module.exports = { createBundleHandlers };
