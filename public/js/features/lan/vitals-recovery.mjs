/**
 * Recover EA monitoreo (vitals historial) from LAN cache on iPad/mobile
 * when census was wiped before sync completed.
 */
import { storage } from '../../storage.js';
import { patients, saveState } from '../../app-state.mjs';
import { peekOutbox } from '../../live-sync-outbox.mjs';
import { mergeMonitoreo, ensureMonitoreo, mergePatientMonitoreoFromImported } from '../estado-actual-data.mjs';
import { monitoreoUpdatedAt } from '../../lan-patient-merge.mjs';
import { scheduleLiveSyncPush } from '../lan-sync.mjs';

const UNDO_STACK_KEY = 'rpc-undo-stack';

function historialCount(monitoreo) {
  if (!monitoreo || typeof monitoreo !== 'object') return 0;
  return Array.isArray(monitoreo.historial) ? monitoreo.historial.length : 0;
}

function monitoreoScore(monitoreo) {
  var at = monitoreoUpdatedAt(monitoreo);
  return { at: String(at || ''), count: historialCount(monitoreo) };
}

function isBetterMonitoreo(candidate, current) {
  if (!candidate) return false;
  if (!current) return historialCount(candidate) > 0 || !!(candidate.textoGuardado && candidate.textoGuardado.text);
  var a = monitoreoScore(candidate);
  var b = monitoreoScore(current);
  if (a.count !== b.count) return a.count > b.count;
  return a.at.localeCompare(b.at) > 0;
}

function cloneMonitoreo(mon) {
  try {
    return JSON.parse(JSON.stringify(mon));
  } catch {
    return null;
  }
}

function patientKeys(patient) {
  if (!patient || typeof patient !== 'object') return [];
  var keys = [];
  var id = String(patient.id || '').trim();
  var reg = String(patient.registro || '').trim();
  if (id) keys.push('id:' + id);
  if (reg) keys.push('reg:' + reg);
  return keys;
}

/** @param {Map<string, object>} map @param {object} patient */
function rememberPatientMonitoreo(map, patient) {
  if (!patient || !patient.monitoreo) return;
  if (historialCount(patient.monitoreo) === 0 && !(patient.monitoreo.textoGuardado && patient.monitoreo.textoGuardado.text)) {
    return;
  }
  var keys = patientKeys(patient);
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    var cur = map.get(key);
    if (!cur || isBetterMonitoreo(patient.monitoreo, cur)) {
      map.set(key, cloneMonitoreo(patient.monitoreo));
    }
  }
}

function collectFromEntries(map, entries, patientRows) {
  if (!Array.isArray(entries)) return;
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    if (!entry || !entry.patient) continue;
    rememberPatientMonitoreo(map, entry.patient);
    if (patientRows && entry.patient.id) {
      patientRows.push(entry.patient);
    }
  }
}

