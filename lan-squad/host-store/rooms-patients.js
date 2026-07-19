'use strict';

const { appendAudit } = require('../audit-log.js');
const { nowIso, newId } = require('./utils.js');

function createUpsertPatient(ctx) {
  return function upsertPatient(patient, expectedVersion) {
    const state = ctx.ensureLoadedSync();
    const idx = state.patients.findIndex((p) => p.id === patient.id);
    const t = nowIso();
    if (idx === -1) {
      const p = { ...patient, version: 1, updatedAt: t, audit_log: [] };
      appendAudit(
        { at: t, clientId: 'host', action: 'patient.create', detail: { id: p.id } },
        p.audit_log
      );
      state.patients.push(p);
      ctx.markDirty(null);
      void ctx.schedulePersist();
      return p;
    }
    const cur = state.patients[idx];
    if (expectedVersion == null) {
      const err = new Error('expectedVersion required');
      err.code = 'CONFLICT';
      err.serverPatient = cur;
      throw err;
    }
    if (Number(cur.version) !== Number(expectedVersion)) {
      const err = new Error('conflict');
      err.code = 'CONFLICT';
      err.serverPatient = cur;
      throw err;
    }
    if (!Array.isArray(cur.audit_log)) cur.audit_log = [];
    const next = { ...cur, ...patient, version: Number(cur.version || 1) + 1, updatedAt: t };
    appendAudit(
      { at: t, clientId: 'host', action: 'patient.update', detail: { id: next.id } },
      next.audit_log
    );
    state.patients[idx] = next;
    ctx.markDirty(null);
    void ctx.schedulePersist();
    return next;
  };
}

function createRoomHandlers(ctx) {
  function listRooms() {
    return ctx.ensureLoadedSync().rooms.slice();
  }

  function createRoom(displayName) {
    const state = ctx.ensureLoadedSync();
    const t = nowIso();
    const r = {
      id: newId('room'),
      displayName: String(displayName || 'Sala'),
      createdAt: t,
      version: 1,
      audit_log: [],
    };
    appendAudit(
      { at: t, clientId: 'host', action: 'room.create', detail: { id: r.id } },
      r.audit_log
    );
    state.rooms.push(r);
    ctx.markDirty(null);
    void ctx.schedulePersist();
    return r;
  }

  function renameRoom(id, displayName) {
    const state = ctx.ensureLoadedSync();
    const r = state.rooms.find((x) => x.id === id);
    if (!r) throw new Error('room not found');
    r.displayName = String(displayName || r.displayName);
    r.version = Number(r.version || 1) + 1;
    if (!Array.isArray(r.audit_log)) r.audit_log = [];
    appendAudit(
      { at: nowIso(), clientId: 'host', action: 'room.rename', detail: { id: r.id } },
      r.audit_log
    );
    ctx.markDirty(null);
    void ctx.schedulePersist();
    return r;
  }

  function deleteRoom(id) {
    const state = ctx.ensureLoadedSync();
    const rid = String(id || '');
    state.rooms = state.rooms.filter((x) => x.id !== rid);
    if (state.roomSyncBundles && state.roomSyncBundles[rid]) {
      delete state.roomSyncBundles[rid];
      ctx.markDirty(rid);
    }
    ctx.markDirty(null);
    void ctx.schedulePersist();
  }

  return { listRooms, createRoom, renameRoom, deleteRoom };
}

function createRoomsPatientsHandlers(ctx) {
  const roomHandlers = createRoomHandlers(ctx);
  return {
    upsertPatient: createUpsertPatient(ctx),
    ...roomHandlers,
  };
}

module.exports = { createRoomsPatientsHandlers };
