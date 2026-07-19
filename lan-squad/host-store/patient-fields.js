'use strict';

const { upsertLabSidecar, deleteLabSidecarSet, labMetaFromSidecar } = require('../persistence/lab-sidecar.js');
const { nowIso } = require('./utils.js');

function resolveLabHistoryRoom(ctx, patientId) {
  const state = ctx.ensureLoadedSync();
  const roomId = ctx.findRoomForPatient(state, patientId);
  if (!roomId) return { ok: false, error: 'patient not found' };
  const bundle = state.roomSyncBundles[roomId];
  if (!bundle) return { ok: false, error: 'no bundle' };
  const entry = ctx.findBundleEntry(bundle, patientId);
  if (!entry) return { ok: false, error: 'entry not found' };
  return { ok: true, state, roomId, bundle, entry };
}

function isStaleLabClientTimestamp(existing, clientTimestamp) {
  if (!existing) return false;
  return clientTimestamp < Number(existing._clientTimestamp || 0);
}

function appendLabDeltaLog(bundle, buildEntry) {
  const nextSeq = Number(bundle.deltaSeq || 0) + 1;
  const committedAt = nowIso();
  bundle.revision = Number(bundle.revision || 0) + 1;
  bundle.deltaSeq = nextSeq;
  bundle.committedAt = committedAt;
  if (!Array.isArray(bundle.deltaLog)) bundle.deltaLog = [];
  bundle.deltaLog.push(buildEntry({ nextSeq, committedAt, revision: bundle.revision }));
  while (bundle.deltaLog.length > 200) bundle.deltaLog.shift();
  return { nextSeq, committedAt, revision: bundle.revision };
}

function upsertPatientLabHistorySet(ctx, patientId, set, clientTimestamp, clientId) {
  const resolved = resolveLabHistoryRoom(ctx, patientId);
  if (!resolved.ok) return resolved;

  const { roomId, bundle, entry } = resolved;
  const pid = String(patientId || '').trim();
  const sidecar = ctx.getLabSidecar(roomId, pid);
  const existing = sidecar.setsById && set && set.id ? sidecar.setsById[set.id] : null;
  if (isStaleLabClientTimestamp(existing, clientTimestamp)) {
    return {
      ok: true,
      revision: Number(bundle.revision || 0),
      roomId,
      deltaSeq: Number(bundle.deltaSeq || 0),
    };
  }

  const nextSidecar = upsertLabSidecar(sidecar, set, clientTimestamp);
  ctx.setLabSidecar(roomId, pid, nextSidecar);
  entry.labMeta = labMetaFromSidecar(
    nextSidecar,
    entry.labMeta && entry.labMeta.labHistoryVersion
  );
  delete entry.labHistory;

  const { nextSeq, revision } = appendLabDeltaLog(bundle, ({ nextSeq, committedAt, revision }) => ({
    type: 'lab_upsert',
    roomId,
    patientId: pid,
    setId: String((set && set.id) || ''),
    set,
    labHistoryVersion:
      entry.labMeta && entry.labMeta.labHistoryVersion != null
        ? entry.labMeta.labHistoryVersion
        : null,
    originClientId: String(clientId || ''),
    clientTimestamp: Number(clientTimestamp || 0),
    deltaSeq: nextSeq,
    revision,
    committedAt,
  }));

  ctx.markDirty(roomId);
  void ctx.schedulePersist();
  return { ok: true, revision, roomId, deltaSeq: nextSeq };
}

