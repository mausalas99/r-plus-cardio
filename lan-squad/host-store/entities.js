'use strict';

const { entryPatientId } = require('../persistence/sharded-host-persistence.js');
const {
  agendaEntityKey,
  todoEntityKey,
  historiaClinicaEntityKey,
} = require('../entity-keys.js');
const { nowIso } = require('./utils.js');

function entityRecordFromBundle(rec) {
  return {
    version: Number(rec.version || 1),
    data: rec.data,
    fieldMeta: rec.fieldMeta && typeof rec.fieldMeta === 'object' ? rec.fieldMeta : {},
  };
}

function getPatientEntity(state, id) {
  const row = state.patients.find((p) => p.id === id);
  if (!row || row._deleted) return null;
  return { version: Number(row.version || 1), data: row };
}

function getAgendaTodoEntity(ctx, { type, roomId, id, patientId }) {
  const bundle = ctx.getRoomSyncBundle(roomId);
  if (!bundle || !bundle.entities) return null;
  const key = type === 'agenda' ? agendaEntityKey(id) : todoEntityKey(patientId, id);
  const rec = bundle.entities[key];
  if (!rec || rec.deleted) return null;
  return entityRecordFromBundle(rec);
}

function getHistoriaFromBundleEntities(bundle, pid) {
  const key = historiaClinicaEntityKey(pid);
  const rec = bundle.entities && bundle.entities[key];
  if (!rec || rec.deleted) return null;
  return entityRecordFromBundle(rec);
}

function getHistoriaFromBundleEntries(bundle, pid) {
  const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
  for (const ent of entries) {
    const p = ent && ent.patient;
    if (!p || String(p.id || '').trim() !== pid) continue;
    const hc = p.historiaClinica;
    if (!hc || typeof hc !== 'object') return null;
    const data = hc.data && typeof hc.data === 'object' ? hc.data : hc;
    return {
      version: Number(hc.version || 1),
      data,
      fieldMeta: hc.fieldMeta && typeof hc.fieldMeta === 'object' ? hc.fieldMeta : {},
    };
  }
  return null;
}

function getHistoriaClinicaEntity(ctx, { roomId, patientId, id }) {
  const bundle = ctx.getRoomSyncBundle(roomId);
  if (!bundle) return null;
  const pid = String(patientId || id || '').trim();
  return getHistoriaFromBundleEntities(bundle, pid) || getHistoriaFromBundleEntries(bundle, pid);
}

const GET_ENTITY_HANDLERS = {
  patient: (ctx, { entityId }) => getPatientEntity(ctx.ensureLoadedSync(), entityId),
  agenda: (ctx, args) =>
    getAgendaTodoEntity(ctx, { roomId: args.roomId, patientId: args.patientId, id: args.entityId, type: 'agenda' }),
  todo: (ctx, args) =>
    getAgendaTodoEntity(ctx, { roomId: args.roomId, patientId: args.patientId, id: args.entityId, type: 'todo' }),
  historiaClinica: (ctx, args) => getHistoriaClinicaEntity(ctx, args),
};

function getEntity(ctx, { entityType, entityId, roomId, patientId }) {
  const type = String(entityType || '');
  const id = String(entityId || '');
  const handler = GET_ENTITY_HANDLERS[type];
  if (!handler) return null;
  return handler(ctx, { entityId: id, roomId, patientId });
}

function bundleEntryMatchesPatient(ent, patientId, registro) {
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  const entryId = entryPatientId(ent);
  if (pid && entryId && entryId === pid) return true;
  if (!reg) return false;
  const p = ent && ent.patient;
  const entryReg = String((p && p.registro) || ent.registro || '').trim();
  return !!(entryReg && entryReg === reg);
}

function purgePatientFromAllRoomBundles(ctx, state, patientId, registro, opts) {
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  if (!pid && !reg) return false;
  const deferPersist = !!(opts && opts.deferPersist);
  if (!state.roomSyncBundles || typeof state.roomSyncBundles !== 'object') return false;
  let changed = false;
  for (const rid of Object.keys(state.roomSyncBundles)) {
    const bundle = state.roomSyncBundles[rid];
    if (!bundle || !Array.isArray(bundle.entries)) continue;
    const before = bundle.entries.length;
    bundle.entries = bundle.entries.filter((ent) => !bundleEntryMatchesPatient(ent, pid, reg));
    if (bundle.entries.length === before) continue;
    bundle.revision = Number(bundle.revision || 0) + 1;
    bundle.committedAt = nowIso();
    ctx.markDirty(rid);
    changed = true;
  }
  if (changed && !deferPersist) {
    ctx.markDirty(null);
    void ctx.schedulePersist();
  }
  return changed;
}

function purgePatientFromHostCensus(ctx, patientId, registro, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const state = ctx.ensureLoadedSync();
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  if (!pid && !reg) return false;
  const idx = state.patients.findIndex((p) => p && p.id === pid && !p._deleted);
  if (idx >= 0) {
    const row = state.patients[idx];
    setEntity(
      ctx,
      {
        entityType: 'patient',
        entityId: pid,
        version: Number(row.version || 1) + 1,
        data: { ...row, _deleted: true },
        deleted: true,
      },
      opts
    );
    return true;
  }
  const changed = purgePatientFromAllRoomBundles(ctx, state, pid, reg, opts);
  if (!changed) return false;
  if (!deferPersist) {
    ctx.markDirty(null);
    void ctx.schedulePersist();
  }
  return true;
}

