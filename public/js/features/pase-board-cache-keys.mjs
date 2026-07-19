/**
 * Pase board summary cache key (invalidation).
 */
import { storage } from '../storage.js';
import { medRecetaByPatient } from '../app-state.mjs';
import { getLabHistoryRevision } from '../lab-history-cache.mjs';

var _paseBoardCacheKey = '';

export function invalidatePaseBoardCache() {
  _paseBoardCacheKey = '';
}

export function buildPaseBoardCacheKey(pid) {
  var todos = storage.getTodos(pid);
  var done = 0;
  for (var i = 0; i < todos.length; i += 1) {
    if (todos[i].completed) done += 1;
  }
  var med = (medRecetaByPatient[pid] && medRecetaByPatient[pid].items) || [];
  var ag = getPaseAgendaForPatient(pid);
  return (
    String(pid) +
    '|L' +
    getLabHistoryRevision(pid) +
    '|T' +
    todos.length +
    ':' +
    done +
    '|M' +
    med.length +
    '|A' +
    ag.length
  );
}

export function getPaseBoardCacheKey() {
  return _paseBoardCacheKey;
}

export function setPaseBoardCacheKey(key) {
  _paseBoardCacheKey = key;
}

function getPaseAgendaForPatient(patientId) {
  var cutoff = Date.now() - 3600000;
  return storage
    .getScheduledProcedures()
    .filter(function (ev) {
      return String(ev.patientId) === String(patientId);
    })
    .filter(function (ev) {
      var t = Date.parse(ev.start);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort(function (a, b) {
      return Date.parse(a.start) - Date.parse(b.start);
    })
    .slice(0, 12);
}
