'use strict';

const { nowIso } = require('./utils.js');

function ensureRoomRecord(state, roomId, displayName) {
  const rid = String(roomId || '');
  if (!rid) return;
  const rooms = Array.isArray(state.rooms) ? state.rooms : [];
  if (rooms.some((x) => x && x.id === rid)) return;
  rooms.push({
    id: rid,
    displayName: String(displayName || 'Sala en vivo').trim() || 'Sala en vivo',
    createdAt: nowIso(),
    version: 1,
    audit_log: [],
  });
  state.rooms = rooms;
}

function ensureRoomBundle(state, roomId) {
  const rid = String(roomId || '');
  if (!rid) throw new Error('room id required');
  if (!state.roomSyncBundles) state.roomSyncBundles = {};
  let b = state.roomSyncBundles[rid];
  if (!b || typeof b !== 'object') {
    b = {
      revision: 0,
      entityVersions: {},
      deltaSeq: 0,
      deltaLog: [],
      committedAt: nowIso(),
      uploadedByClientId: '',
      entities: {},
      agenda: [],
      todos: {},
      entries: [],
      manejo: null,
      clinicalOps: null,
      audit_log: [],
    };
    state.roomSyncBundles[rid] = b;
  }
  if (!b.entities || typeof b.entities !== 'object') b.entities = {};
  if (!b.entityVersions || typeof b.entityVersions !== 'object') b.entityVersions = {};
  if (!Array.isArray(b.deltaLog)) b.deltaLog = [];
  if (!Number.isFinite(Number(b.deltaSeq))) b.deltaSeq = 0;
  return b;
}

function findRoomForPatient(state, patientId) {
  if (!state.roomSyncBundles) return null;
  const pid = String(patientId || '').trim();
  if (!pid) return null;
  for (const [roomId, bundle] of Object.entries(state.roomSyncBundles)) {
    if (!bundle || !Array.isArray(bundle.entries)) continue;
    const found = bundle.entries.some((e) => {
      if (!e) return false;
      if (e.id === pid) return true;
      return !!(e.patient && e.patient.id === pid);
    });
    if (found) return roomId;
  }
  return null;
}

function findBundleEntry(bundle, patientId) {
  const pid = String(patientId || '').trim();
  return (bundle?.entries || []).find((e) => {
    if (!e) return false;
    if (e.id === pid) return true;
    return !!(e.patient && e.patient.id === pid);
  });
}

module.exports = {
  ensureRoomRecord,
  ensureRoomBundle,
  findRoomForPatient,
  findBundleEntry,
};
