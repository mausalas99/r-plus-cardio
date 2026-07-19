import { storage, ensureStorageHydrated } from './storage.js';
import { isWebClinicalClient } from './db-storage-bridge.mjs';
import { isSessionScopedWebClient } from './session-clinical-wipe.mjs';
import { applyMedCatalogOverlay } from './med-receta-core.mjs';
import { applySomePharmCatalogOverlay } from './med-pharm-some-catalog.mjs';
import { repairLabHistoryMapInPlace } from './lab-history-repair.mjs';
import { migratePatientMonitoreo } from './features/estado-actual-data.mjs';
import { migratePatientsClinicalSala } from './clinico-access.mjs';

export let patients = [];
export let notes = {};
export let indicaciones = {};
export let labHistory = {};
export let medRecetaByPatient = {};
export let medPharmProfileByPatient = {};
export let recetaHuByPatient = {};
export let listadoProblemas = {};
export let vpoByPatient = {};
export let medNotaSelectionByPatient = {};

let _beforeSave = null;
let _afterSave = null;
let _onSaveResult = null;
let _persistPatientsResolver = null;
let _saveTimer = null;
let _saveInFlight = null;
let _flushSaveQueued = false;
const SAVE_DEBOUNCE_MS = 400;

/**
 * Durante el tour pitch la lista en memoria son solo demos; al persistir se usa el respaldo real.
 * @param {(() => import('./app-state.mjs').patients | undefined) | null} fn
 */
export function setPersistPatientsResolver(fn) {
  _persistPatientsResolver = typeof fn === 'function' ? fn : null;
}

function patientsForPersistence() {
  if (_persistPatientsResolver) {
    const overridden = _persistPatientsResolver();
    if (Array.isArray(overridden) && overridden.length) return overridden;
    const filtered = patients.filter(function (p) {
      return p && p.id !== 'demo-pitch' && p.id !== 'demo-pitch-2' && !p.isDemo;
    });
    if (filtered.length) return filtered;
    const stored = storage.getPatients();
    if (Array.isArray(stored) && stored.length) return stored;
    return [];
  }
  return patients;
}

export function setPatients(next) {
  patients = next;
}

/** Safari/iPad: drop ward census from memory (PHI is session-only until LAN sync). */
export function clearWebSessionClinicalMemory() {
  if (!isWebClinicalClient()) return;
  setPatients([]);
  setNotes({});
  setIndicaciones({});
  setLabHistory({});
  setMedRecetaByPatient({});
  setMedPharmProfileByPatient({});
  setRecetaHuByPatient({});
  listadoProblemas = {};
  vpoByPatient = {};
  medNotaSelectionByPatient = {};
}

export function setNotes(next) {
  notes = next;
}

export function setIndicaciones(next) {
  indicaciones = next;
}

export function setLabHistory(next) {
  labHistory = next;
}

export function setMedRecetaByPatient(next) {
  medRecetaByPatient = next;
}

export function setMedPharmProfileByPatient(next) {
  medPharmProfileByPatient = next;
}

export function setVpoByPatient(next) {
  vpoByPatient = next;
}

export function setRecetaHuByPatient(next) {
  recetaHuByPatient = next;
}

function clonePlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

/** Sustituye pacientes y datos clínicos en memoria (importación de respaldo, deshacer). */
export function replaceAppStateFromBackupData(data) {
  if (!data || typeof data !== 'object') return;
  var nextPatients = Array.isArray(data.patients) ? data.patients : [];
  setPatients(
    nextPatients.filter(function (p) {
      return p && !p.isDemo;
    })
  );
  setNotes(clonePlainRecord(data.notes));
  setIndicaciones(clonePlainRecord(data.indicaciones));
  setLabHistory(clonePlainRecord(data.labHistory));
  setMedRecetaByPatient(clonePlainRecord(data.medRecetaByPatient));
  setMedPharmProfileByPatient(clonePlainRecord(data.medPharmProfileByPatient));
  listadoProblemas = clonePlainRecord(data.listadoProblemas);
  vpoByPatient = clonePlainRecord(data.vpoByPatient);
  medNotaSelectionByPatient = {};
}

