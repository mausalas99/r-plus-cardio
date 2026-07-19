/** In-memory backup snapshot and full payload persistence. */
import { storage } from '../../../storage.js';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  listadoProblemas,
  replaceAppStateFromBackupData,
  saveState,
} from '../../../app-state.mjs';
import { GUIDED_TOUR_LS_KEY } from '../../settings-help/tour-state.mjs';
import { getPlatformRuntime } from '../runtime.mjs';

const rt = getPlatformRuntime();

/** Snapshot for backup export — uses in-memory app state (what is on screen), not stale localStorage. */
function buildBackupDataFromMemory() {
  var filteredPatients = patients.filter(function (p) {
    return p && !p.isDemo;
  });
  var notesPersist = {};
  Object.keys(notes || {}).forEach(function (k) {
    if (notes[k] && !String(k).startsWith('demo-')) notesPersist[k] = notes[k];
  });
  var indPersist = {};
  Object.keys(indicaciones || {}).forEach(function (k) {
    if (indicaciones[k] && !String(k).startsWith('demo-')) indPersist[k] = indicaciones[k];
  });
  var lhPersist = {};
  Object.keys(labHistory || {}).forEach(function (k) {
    if (!String(k).startsWith('demo-')) lhPersist[k] = labHistory[k];
  });
  var medPersist = {};
  Object.keys(medRecetaByPatient || {}).forEach(function (k) {
    if (!String(k).startsWith('demo-')) medPersist[k] = medRecetaByPatient[k];
  });
  var medPharmPersist = {};
  Object.keys(medPharmProfileByPatient || {}).forEach(function (k) {
    if (!String(k).startsWith('demo-')) medPharmPersist[k] = medPharmProfileByPatient[k];
  });
  var listPersist = {};
  Object.keys(listadoProblemas || {}).forEach(function (k) {
    if (listadoProblemas[k] && !String(k).startsWith('demo-')) listPersist[k] = listadoProblemas[k];
  });
  var settings = rt.getSettings();
  if (!settings || typeof settings !== 'object' || !Object.keys(settings).length) {
    settings = storage.getSettings();
  }
  return {
    patients: filteredPatients,
    notes: notesPersist,
    indicaciones: indPersist,
    labHistory: lhPersist,
    medRecetaByPatient: medPersist,
    medPharmProfileByPatient: medPharmPersist,
    listadoProblemas: listPersist,
    scheduledProcedures: storage.getScheduledProcedures(),
    settings: settings,
    medCatalog: storage.getMedCatalog(),
  };
}

function buildFullBackupPayload() {
  return {
    format: 'r-plus-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: window.__RPC_APP_VERSION__ || null,
    theme: localStorage.getItem('theme') || 'light',
    guidedTourDoneForVersion: localStorage.getItem(GUIDED_TOUR_LS_KEY),
    data: buildBackupDataFromMemory(),
  };
}

async function persistFullBackupPayload(payload) {
  if (!payload || !payload.data) throw new Error('invalid-backup');
  replaceAppStateFromBackupData(payload.data);
  try {
    localStorage.setItem(
      'rpc-scheduled-procedures',
      JSON.stringify(
        Array.isArray(payload.data.scheduledProcedures) ? payload.data.scheduledProcedures : []
      )
    );
  } catch (_e) { void _e; }
  localStorage.setItem('rpc-settings', JSON.stringify(payload.data.settings || {}));
  if (payload.data.medCatalog && typeof payload.data.medCatalog === 'object') {
    storage.saveMedCatalog(payload.data.medCatalog);
  }
  if (payload.theme === 'dark' || payload.theme === 'light') {
    localStorage.setItem('theme', payload.theme);
  }
  if (payload.guidedTourDoneForVersion) {
    localStorage.setItem(GUIDED_TOUR_LS_KEY, payload.guidedTourDoneForVersion);
  } else {
    localStorage.removeItem(GUIDED_TOUR_LS_KEY);
  }
  var result = await saveState({ immediate: true });
  if (!result || !result.ok) {
    throw new Error((result && result.code) || 'SAVE_FAILED');
  }
  return result;
}

export { buildBackupDataFromMemory, buildFullBackupPayload, persistFullBackupPayload };
