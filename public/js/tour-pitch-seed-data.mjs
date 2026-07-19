import { storage } from './storage.js';
import { seedPitchDemoTodos } from './tour-pitch-demo-todos.mjs';
import { PITCH_DEMO_PATIENT_ID, capturePitchSandbox, setPitchPatientIsolation } from './tour-pitch-sandbox.mjs';
import { buildPitchDemoPatient, fillPitchDemoClinicalMaps } from './tour-pitch-seed-maps.mjs';

/** @param {string} fecha */
export function savePitchDemoAgenda(fecha) {
  const existingAgenda = storage.getScheduledProcedures().filter(function (ev) {
    return ev.patientId !== PITCH_DEMO_PATIENT_ID;
  });
  storage.saveScheduledProcedures(
    existingAgenda.concat([
      {
        id: 'pitch-agenda-1',
        patientId: PITCH_DEMO_PATIENT_ID,
        procedure: 'Catéter peritoneal — revisión',
        location: 'Quirófano menor',
        date: fecha,
        time: '10:30',
        notes: 'Demo pitch',
      },
      {
        id: 'pitch-agenda-2',
        patientId: PITCH_DEMO_PATIENT_ID,
        procedure: 'BH + QS control',
        location: 'Laboratorio',
        date: fecha,
        time: '06:00',
        notes: 'Demo pitch',
      },
    ])
  );
}

/**
 * @param {Record<string, unknown>} state
 * @param {Date} today
 * @param {string} fecha
 * @param {string} hora
 */
export function applyPitchDemoClinicalSeed(state, today, fecha, hora) {
  const {
    notes,
    indicaciones,
    labHistory,
    listadoProblemas,
    medRecetaByPatient,
    medNotaSelectionByPatient,
    recetaHuByPatient,
    patients,
    setPatients,
    saveState,
    selectPatient,
    renderPatientList,
  } = state;

  fillPitchDemoClinicalMaps(
    {
      notes,
      indicaciones,
      labHistory,
      listadoProblemas,
      medRecetaByPatient,
      medNotaSelectionByPatient,
      recetaHuByPatient,
    },
    fecha,
    hora
  );
  savePitchDemoAgenda(fecha);
  capturePitchSandbox(patients);
  setPitchPatientIsolation(true);
  setPatients([buildPitchDemoPatient(today)]);
  seedPitchDemoTodos();
  saveState();
  renderPatientList();
  selectPatient(PITCH_DEMO_PATIENT_ID);
}