function collectAgendaFromEntities(entities) {
  const agenda = [];
  for (const [key, rec] of Object.entries(entities)) {
    if (!rec || rec.deleted || !key.startsWith('a:')) continue;
    if (rec.data && typeof rec.data === 'object') agenda.push(rec.data);
  }
  return agenda;
}

function collectTodosFromEntities(entities) {
  const todos = {};
  for (const [key, rec] of Object.entries(entities)) {
    if (!rec || rec.deleted || !key.startsWith('t:')) continue;
    const rest = key.slice(2);
    const colon = rest.indexOf(':');
    const pid = colon >= 0 ? rest.slice(0, colon) : rest;
    if (!pid || !rec.data || typeof rec.data !== 'object') continue;
    if (!todos[pid]) todos[pid] = [];
    todos[pid].push(rec.data);
  }
  return todos;
}

function sortByUpdatedAt(items) {
  items.sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
}

function materializeRoomViews(ctx, roomId, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  const entities = bundle.entities || {};
  const agenda = collectAgendaFromEntities(entities);
  const todos = collectTodosFromEntities(entities);
  sortByUpdatedAt(agenda);
  for (const pid of Object.keys(todos)) sortByUpdatedAt(todos[pid]);
  bundle.agenda = agenda;
  bundle.todos = todos;
  bundle.committedAt = nowIso();
  if (!deferPersist) {
    ctx.markDirty(roomId);
    void ctx.schedulePersist();
  }
  return bundle;
}

function maybePersistEntity(ctx, roomId, deferPersist) {
  if (deferPersist) return;
  ctx.markDirty(roomId);
  void ctx.schedulePersist();
}

function setPatientEntity(ctx, { entityId, version, data, deleted }, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const id = String(entityId || '');
  const state = ctx.ensureLoadedSync();
  const t = nowIso();
  const idx = state.patients.findIndex((p) => p.id === id);
  const nextData = data && typeof data === 'object' ? { ...data, id } : { id };
  const nextVersion = Number(version || 1);

  if (idx === -1) {
    if (deleted) {
      purgePatientFromAllRoomBundles(
        ctx,
        state,
        id,
        String(nextData.registro || '').trim(),
        opts
      );
      maybePersistEntity(ctx, null, deferPersist);
      return null;
    }
    const row = { ...nextData, version: nextVersion, updatedAt: t, audit_log: [] };
    state.patients.push(row);
    maybePersistEntity(ctx, null, deferPersist);
    return row;
  }

  const row = { ...state.patients[idx], ...nextData, version: nextVersion, updatedAt: t };
  if (deleted) row._deleted = true;
  state.patients[idx] = row;
  if (deleted) purgePatientFromAllRoomBundles(ctx, state, id, row.registro, opts);
  maybePersistEntity(ctx, null, deferPersist);
  return row;
}

function setAgendaTodoEntity(ctx, { roomId, entityType, entityId, patientId, version, data, deleted }, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const type = String(entityType || '');
  const id = String(entityId || '');
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  const key = type === 'agenda' ? agendaEntityKey(id) : todoEntityKey(patientId, id);
  const t = nowIso();
  bundle.entities[key] = {
    version: Number(version || 1),
    data: data && typeof data === 'object' ? data : {},
    updatedAt: t,
    deleted: !!deleted,
  };
  bundle.entityVersions[key] = Number(version || 1);
  bundle.revision = Number(bundle.revision || 0) + 1;
  maybePersistEntity(ctx, roomId, deferPersist);
  materializeRoomViews(ctx, roomId, opts);
  return bundle.entities[key];
}

function setHistoriaClinicaEntity(ctx, { roomId, entityId, patientId, version, data, deleted }, opts) {
  const deferPersist = !!(opts && opts.deferPersist);
  const state = ctx.ensureLoadedSync();
  const bundle = ctx.ensureRoomBundle(state, roomId);
  const key = historiaClinicaEntityKey(patientId || entityId);
  const prev = bundle.entities[key];
  const prevData = prev && prev.data && typeof prev.data === 'object' ? { ...prev.data } : {};
  const patch = data && typeof data === 'object' ? data : {};
  const t = nowIso();
  const nextData = { ...prevData, ...patch, patientId: String(patientId || entityId), updatedAt: t };
  bundle.entities[key] = {
    version: Number(version || 1),
    data: nextData,
    updatedAt: t,
    deleted: !!deleted,
  };
  bundle.entityVersions[key] = Number(version || 1);
  bundle.revision = Number(bundle.revision || 0) + 1;
  if (!Array.isArray(bundle.audit_log)) bundle.audit_log = [];
  maybePersistEntity(ctx, roomId, deferPersist);
  return bundle.entities[key];
}

const SET_ENTITY_HANDLERS = {
  patient: setPatientEntity,
  agenda: setAgendaTodoEntity,
  todo: setAgendaTodoEntity,
  historiaClinica: setHistoriaClinicaEntity,
};

function setEntity(ctx, args, opts) {
  const type = String(args.entityType || '');
  const handler = SET_ENTITY_HANDLERS[type];
  if (!handler) throw new Error('unsupported entity type');
  return handler(ctx, args, opts);
}

function createEntityHandlers(ctx) {
  return {
    getEntity: (args) => getEntity(ctx, args),
    purgePatientFromHostCensus: (patientId, registro, opts) =>
      purgePatientFromHostCensus(ctx, patientId, registro, opts),
    materializeRoomViews: (roomId, opts) => materializeRoomViews(ctx, roomId, opts),
    setEntity: (args, opts) => setEntity(ctx, args, opts),
  };
}

module.exports = { createEntityHandlers };
