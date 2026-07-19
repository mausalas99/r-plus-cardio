'use strict';

const {
  agendaEntityKey,
  todoEntityKey,
  historiaClinicaEntityKey,
} = require('../entity-keys.js');
const { nowIso } = require('./utils.js');

const DELTA_ENTITY_KEY_BUILDERS = {
  agenda: (_patientId, entityId) => agendaEntityKey(entityId),
  todo: (patientId, entityId) => todoEntityKey(patientId, entityId),
  historiaClinica: (patientId, entityId) => historiaClinicaEntityKey(patientId || entityId),
};

const COMMAND_ENTITY_KEY_BUILDERS = {
  estadoActual: (entityId, patientId) => `cmd:estadoActual:${entityId || patientId}`,
  eventualidades: (entityId, patientId) => `cmd:eventualidades:${entityId || patientId}`,
  pendientes: (entityId, patientId) => `cmd:pendientes:${entityId || patientId}`,
};

function commandEntityKey(command) {
  const domain = String((command && command.domain) || '').trim();
  const entityId = String((command && command.entityId) || '').trim();
  const patientId = String((command && command.patientId) || '').trim();
  const build = COMMAND_ENTITY_KEY_BUILDERS[domain];
  if (!build) throw new Error('unsupported_command_domain');
  return build(entityId, patientId);
}

function ensureDeltaEntity(ctx, { roomId, entityType, entityId, patientId }) {
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  const type = String(entityType || '');
  const id = String(entityId || '');
  const buildKey = DELTA_ENTITY_KEY_BUILDERS[type];
  if (!buildKey) throw new Error('unsupported_delta_entity');
  const key = buildKey(patientId, id);

  if (!bundle.entities[key] || typeof bundle.entities[key] !== 'object') {
    bundle.entities[key] = {
      version: 0,
      data: {},
      fieldMeta: {},
      updatedAt: nowIso(),
      deleted: false,
    };
  }
  if (!bundle.entities[key].fieldMeta || typeof bundle.entities[key].fieldMeta !== 'object') {
    bundle.entities[key].fieldMeta = {};
  }
  if (!bundle.entities[key].data || typeof bundle.entities[key].data !== 'object') {
    bundle.entities[key].data = {};
  }
  return { bundle, key, rec: bundle.entities[key] };
}

function commitDeltaEntity(ctx, args) {
  const { roomId, entityType, entityId, patientId, data, fieldMeta, buildFieldMeta } = args;
  const { bundle, key, rec } = ensureDeltaEntity(ctx, {
    roomId,
    entityType,
    entityId,
    patientId,
  });
  const nextVersion = Number(rec.version || 0) + 1;
  const nextSeq = Number(bundle.deltaSeq || 0) + 1;
  const committedAt = nowIso();
  const nextFieldMeta =
    typeof buildFieldMeta === 'function'
      ? buildFieldMeta({ deltaSeq: nextSeq, committedAt, previousFieldMeta: fieldMeta || {} })
      : fieldMeta;
  rec.version = nextVersion;
  rec.data = data && typeof data === 'object' ? data : {};
  rec.fieldMeta = nextFieldMeta && typeof nextFieldMeta === 'object' ? nextFieldMeta : {};
  rec.updatedAt = committedAt;
  rec.deleted = false;
  bundle.entityVersions[key] = nextVersion;
  bundle.revision = Number(bundle.revision || 0) + 1;
  bundle.deltaSeq = nextSeq;
  bundle.committedAt = committedAt;
  if (!Array.isArray(bundle.deltaLog)) bundle.deltaLog = [];
  return { bundle, key, rec, version: nextVersion, deltaSeq: nextSeq, committedAt };
}

function appendDeltaLog(ctx, roomId, entry) {
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  if (!Array.isArray(bundle.deltaLog)) bundle.deltaLog = [];
  bundle.deltaLog.push(entry);
  while (bundle.deltaLog.length > 200) bundle.deltaLog.shift();
  ctx.markDirty(roomId);
  void ctx.schedulePersist();
}

