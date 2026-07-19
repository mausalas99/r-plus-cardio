'use strict';

const { mergeRecordsLww } = require('./lww-utils.js');
const { ConflictError, keysChanged, pick } = require('./conflict-resolver-utils.js');

function persistEntity(store, row, setOpts) {
  store.setEntity(row, setOpts);
  if (row.roomId) store.materializeRoomViews(row.roomId, setOpts);
}

function applyCreateMutation(store, mutation, setOpts) {
  const { entityType, entityId, roomId, patientId, data } = mutation;
  const expectedVersion = Number(mutation.expectedVersion || 0);
  if (expectedVersion > 0) {
    throw new ConflictError({ conflictingKeys: ['*'], serverData: null, clientData: data });
  }
  const version = 1;
  persistEntity(
    store,
    {
      roomId,
      entityType,
      entityId,
      patientId,
      version,
      data,
      deleted: mutation.op === 'delete',
    },
    setOpts
  );
  return { ok: true, entityType, entityId, version, data, autoMerged: false };
}

function applyExactVersionMutation(store, mutation, server, setOpts) {
  const { entityType, entityId, roomId, patientId, data } = mutation;
  const version = server.version + 1;
  const nextData =
    mutation.op === 'delete' ? { ...server.data, _deleted: true } : { ...server.data, ...data };
  persistEntity(
    store,
    {
      roomId,
      entityType,
      entityId,
      patientId,
      version,
      data: nextData,
      deleted: mutation.op === 'delete',
    },
    setOpts
  );
  return { ok: true, entityType, entityId, version, data: nextData, autoMerged: false };
}

function buildIncomingData(mutation, server, data) {
  if (mutation.op === 'delete') {
    return {
      ...(server.data || {}),
      _deleted: true,
      updatedAt: data.updatedAt || data.lanUpdatedAt,
    };
  }
  return { ...(server.data || {}), ...data };
}

function applyLwwWithoutBase(store, mutation, server, setOpts) {
  const { entityType, entityId, roomId, patientId, data, changedKeys } = mutation;
  const incomingData = buildIncomingData(mutation, server, data);
  const keysToMerge = changedKeys.length ? changedKeys : Object.keys(data || {});
  const { merged } = mergeRecordsLww(server.data, incomingData, {
    changedKeys: keysToMerge.length ? keysToMerge : Object.keys(incomingData),
    timestampFields: ['lanUpdatedAt', 'updatedAt'],
  });
  const version = server.version + 1;
  persistEntity(
    store,
    {
      roomId,
      entityType,
      entityId,
      patientId,
      version,
      data: merged,
      deleted: mutation.op === 'delete',
    },
    setOpts
  );
  return {
    ok: true,
    entityType,
    entityId,
    version,
    data: merged,
    autoMerged: false,
    lwwApplied: true,
    overwrittenKeys: ['*'],
  };
}

function applyAutoMergeMutation(store, mutation, server, changedKeys, setOpts) {
  const { entityType, entityId, roomId, patientId, data } = mutation;
  const merged = { ...server.data, ...pick(data, changedKeys) };
  const version = server.version + 1;
  persistEntity(
    store,
    {
      roomId,
      entityType,
      entityId,
      patientId,
      version,
      data: merged,
      deleted: mutation.op === 'delete' || !!server.deleted,
    },
    setOpts
  );
  return { ok: true, entityType, entityId, version, data: merged, autoMerged: true };
}

function applyLwwOverlapMutation(store, mutation, server, overlap, setOpts) {
  const { entityType, entityId, roomId, patientId, data } = mutation;
  const incomingData = buildIncomingData(mutation, server, data);
  const { merged, overwrittenKeys } = mergeRecordsLww(server.data, incomingData, {
    changedKeys: overlap,
    timestampFields: ['lanUpdatedAt', 'updatedAt'],
  });
  const version = server.version + 1;
  persistEntity(
    store,
    {
      roomId,
      entityType,
      entityId,
      patientId,
      version,
      data: merged,
      deleted: mutation.op === 'delete',
    },
    setOpts
  );
  return {
    ok: true,
    entityType,
    entityId,
    version,
    data: merged,
    autoMerged: false,
    lwwApplied: true,
    overwrittenKeys,
  };
}

function applyMutation(store, mutation, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const setOpts = deferPersist ? { deferPersist: true } : undefined;
  const entityType = mutation.entityType;
  const entityId = mutation.entityId;
  const expectedVersion = Number(mutation.expectedVersion || 0);
  const changedKeys = Array.isArray(mutation.changedKeys) ? mutation.changedKeys : [];
  const baseData = mutation.baseData;
  const roomId = mutation.roomId;
  const patientId = mutation.patientId;

  const server = store.getEntity({ entityType, entityId, roomId, patientId });

  if (!server) return applyCreateMutation(store, mutation, setOpts);
  if (expectedVersion === server.version) return applyExactVersionMutation(store, mutation, server, setOpts);
  if (!baseData || !changedKeys.length) {
    return applyLwwWithoutBase(store, { ...mutation, changedKeys }, server, setOpts);
  }

  const serverChangedKeys = keysChanged(server.data, baseData);
  const overlap = serverChangedKeys.filter((k) => changedKeys.includes(k));
  if (overlap.length === 0) {
    return applyAutoMergeMutation(store, mutation, server, changedKeys, setOpts);
  }
  return applyLwwOverlapMutation(store, mutation, server, overlap, setOpts);
}

module.exports = {
  applyMutation,
  applyCreateMutation,
  applyExactVersionMutation,
  applyLwwWithoutBase,
  applyAutoMergeMutation,
  applyLwwOverlapMutation,
};
