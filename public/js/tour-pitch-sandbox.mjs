/**
 * Seed y cleanup del paciente demo-pitch para el tour de presentación.
 */
import { storage } from './storage.js';

export const PITCH_DEMO_PATIENT_ID = 'demo-pitch';
/** Solo limpieza si quedó de versiones anteriores. */
export const PITCH_DEMO_PATIENT_ID_LEGACY = 'demo-pitch-2';

const PITCH_SANDBOX_SS_KEY = 'rpc-pitch-tour-sandbox-v1';
export const PITCH_TOUR_ACTIVE_SS_KEY = 'rpc-pitch-tour-active';

/** @type {typeof import('./app-state.mjs').patients | null} */
let pitchPatientsBackup = null;

export function readPitchSandboxBackup() {
  try {
    const raw = sessionStorage.getItem(PITCH_SANDBOX_SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writePitchSandboxBackup(data) {
  try {
    sessionStorage.setItem(PITCH_SANDBOX_SS_KEY, JSON.stringify(data));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function clearPitchSandboxBackup() {
  try {
    sessionStorage.removeItem(PITCH_SANDBOX_SS_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function markPitchTourSessionActive(active) {
  try {
    if (active) sessionStorage.setItem(PITCH_TOUR_ACTIVE_SS_KEY, '1');
    else sessionStorage.removeItem(PITCH_TOUR_ACTIVE_SS_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function capturePitchSandbox(currentPatients) {
  if (!pitchPatientsBackup) {
    pitchPatientsBackup = currentPatients.slice();
  }
  const existing = readPitchSandboxBackup();
  if (existing && Array.isArray(existing.patients) && existing.patients.length) return;
  writePitchSandboxBackup({
    patients: pitchPatientsBackup,
    scheduledProcedures: storage.getScheduledProcedures().slice(),
    capturedAt: Date.now(),
  });
}

export function restorePitchPatientsBackup() {
  if (pitchPatientsBackup && pitchPatientsBackup.length) {
    return pitchPatientsBackup.slice();
  }
  const sandbox = readPitchSandboxBackup();
  if (sandbox && Array.isArray(sandbox.patients) && sandbox.patients.length) {
    return sandbox.patients.slice();
  }
  return null;
}

/** Lista real para saveState mientras el pitch aísla la UI a demos. */
export function clearPitchPatientsBackup() {
  pitchPatientsBackup = null;
}

export function resolvePitchPersistPatients() {
  if (!pitchPatientIsolation) return undefined;
  const restored = restorePitchPatientsBackup();
  return restored && restored.length ? restored : undefined;
}

/**
 * Si el tour dejó solo demos o lista vacía en disco, restaura desde sessionStorage.
 * @param {object} state — mismo shape que clearPitchDemo
 */
export function tryRecoverPatientsFromPitchSandboxIfNeeded(state) {
  const { patients, setPatients, saveState } = state;
  const sandbox = readPitchSandboxBackup();
  if (!sandbox || !Array.isArray(sandbox.patients) || !sandbox.patients.length) return false;
  const onlyDemos =
    patients.length > 0 &&
    patients.every(function (p) {
      return p && isPitchDemoPatientId(p.id);
    });
  const empty = patients.length === 0;
  if (!onlyDemos && !empty) return false;
  setPatients(sandbox.patients.slice());
  if (Array.isArray(sandbox.scheduledProcedures)) {
    storage.saveScheduledProcedures(sandbox.scheduledProcedures);
  }
  clearPitchSandboxBackup();
  markPitchTourSessionActive(false);
  setPitchPatientIsolation(false);
  pitchPatientsBackup = null;
  saveState({ immediate: true });
  return true;
}

/** Mientras el pitch está activo, la UI solo muestra pacientes demo. */
let pitchPatientIsolation = false;

export function setPitchPatientIsolation(active) {
  pitchPatientIsolation = !!active;
}

export function isPitchPatientIsolationActive() {
  return pitchPatientIsolation;
}

export function isPitchDemoPatientId(patientId) {
  return patientId === PITCH_DEMO_PATIENT_ID || patientId === PITCH_DEMO_PATIENT_ID_LEGACY;
}

/** @param {Array<{ id?: string }>} list */
export function filterPatientsForPitchTour(list) {
  if (!pitchPatientIsolation) return list;
  return (list || []).filter(function (p) {
    return p && p.id === PITCH_DEMO_PATIENT_ID;
  });
}
