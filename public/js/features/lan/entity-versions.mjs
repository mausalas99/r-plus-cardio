/**
 * LiveSync entity-version map (localStorage) and mutation builders.
 */
import { activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import { lanClient } from './runtime.mjs';
import { guardAndSignLiveSyncMutation } from '../../clinical-access-runtime.mjs';
import { createMutationBuilder, wrapLiveSyncPatch } from '../../versioned-mutation.mjs';
import {
  agendaEntityKey,
  todoEntityKey,
  patientEntityKey,
} from '../../live-sync-room.mjs';
import { getHostBundleBases, setHostBundleBases } from '../../host-bundle-bases.mjs';
import { waitForLiveChannelOpen } from './room.mjs';

const LIVE_SYNC_ENTITIES_LS = 'rpc-lan-live-entities';

/** @type {{ showToast?: (msg: string, type?: string) => void }} */
let entityDeps = {};

export function configureLanEntityVersions(deps) {
  if (deps && typeof deps === 'object') Object.assign(entityDeps, deps);
}

export function readLiveSyncEntityMap() {
  try {
    var raw = localStorage.getItem(LIVE_SYNC_ENTITIES_LS);
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function liveSyncEntityStoreKey(entityType, entityId, patientId) {
  if (entityType === 'todo') return 'todo:' + String(patientId || '') + ':' + String(entityId || '');
  if (entityType === 'agenda') return 'agenda:' + String(entityId || '');
  if (entityType === 'patient') return 'patient:' + String(entityId || '');
  return String(entityType || '') + ':' + String(entityId || '');
}

export function getLiveSyncEntityBase(entityType, entityId, patientId) {
  var map = readLiveSyncEntityMap();
  return map[liveSyncEntityStoreKey(entityType, entityId, patientId)] || null;
}

export function rememberLiveSyncEntity(entityType, entityId, patientId, version, data) {
  var map = readLiveSyncEntityMap();
  var row = Object.assign({}, data || {}, { version: Number(version || 1) });
  map[liveSyncEntityStoreKey(entityType, entityId, patientId)] = row;
  try {
    localStorage.setItem(LIVE_SYNC_ENTITIES_LS, JSON.stringify(map));
  } catch { /* ignored */ }
}

/** Local tombstone so LAN reconcile cannot resurrect a patient pending delete sync. */
export function rememberPatientDeleteTombstone(patient) {
  if (!patient || !patient.id || String(patient.id).indexOf('demo-') === 0) return;
  var pid = String(patient.id);
  var cached = getLiveSyncEntityBase('patient', pid, null) || {};
  var ver = cached.version != null ? Number(cached.version) + 1 : 1;
  rememberLiveSyncEntity('patient', pid, null, ver, {
    id: pid,
    registro: String(patient.registro || '').trim(),
    _deleted: true,
    updatedAt: new Date().toISOString(),
  });
}

function purgeRegistroTombstones(map, reg, selfKey) {
  var changed = false;
  for (var key of Object.keys(map)) {
    if (!key.startsWith('patient:')) continue;
    var row = map[key];
    if (!row || row._deleted !== true) continue;
    if (String(row.registro || '').trim() !== reg) continue;
    if (key === selfKey) continue;
    delete map[key];
    changed = true;
  }
  return changed;
}

/** @returns {Array<{ key: string, id: string, registro: string }>} */
export function listPatientDeleteTombstones() {
  var map = readLiveSyncEntityMap();
  var out = [];
  for (var key of Object.keys(map)) {
    if (!key.startsWith('patient:')) continue;
    var row = map[key];
    if (!row || row._deleted !== true) continue;
    out.push({
      key: key,
      id: String(row.id || key.slice(8)).trim(),
      registro: String(row.registro || '').trim(),
    });
  }
  return out;
}

function tombstoneMatchesFilter(row, key, filter) {
  var wantId = String(filter.patientId || '').trim();
  var wantReg = String(filter.registro || '').trim();
  var pid = String(row.id || key.slice(8)).trim();
  var reg = String(row.registro || '').trim();
  if (wantId && pid !== wantId) return false;
  if (wantReg && reg !== wantReg) return false;
  return true;
}

/**
 * Remove local patient delete tombstones (visibility / reconcile recovery).
 * @param {{ patientId?: string, registro?: string }} [filter]
 * @returns {number} cleared count
 */
export function clearPatientDeleteTombstones(filter) {
  filter = filter || {};
  var map = readLiveSyncEntityMap();
  var changed = false;
  var cleared = 0;
  for (var key of Object.keys(map)) {
    if (!key.startsWith('patient:')) continue;
    var row = map[key];
    if (!row || row._deleted !== true) continue;
    if (!tombstoneMatchesFilter(row, key, filter)) continue;
    delete map[key];
    changed = true;
    cleared += 1;
  }
  if (!changed) return 0;
  try {
    localStorage.setItem(LIVE_SYNC_ENTITIES_LS, JSON.stringify(map));
  } catch { /* ignored */ }
  return cleared;
}

/** New admission with same hospital registro must not inherit stale LAN delete tombstones. */
export function clearPatientDeleteTombstoneForAdmit(patientId, registro) {
  var pid = String(patientId || '').trim();
  var reg = String(registro || '').trim();
  if (!pid) return;
  var map = readLiveSyncEntityMap();
  var changed = false;
  var selfKey = liveSyncEntityStoreKey('patient', pid, null);
  if (map[selfKey] && map[selfKey]._deleted === true) {
    delete map[selfKey];
    changed = true;
  }
  if (reg) changed = purgeRegistroTombstones(map, reg, selfKey) || changed;
  if (!changed) return;
  try {
    localStorage.setItem(LIVE_SYNC_ENTITIES_LS, JSON.stringify(map));
  } catch { /* ignored */ }
}

export function syncHostBundleEntityFromApplied(msg) {
  var rid = String((msg && msg.roomId) || activeLiveSyncRoomId || '').trim();
  if (!rid || !msg || msg.version == null) return;
  var bases = getHostBundleBases(rid);
  var key = null;
  if (msg.entityType === 'agenda') key = agendaEntityKey(msg.entityId);
  else if (msg.entityType === 'todo' && msg.patientId) {
    key = todoEntityKey(msg.patientId, msg.entityId);
  } else if (msg.entityType === 'patient') {
    var reg = msg.data && msg.data.registro;
    key = patientEntityKey(msg.entityId, reg);
  }
  if (!key) return;
  var entityVersions = Object.assign({}, bases.entityVersions || {});
  entityVersions[key] = Number(msg.version);
  setHostBundleBases(rid, {
    revision: bases.revision,
    entityVersions: entityVersions,
  });
}

export function stampTodosWithEntityVersions(todosMap, entityVersions) {
  var versions = entityVersions && typeof entityVersions === 'object' ? entityVersions : {};
  var out = {};
  Object.keys(todosMap || {}).forEach(function (pid) {
    out[pid] = (todosMap[pid] || []).map(function (t) {
      if (!t || !t.id) return t;
      var key = liveSyncEntityStoreKey('todo', t.id, pid);
      if (versions[key] == null) return t;
      return Object.assign({}, t, { version: Number(versions[key]) });
    });
  });
  return out;
}

export function rememberTodosFromMap(todosMap) {
  Object.keys(todosMap || {}).forEach(function (pid) {
    (todosMap[pid] || []).forEach(function (t) {
      if (!t || !t.id) return;
      var ver = Number(t.version || 0);
      if (!ver) return;
      rememberLiveSyncEntity('todo', t.id, pid, ver, t);
    });
  });
}

export function buildLiveSyncMutationFromDesired(entityType, entityId, desired, extra) {
  extra = extra || {};
  var patientId = extra.patientId;
  var cached = getLiveSyncEntityBase(entityType, entityId, patientId);
  var base = cached
    ? Object.assign({}, cached)
    : { id: entityId, version: Number(desired && desired.version != null ? desired.version : 0) };
  if (entityType === 'todo' && patientId && !base.patientId) base.patientId = patientId;
  var builder = createMutationBuilder(entityType, entityId).captureBase(base);
  var hasChange = false;
  Object.keys(desired || {}).forEach(function (key) {
    if (key === 'version') return;
    if (desired[key] !== base[key]) {
      builder.set(key, desired[key]);
      hasChange = true;
    }
  });
  if (!hasChange && desired) {
    Object.keys(desired).forEach(function (key) {
      if (key === 'version') return;
      builder.set(key, desired[key]);
    });
  }
  return builder.build(extra);
}

export function sendLiveSyncMutation(mutation) {
  if (!activeLiveSyncRoomId || !mutation) return;
  var rid = String(activeLiveSyncRoomId || '').trim();
  var envelope = wrapLiveSyncPatch(rid, getLanClientId(), mutation);

  function transmit() {
    if (!lanClient.liveConnected) return false;
    void guardAndSignLiveSyncMutation(mutation, envelope)
      .then(function () {
        lanClient.sendLive(envelope);
      })
      .catch(function (err) {
        if (err && err.code === 'CLINICAL_ACCESS_DENIED' && typeof entityDeps.showToast === 'function') {
          entityDeps.showToast(String(err.message || 'Acceso clínico denegado'), 'error');
        }
      });
    return true;
  }

  if (transmit()) return;
  try {
    lanClient.connectLiveChannel(rid);
  } catch { /* ignored */ }
  void waitForLiveChannelOpen(rid, 4500).then(function () {
    transmit();
  });
}
