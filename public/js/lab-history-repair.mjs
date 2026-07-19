/** Reparación ligera de historial de labs sin comparar JSON completo por paciente. */

import { normalizeLabHistoryPatientSets, isMeaningfulLabHistorySet } from './storage.js';

export function patientLabHistoryNeedsRepair(raw) {
  if (raw == null) return false;
  if (!Array.isArray(raw)) return true;
  var usedIds = [];
  for (var i = 0; i < raw.length; i++) {
    var set = raw[i];
    if (!isMeaningfulLabHistorySet(set)) return true;
    if (!set || typeof set !== 'object') return true;
    var id = set.id != null ? String(set.id).trim() : '';
    if (!id) return true;
    if (usedIds.indexOf(id) !== -1) return true;
    usedIds.push(id);
  }
  return false;
}

/**
 * @param {Record<string, unknown>} labHistoryMap
 * @returns {boolean} true si hubo cambios en memoria
 */
export function repairLabHistoryMapInPlace(labHistoryMap) {
  var changed = false;
  Object.keys(labHistoryMap || {}).forEach(function (pid) {
    var raw = labHistoryMap[pid];
    if (!patientLabHistoryNeedsRepair(raw)) return;
    var fixed = normalizeLabHistoryPatientSets(raw);
    if (fixed.length) labHistoryMap[pid] = fixed;
    else delete labHistoryMap[pid];
    changed = true;
  });
  return changed;
}
