/**
 * Clear per-patient local state maps on delete.
 */
import {
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  vpoByPatient,
  recetaHuByPatient,
  listadoProblemas,
  medNotaSelectionByPatient,
} from '../../app-state.mjs';
import { storage } from '../../storage.js';

const PATIENT_STATE_MAPS = [
  () => notes,
  () => indicaciones,
  () => labHistory,
  () => medRecetaByPatient,
  () => medPharmProfileByPatient,
  () => vpoByPatient,
  () => recetaHuByPatient,
  () => medNotaSelectionByPatient,
  () => listadoProblemas,
];

/** @param {string} pid */
export function clearPatientLocalStateMaps(pid) {
  for (const getMap of PATIENT_STATE_MAPS) {
    const map = getMap();
    if (map && map[pid]) delete map[pid];
  }
}

/** @param {string} pid */
export function clearPatientTodosLocal(pid) {
  try {
    const rawTodosMap = localStorage.getItem('rpc-todos');
    if (!rawTodosMap) return;
    const todosMap = JSON.parse(rawTodosMap);
    if (todosMap && typeof todosMap === 'object' && todosMap[pid]) {
      delete todosMap[pid];
      localStorage.setItem('rpc-todos', JSON.stringify(todosMap));
    }
  } catch { /* ignored */ }
}

/** @param {string} pid */
export function clearPatientAgendaLocal(pid) {
  try {
    if (storage.removeScheduledProceduresForPatient) storage.removeScheduledProceduresForPatient(pid);
  } catch { /* ignored */ }
}