function deletePatientLabHistorySet(ctx, patientId, setId, clientTimestamp, clientId) {
  const resolved = resolveLabHistoryRoom(ctx, patientId);
  if (!resolved.ok) return resolved;

  const { roomId, bundle, entry } = resolved;
  const pid = String(patientId || '').trim();
  const sid = String(setId || '').trim();
  if (!sid) return { ok: false, error: 'setId required' };

  const sidecar = ctx.getLabSidecar(roomId, pid);
  const existing = sidecar.setsById && sidecar.setsById[sid];
  const deletedAt =
    sidecar.deletedById && sidecar.deletedById[sid] != null
      ? Number(sidecar.deletedById[sid])
      : 0;
  const existingTs = existing ? Number(existing._clientTimestamp || 0) : 0;
  if (clientTimestamp < Math.max(existingTs, deletedAt)) {
    return {
      ok: true,
      revision: Number(bundle.revision || 0),
      roomId,
      deltaSeq: Number(bundle.deltaSeq || 0),
    };
  }

  const nextSidecar = deleteLabSidecarSet(sidecar, sid, clientTimestamp);
  ctx.setLabSidecar(roomId, pid, nextSidecar);
  entry.labMeta = labMetaFromSidecar(
    nextSidecar,
    entry.labMeta && entry.labMeta.labHistoryVersion
  );
  delete entry.labHistory;

  const { nextSeq, revision } = appendLabDeltaLog(bundle, ({ nextSeq, committedAt, revision }) => ({
    type: 'lab_delete',
    roomId,
    patientId: pid,
    setId: sid,
    labHistoryVersion:
      entry.labMeta && entry.labMeta.labHistoryVersion != null
        ? entry.labMeta.labHistoryVersion
        : null,
    originClientId: String(clientId || ''),
    clientTimestamp: Number(clientTimestamp || 0),
    deltaSeq: nextSeq,
    revision,
    committedAt,
  }));

  ctx.markDirty(roomId);
  void ctx.schedulePersist();
  return { ok: true, revision, roomId, deltaSeq: nextSeq };
}

function replaceTypedPatientField(ctx, patientId, field, data, expectedVersion, clientTimestamp, meta) {
  const state = ctx.ensureLoadedSync();
  const roomId = ctx.findRoomForPatient(state, patientId);
  if (!roomId) return { ok: false, error: 'patient not found' };
  const bundle = state.roomSyncBundles[roomId];
  const entry = ctx.findBundleEntry(bundle, patientId);
  if (!entry) return { ok: false, error: 'entry not found' };

  const currentVersion = Number(entry[meta.versionKey] || 0);
  let lwwApplied = false;
  if (expectedVersion !== currentVersion) {
    const storedTs = Number(entry[meta.timestampKey] || 0);
    if (clientTimestamp > storedTs) {
      lwwApplied = true;
    } else {
      return {
        ok: true,
        lwwApplied: false,
        version: currentVersion,
        revision: Number(bundle.revision || 0),
        roomId,
        data: entry[field],
      };
    }
  }
  entry[field] = data;
  entry[meta.versionKey] = currentVersion + 1;
  entry[meta.timestampKey] = clientTimestamp;
  bundle.revision = Number(bundle.revision || 0) + 1;
  ctx.markDirty(roomId);
  void ctx.schedulePersist();
  return {
    ok: true,
    lwwApplied,
    version: entry[meta.versionKey],
    revision: bundle.revision,
    roomId,
    data: entry[field],
  };
}

function replacePatientNota(ctx, patientId, data, expectedVersion, clientTimestamp) {
  return replaceTypedPatientField(ctx, patientId, 'note', data, expectedVersion, clientTimestamp, {
    versionKey: '_notaVersion',
    timestampKey: '_notaClientTimestamp',
  });
}

function replacePatientIndicaciones(ctx, patientId, data, expectedVersion, clientTimestamp) {
  return replaceTypedPatientField(
    ctx,
    patientId,
    'indicaciones',
    data,
    expectedVersion,
    clientTimestamp,
    { versionKey: '_indicacionesVersion', timestampKey: '_indicacionesClientTimestamp' }
  );
}

function createPatientFieldHandlers(ctx) {
  return {
    upsertPatientLabHistorySet: (patientId, set, clientTimestamp, clientId) =>
      upsertPatientLabHistorySet(ctx, patientId, set, clientTimestamp, clientId),
    deletePatientLabHistorySet: (patientId, setId, clientTimestamp, clientId) =>
      deletePatientLabHistorySet(ctx, patientId, setId, clientTimestamp, clientId),
    replacePatientNota: (patientId, data, expectedVersion, clientTimestamp) =>
      replacePatientNota(ctx, patientId, data, expectedVersion, clientTimestamp),
    replacePatientIndicaciones: (patientId, data, expectedVersion, clientTimestamp) =>
      replacePatientIndicaciones(ctx, patientId, data, expectedVersion, clientTimestamp),
  };
}

module.exports = { createPatientFieldHandlers };
