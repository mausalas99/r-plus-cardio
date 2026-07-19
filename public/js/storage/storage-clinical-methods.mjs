import { invalidateParsed, readClinicalBlob, readTodosMap, writeTodosMap, skipClinicalLocalPersist, safeParseArray, safeParseObject } from './storage-core.mjs';
import { normalizeLabHistoryPatientSets } from './storage-lab.mjs';
import { normalizeScheduledProcedureStored } from './storage-lab.mjs';
import {
  buildMedCatalogPayload,
  buildMedCatalogShape,
  normalizeTodoRow,
} from './storage-todo-normalize.mjs';

export const clinicalBlobStorageMethods = {
  getPatients() {
    return readClinicalBlob('patients', 'rpc-patients', safeParseArray);
  },

  /**
   * Get all notes from localStorage
   * @returns {Object} Object mapping patient IDs to note text
   */
  getNotes() {
    return readClinicalBlob('notes', 'rpc-notes', safeParseObject);
  },

  /**
   * Get all indicaciones from localStorage
   * @returns {Object} Object mapping patient IDs to indicaciones text
   */
  getIndicaciones() {
    return readClinicalBlob('indicaciones', 'rpc-indicaciones', safeParseObject);
  },

  /**
   * Get listado de problemas (v3.0) from localStorage
   * @returns {Object} Object mapping patient IDs to listado objects
   */
  getListadoProblemas() {
    return readClinicalBlob('listadoProblemas', 'rpc-listado-problemas', safeParseObject);
  },

  /**
   * Get lab history from localStorage
   * @returns {Object} Object mapping patient IDs to arrays of lab entries
   */
  getLabHistory() {
    var raw = readClinicalBlob('labHistory', 'rpc-labHistory', safeParseObject);
    var out = {};
    Object.keys(raw).forEach(function (k) {
      out[k] = normalizeLabHistoryPatientSets(raw[k]);
    });
    return out;
  },

  getMedRecetaByPatient() {
    return readClinicalBlob('medRecetaByPatient', 'rpc-medRecetaByPatient', safeParseObject);
  },

  getMedPharmProfileByPatient() {
    return readClinicalBlob('medPharmProfileByPatient', 'rpc-medPharmProfileByPatient', safeParseObject);
  },

  getVpoByPatient() {
    return readClinicalBlob('vpoByPatient', 'rpc-vpoByPatient', safeParseObject);
  },

  getRecetaHuByPatient() {
    return readClinicalBlob('recetaHuByPatient', 'rpc-recetaHuByPatient', safeParseObject);
  },

  /**
   * Get to-do list for a patient. Normaliza forma de cada todo.
   * @param {string} patientId
   * @returns {Array<{id:string,text:string,completed:boolean,priority:'alta'|'media'|'baja',createdAt:string,updatedAt:string,dueDate:string|null,reminderAt:string|null,createdBy:string|null,completedAt:string|null,completedBy:string|null,handoffAcknowledgedAt:string|null,handoffAcknowledgedBy:string|null}>}
   */
  getTodos(patientId) {
    const map = readClinicalBlob('todos', 'rpc-todos', safeParseObject);
    const raw = Array.isArray(map[patientId]) ? map[patientId] : [];
    return raw.map(function (t) {
      return normalizeTodoRow(t, '');
    });
  },

  /**
   * Save to-do list for a patient. Skips demo- patients.
   * @param {string} patientId
   * @param {Array} todos
   */
  saveTodos(patientId, todos) {
    if (typeof patientId !== 'string') return;
    if (patientId.indexOf('demo-') === 0) return;
    const map = readTodosMap();
    const now = new Date().toISOString();
    map[patientId] = (Array.isArray(todos) ? todos : []).map(function (t) {
      return normalizeTodoRow(t, now);
    });
    writeTodosMap(map);
  },

  /** Patient ids with at least one stored todo row (rpc-todos map keys). */
  listTodoPatientIds() {
    const map = readTodosMap();
    return Object.keys(map);
  },

  getLanRoomSnapshots() {
    return readClinicalBlob('lanRoomSnapshots', 'rpc-lan-room-snapshots', safeParseObject);
  },

  getLanRoomSnapshot(roomId) {
    const all = this.getLanRoomSnapshots();
    const row = all[String(roomId || '')];
    return row && typeof row === 'object' ? row : null;
  },

  saveLanRoomSnapshot(roomId, snapshot) {
    if (skipClinicalLocalPersist()) return;
    const rid = String(roomId || '');
    if (!rid) return;
    const all = this.getLanRoomSnapshots();
    all[rid] = snapshot && typeof snapshot === 'object' ? snapshot : {};
    localStorage.setItem('rpc-lan-room-snapshots', JSON.stringify(all));
    invalidateParsed('lanRoomSnapshots');
  },

  /**
   * Catálogo personalizado de medicamentos (acentos + tokens SOAP + categorías SOME perfil).
   * @returns {{ v: number, accents: Object, soapTokens: Object, somePharm: { tokens: Object } }}
   */
  getMedCatalog() {
    const o = readClinicalBlob('medCatalog', 'rpc-medCatalog', function (raw) {
      return safeParseObject(raw);
    });
    return buildMedCatalogShape(o);
  },

  /**
   * @param {{ accents?: Object, soapTokens?: Object }} catalog
   */
  saveMedCatalog(catalog) {
    if (skipClinicalLocalPersist()) return;
    const payload = buildMedCatalogPayload(catalog);
    localStorage.setItem('rpc-medCatalog', JSON.stringify(payload));
    invalidateParsed('medCatalog');
  },

  /**
   * Lista local de procedimientos agendados (spec agenda semanal v1).
   * @returns {Array<Object>}
   */
  getScheduledProcedures() {
    const raw = readClinicalBlob('scheduledProcedures', 'rpc-scheduled-procedures', safeParseArray);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < raw.length; i += 1) {
      const ev = normalizeScheduledProcedureStored(raw[i]);
      if (
        ev &&
        ev.patientId.indexOf('demo-') !== 0 &&
        !seen.has(ev.id)
      ) {
        seen.add(ev.id);
        out.push(ev);
      }
    }
    return out;
  },

  /**
   * @param {Array<Object>} events
   */
  saveScheduledProcedures(events) {
    if (skipClinicalLocalPersist()) return;
    const list = Array.isArray(events) ? events.map(normalizeScheduledProcedureStored).filter(Boolean) : [];
    const filtered = list.filter(ev => ev.patientId.indexOf('demo-') !== 0);
    localStorage.setItem('rpc-scheduled-procedures', JSON.stringify(filtered));
    invalidateParsed('scheduledProcedures');
  },

  /** Elimina en cascada eventos ligados al paciente. */
  removeScheduledProceduresForPatient(patientId) {
    if (typeof patientId !== 'string' || !patientId) return;
    const cur = this.getScheduledProcedures();
    const next = cur.filter(ev => ev.patientId !== patientId);
    if (next.length !== cur.length) this.saveScheduledProcedures(next);
  },
};
