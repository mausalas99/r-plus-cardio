import {
  PITCH_DEMO_PATIENT_ID,
  PITCH_DEMO_PATIENT_ID_LEGACY,
} from './tour-pitch-sandbox.mjs';

/** @param {Record<string, unknown>} maps */
export function deletePitchDemoPatientMaps(maps) {
  const {
    notes,
    indicaciones,
    labHistory,
    listadoProblemas,
    medRecetaByPatient,
    medNotaSelectionByPatient,
    recetaHuByPatient,
  } = maps;
  delete notes[PITCH_DEMO_PATIENT_ID];
  delete notes[PITCH_DEMO_PATIENT_ID_LEGACY];
  delete indicaciones[PITCH_DEMO_PATIENT_ID];
  delete indicaciones[PITCH_DEMO_PATIENT_ID_LEGACY];
  delete labHistory[PITCH_DEMO_PATIENT_ID];
  delete labHistory[PITCH_DEMO_PATIENT_ID_LEGACY];
  delete listadoProblemas[PITCH_DEMO_PATIENT_ID];
  delete medRecetaByPatient[PITCH_DEMO_PATIENT_ID];
  if (medNotaSelectionByPatient[PITCH_DEMO_PATIENT_ID]) {
    delete medNotaSelectionByPatient[PITCH_DEMO_PATIENT_ID];
  }
  delete recetaHuByPatient[PITCH_DEMO_PATIENT_ID];
}