function readUndoStackPatients() {
  try {
    var raw = localStorage.getItem(UNDO_STACK_KEY);
    if (!raw) return [];
    var stack = JSON.parse(raw);
    if (!Array.isArray(stack)) return [];
    var out = [];
    for (var i = 0; i < stack.length; i += 1) {
      var snap = stack[i];
      if (snap && snap.data && Array.isArray(snap.data.patients)) {
        out = out.concat(snap.data.patients);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function collectFromOutboxRoom(rid, byKey, patientRows, sources) {
  var outbox = peekOutbox(rid);
  for (var oi = 0; oi < outbox.length; oi += 1) {
    var item = outbox[oi];
    var payload = item && item.payload ? item.payload : null;
    if (!payload) continue;
    var before = byKey.size;
    collectFromEntries(byKey, payload.entries, patientRows);
    if (byKey.size > before) sources.outbox += 1;
  }
}

function collectFromSnapshotRoom(rid, byKey, patientRows, sources) {
  var snap = storage.getLanRoomSnapshot(rid);
  if (!snap || !Array.isArray(snap.entries)) return;
  var snapBefore = byKey.size;
  collectFromEntries(byKey, snap.entries, patientRows);
  if (byKey.size > snapBefore) sources.snapshot = 1;
}

function collectFromUndoStack(byKey, patientRows, sources) {
  var undoPatients = readUndoStackPatients();
  for (var ui = 0; ui < undoPatients.length; ui += 1) {
    var beforeUndo = byKey.size;
    rememberPatientMonitoreo(byKey, undoPatients[ui]);
    if (byKey.size > beforeUndo) sources.undo += 1;
    patientRows.push(undoPatients[ui]);
  }
}

/**
 * Scan LAN outbox, room snapshot, undo stack for monitoreo payloads.
 * @param {string} roomId
 */
export function scanMonitoreoRecoveryCandidates(roomId) {
  var rid = String(roomId || '').trim();
  /** @type {Map<string, object>} */
  var byKey = new Map();
  /** @type {object[]} */
  var patientRows = [];
  var sources = { outbox: 0, snapshot: 0, undo: 0, keys: 0 };

  if (rid) {
    collectFromOutboxRoom(rid, byKey, patientRows, sources);
    collectFromSnapshotRoom(rid, byKey, patientRows, sources);
  }
  collectFromUndoStack(byKey, patientRows, sources);

  sources.keys = byKey.size;
  return { byKey: byKey, patientRows: patientRows, sources: sources };
}

function resolveMonitoreoForPatient(patient, byKey) {
  var idKey = patient && patient.id ? 'id:' + String(patient.id).trim() : '';
  var regKey = patient && patient.registro ? 'reg:' + String(patient.registro).trim() : '';
  var fromId = idKey ? byKey.get(idKey) : null;
  var fromReg = regKey ? byKey.get(regKey) : null;
  if (fromId && fromReg) return mergeMonitoreo(fromReg, fromId);
  return fromId || fromReg || null;
}

function findExistingPatient(patient) {
  var id = String(patient && patient.id || '').trim();
  var reg = String(patient && patient.registro || '').trim();
  if (id) {
    var byId = patients.find(function (p) {
      return p && String(p.id) === id;
    });
    if (byId) return byId;
  }
  if (reg) {
    return (
      patients.find(function (p) {
        return p && String(p.registro || '').trim() === reg;
      }) || null
    );
  }
  return null;
}

function shellFromCachedPatient(cached) {
  if (!cached || typeof cached !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(cached));
  } catch {
    return null;
  }
}

function shouldSkipReaddRow(row) {
  if (!row || !row.id || String(row.id).indexOf('demo-') === 0) return true;
  if (findExistingPatient(row)) return true;
  return historialCount(row.monitoreo) === 0;
}

/** @param {object} row @param {{ dryRun?: boolean }} opts */
function tryReaddCachedPatient(row, opts) {
  if (shouldSkipReaddRow(row)) return null;
  if (opts.dryRun) {
    return { id: row.id, nombre: row.nombre, readded: true, after: historialCount(row.monitoreo) };
  }
  var shell = shellFromCachedPatient(row);
  if (!shell) return null;
  ensureMonitoreo(shell);
  patients.unshift(shell);
  return { id: shell.id, nombre: shell.nombre, readded: true, after: historialCount(shell.monitoreo) };
}

/** @param {ReturnType<typeof scanMonitoreoRecoveryCandidates>} scan @param {{ dryRun?: boolean }} opts */
function readdMissingPatientsFromScan(scan, opts) {
  var readded = 0;
  var details = [];
  for (var ri = 0; ri < scan.patientRows.length; ri += 1) {
    var detail = tryReaddCachedPatient(scan.patientRows[ri], opts);
    if (!detail) continue;
    readded += 1;
    details.push(detail);
  }
  return { readded: readded, details: details };
}

/** @param {object} p @param {object} cached @param {{ dryRun?: boolean }} opts */
function mergeOnePatientMonitoreo(p, cached, opts) {
  ensureMonitoreo(p);
  var before = historialCount(p.monitoreo);
  if (opts.dryRun) {
    var mergedPreview = mergeMonitoreo(p.monitoreo, cached);
    var previewAfter = historialCount(mergedPreview);
    if (previewAfter <= before) return null;
    return { id: p.id, nombre: p.nombre, before: before, after: previewAfter };
  }
  mergePatientMonitoreoFromImported(p, { monitoreo: cached });
  var after = historialCount(p.monitoreo);
  if (after <= before) return null;
  return { id: p.id, nombre: p.nombre, before: before, after: after };
}

/** @param {Map<string, object>} byKey @param {{ dryRun?: boolean }} opts */
function mergeCachedIntoCensus(byKey, opts) {
  var restored = 0;
  var details = [];
  for (var i = 0; i < patients.length; i += 1) {
    var p = patients[i];
    if (!p) continue;
    var cached = resolveMonitoreoForPatient(p, byKey);
    if (!cached) continue;
    var detail = mergeOnePatientMonitoreo(p, cached, opts);
    if (!detail) continue;
    restored += 1;
    details.push(detail);
  }
  return { restored: restored, details: details };
}

/**
 * Merge cached monitoreo into live census.
 * @param {{ roomId?: string, dryRun?: boolean }} [opts]
 */
export function recoverMonitoreoFromLanCache(opts) {
  opts = opts || {};
  var scan = scanMonitoreoRecoveryCandidates(opts.roomId || '');
  if (!scan.byKey.size) {
    return { ok: false, reason: 'empty', restored: 0, readded: 0, sources: scan.sources };
  }

  var readdResult = readdMissingPatientsFromScan(scan, opts);
  var mergeResult = mergeCachedIntoCensus(scan.byKey, opts);
  var restored = mergeResult.restored;
  var readded = readdResult.readded;
  var details = readdResult.details.concat(mergeResult.details);

  if (!opts.dryRun && (restored > 0 || readded > 0)) {
    saveState({ immediate: true });
    scheduleLiveSyncPush();
  }

  return {
    ok: restored > 0 || readded > 0,
    restored: restored,
    readded: readded,
    sources: scan.sources,
    details: details,
  };
}