function getRoomDeltaLog(ctx, roomId, afterSeq) {
  const bundle = ctx.getRoomSyncBundle(roomId);
  if (!bundle) return { ok: false, error: 'no_bundle', deltas: [] };
  const seq = Number(afterSeq || 0);
  const log = Array.isArray(bundle.deltaLog) ? bundle.deltaLog : [];
  const deltas = log.filter((entry) => Number(entry.deltaSeq || 0) > seq);
  if (deltas.length && Number(deltas[0].deltaSeq) !== seq + 1) {
    return { ok: false, error: 'delta_gap', deltas: [] };
  }
  return { ok: true, deltas, latestDeltaSeq: Number(bundle.deltaSeq || 0) };
}

function getAppliedCommand(ctx, roomId, commandId) {
  const bundle = ctx.getRoomSyncBundle(roomId);
  const id = String(commandId || '').trim();
  if (!bundle || !id || !Array.isArray(bundle.deltaLog)) return null;
  return (
    bundle.deltaLog.find((entry) => entry && entry.type === 'command' && entry.commandId === id) ||
    null
  );
}

function getCommandEntityState(ctx, roomId, command) {
  const bundle = ctx.ensureRoomBundle(ctx.ensureLoadedSync(), roomId);
  const key = commandEntityKey(command);
  const rec = bundle.entities[key];
  return {
    key,
    version: Number((rec && rec.version) || 0),
    data: rec && rec.data && typeof rec.data === 'object' ? rec.data : {},
    meta: rec && rec.commandMeta && typeof rec.commandMeta === 'object' ? rec.commandMeta : {},
  };
}

function buildCommandDeltaEntry(command, roomId, nextSeq, revision, committedAt, status) {
  return {
    type: 'command',
    status: status || 'accepted',
    commandId: String(command.commandId || ''),
    domain: String(command.domain || ''),
    op: String(command.op || ''),
    roomId,
    patientId: command.patientId || null,
    entityId: command.entityId || null,
    originClientId: String(command.clientId || ''),
    clientCreatedAt: Number(command.clientCreatedAt || 0),
    deltaSeq: nextSeq,
    revision,
    committedAt,
    payload: command.payload || {},
  };
}

function commitCommandEntity(ctx, { roomId, command, data, meta, status, nowIsoOverride }) {
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  const key = commandEntityKey(command);
  const rec =
    bundle.entities[key] && typeof bundle.entities[key] === 'object'
      ? bundle.entities[key]
      : { version: 0, data: {}, commandMeta: {}, deleted: false };
  const nextSeq = Number(bundle.deltaSeq || 0) + 1;
  const committedAt = nowIsoOverride || nowIso();
  rec.version = Number(rec.version || 0) + 1;
  rec.data = data && typeof data === 'object' ? data : {};
  rec.commandMeta = meta && typeof meta === 'object' ? meta : {};
  rec.updatedAt = committedAt;
  rec.deleted = false;
  bundle.entities[key] = rec;
  bundle.entityVersions[key] = rec.version;
  bundle.revision = Number(bundle.revision || 0) + 1;
  bundle.deltaSeq = nextSeq;
  bundle.committedAt = committedAt;
  if (!Array.isArray(bundle.deltaLog)) bundle.deltaLog = [];
  const entry = buildCommandDeltaEntry(
    command,
    roomId,
    nextSeq,
    bundle.revision,
    committedAt,
    status
  );
  bundle.deltaLog.push(entry);
  while (bundle.deltaLog.length > 200) bundle.deltaLog.shift();
  ctx.markDirty(roomId);
  void ctx.schedulePersist();
  return {
    bundle,
    key,
    rec,
    entry,
    version: rec.version,
    deltaSeq: nextSeq,
    revision: bundle.revision,
    committedAt,
  };
}

function createDeltaCommandHandlers(ctx) {
  return {
    ensureDeltaEntity: (args) => ensureDeltaEntity(ctx, args),
    commitDeltaEntity: (args) => commitDeltaEntity(ctx, args),
    appendDeltaLog: (roomId, entry) => appendDeltaLog(ctx, roomId, entry),
    getRoomDeltaLog: (roomId, afterSeq) => getRoomDeltaLog(ctx, roomId, afterSeq),
    getAppliedCommand: (roomId, commandId) => getAppliedCommand(ctx, roomId, commandId),
    getCommandEntityState: (roomId, command) => getCommandEntityState(ctx, roomId, command),
    commitCommandEntity: (args) => commitCommandEntity(ctx, args),
  };
}

module.exports = { createDeltaCommandHandlers };