export function setSaveStateHooks({ before, after, onSaveResult } = {}) {
  if (before !== undefined) _beforeSave = before;
  if (after !== undefined) _afterSave = after;
  if (onSaveResult !== undefined) _onSaveResult = onSaveResult;
}

export function repairLabHistoryInMemory() {
  return repairLabHistoryMapInPlace(labHistory);
}

/**
 * Hydrate SQLCipher blobs (when unlocked) then load module exports from storage getters.
 * @returns {Promise<void>}
 */
export async function bootHydrateFromDb() {
  await ensureStorageHydrated();
  initAppState();
}

export function initAppState() {
  if (isSessionScopedWebClient()) {
    clearWebSessionClinicalMemory();
  } else {
    setPatients(storage.getPatients());
    setNotes(storage.getNotes());
    setIndicaciones(storage.getIndicaciones());
    setLabHistory(storage.getLabHistory());
    setMedRecetaByPatient(storage.getMedRecetaByPatient());
    setMedPharmProfileByPatient(storage.getMedPharmProfileByPatient());
    setRecetaHuByPatient(storage.getRecetaHuByPatient());
    listadoProblemas = storage.getListadoProblemas();
    vpoByPatient = storage.getVpoByPatient();
  }
  var medCatalog = storage.getMedCatalog();
  applyMedCatalogOverlay(medCatalog);
  applySomePharmCatalogOverlay(medCatalog);
  medNotaSelectionByPatient = {};
  var monitoreoMigrated = false;
  for (var pi = 0; pi < patients.length; pi += 1) {
    if (migratePatientMonitoreo(patients[pi])) monitoreoMigrated = true;
  }
  var salaMigrated = 0;
  try {
    var rpcSettings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    var clinicalSala = String(rpcSettings.clinicalSala || '').trim();
    if (clinicalSala) {
      salaMigrated = migratePatientsClinicalSala(patients, { sala: clinicalSala });
    }
  } catch (_e) { void _e; }
  if (repairLabHistoryInMemory() || monitoreoMigrated || salaMigrated > 0) {
    saveState({ immediate: true });
  }
}

function notifySaveResult(result) {
  if (_onSaveResult && result) _onSaveResult(result);
}

function runSaveNow() {
  if (_beforeSave) _beforeSave();
  var promise = storage.saveAll(
    patientsForPersistence(),
    notes,
    indicaciones,
    labHistory,
    medRecetaByPatient,
    listadoProblemas,
    recetaHuByPatient,
    vpoByPatient,
    medPharmProfileByPatient
  );
  _saveInFlight = promise;
  return promise
    .then(function (result) {
      notifySaveResult(result);
      if (_afterSave) _afterSave();
      return result;
    })
    .finally(function () {
      if (_saveInFlight === promise) _saveInFlight = null;
    });
}

/**
 * @param {{ immediate?: boolean }} [opts] — immediate: true salta el debounce (cierre de app, import, etc.)
 */
export function saveState(opts) {
  var immediate = !!(opts && opts.immediate);
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (immediate) {
    return runSaveNow();
  }
  return new Promise(function (resolve) {
    _saveTimer = setTimeout(function () {
      _saveTimer = null;
      runSaveNow().then(resolve);
    }, SAVE_DEBOUNCE_MS);
  });
}

/** Persiste de inmediato cualquier guardado pendiente (p. ej. antes de cerrar la app). */
export function flushSaveState() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (_saveInFlight) {
    _flushSaveQueued = true;
    return _saveInFlight.then(function () {
      if (_flushSaveQueued) {
        _flushSaveQueued = false;
        return runSaveNow();
      }
    });
  }
  _flushSaveQueued = false;
  return runSaveNow();
}
