import { DEMO_TOUR_LAB_PASTE } from './tour-demo-some-lab.mjs';
import { storage } from './storage.js';
import { clearPitchDemoTodos } from './tour-pitch-demo-todos.mjs';
import {
  PITCH_DEMO_PATIENT_ID,
  PITCH_DEMO_PATIENT_ID_LEGACY,
  setPitchPatientIsolation,
  readPitchSandboxBackup,
  clearPitchSandboxBackup,
  markPitchTourSessionActive,
  clearPitchPatientsBackup,
} from './tour-pitch-sandbox.mjs';
import { deletePitchDemoPatientMaps } from './tour-pitch-clear-maps.mjs';
import { resolvePitchDemoRestorePatients } from './tour-pitch-restore.mjs';
import { applyPitchDemoClinicalSeed } from './tour-pitch-seed-data.mjs';

/** @param {Record<string, unknown>} state */
export function seedPitchDemo(state) {
  const today = new Date();
  const fecha =
    String(today.getDate()).padStart(2, '0') +
    '/' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '/' +
    today.getFullYear();
  const hora =
    String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');
  applyPitchDemoClinicalSeed(state, today, fecha, hora);
  return { labPasteText: DEMO_TOUR_LAB_PASTE };
}

/** @param {Record<string, unknown>} state */
export function clearPitchDemo(state) {
  const {
    notes,
    indicaciones,
    labHistory,
    listadoProblemas,
    medRecetaByPatient,
    medNotaSelectionByPatient,
    recetaHuByPatient,
    saveState,
    renderPatientList,
    getActiveId,
    setActiveId,
    patients,
  } = state;

  setPitchPatientIsolation(false);
  resolvePitchDemoRestorePatients(state);
  clearPitchPatientsBackup();

  const sandbox = readPitchSandboxBackup();
  if (sandbox && Array.isArray(sandbox.scheduledProcedures)) {
    storage.saveScheduledProcedures(sandbox.scheduledProcedures);
  }
  clearPitchSandboxBackup();
  markPitchTourSessionActive(false);
  deletePitchDemoPatientMaps({
    notes,
    indicaciones,
    labHistory,
    listadoProblemas,
    medRecetaByPatient,
    medNotaSelectionByPatient,
    recetaHuByPatient,
  });

  const agenda = storage.getScheduledProcedures().filter(function (ev) {
    return ev.patientId !== PITCH_DEMO_PATIENT_ID;
  });
  storage.saveScheduledProcedures(agenda);
  clearPitchDemoTodos();

  if (getActiveId() === PITCH_DEMO_PATIENT_ID || getActiveId() === PITCH_DEMO_PATIENT_ID_LEGACY) {
    setActiveId(patients.length ? patients[0].id : null);
  }
  saveState();
  renderPatientList();
}
