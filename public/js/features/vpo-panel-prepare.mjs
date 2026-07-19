import { ensurePatientDiagnosticos } from '../patient-diagnosticos.mjs';
import {
  ensureDuracionKey,
  ensureDiagnosticosList,
  setDiagnosticosList,
  autofillVitalsFromMonitoreoIfEmpty,
} from '../vpo-data.mjs';

/** @param {object} state @param {object|null} patient */
export function seedVpoDxFromPatientIfEmpty(state, patient) {
  if (!patient || state.diagnosticosTouched) return;
  const empty = !(state.diagnosticosList || []).some((d) => String(d).trim());
  if (!empty) return;
  ensurePatientDiagnosticos(patient);
  const fromPat = (patient.diagnosticosList || []).filter((d) => String(d).trim());
  if (fromPat.length) setDiagnosticosList(state, fromPat.concat(['']));
}

/** @param {object} state @param {object|null} patient */
export function prepareVpoStateBasics(state, patient) {
  if (!state.edad && patient?.edad) {
    const m = String(patient.edad).match(/(\d+)/);
    if (m) state.edad = m[1];
  }
  ensureDuracionKey(state);
  ensureDiagnosticosList(state);
  seedVpoDxFromPatientIfEmpty(state, patient);
  autofillVitalsFromMonitoreoIfEmpty(state, patient);
}
