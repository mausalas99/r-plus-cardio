/**
 * Exportación estática de DEMO PÉREZ (modo presentación) a JSON importable en R+.
 */
import { buildTourDemoListadoProblemas } from './tour-demo-listado-problemas.mjs';
import {
  PITCH_DEMO_PATIENT_ID,
} from './tour-pitch-demo-seed.mjs';
import { buildPitchDemoTodosForPatient } from './tour-pitch-demo-todos.mjs';

/** Fecha fija para JSON reproducibles (alineada con labs demo de mayo 2026). */
export const PITCH_DEMO_EXPORT_REF = new Date('2026-05-10T12:00:00');

function formatFechaHora(ref) {
  const d = ref instanceof Date ? ref : PITCH_DEMO_EXPORT_REF;
  const fecha =
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear();
  const hora =
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return { fecha, hora };
}

import { buildDemoPerez } from './pitch-demo-export-perez.mjs';

/**
 * @param {{ refDate?: Date, appVersion?: string|null }} [opts]
 */
export function buildPitchDemoPatientExport(opts) {
  const ref = opts && opts.refDate instanceof Date ? opts.refDate : PITCH_DEMO_EXPORT_REF;
  const snap = buildDemoPerez(ref, PITCH_DEMO_EXPORT_REF);
  const patient = Object.assign({}, snap.patient);
  delete patient.isDemo;

  return {
    format: 'r-plus-patient-export',
    version: 1,
    exportedAt: ref.toISOString(),
    appVersion: opts && opts.appVersion != null ? opts.appVersion : null,
    patient,
    note: snap.note || null,
    indicaciones: snap.indicaciones || null,
    labHistory: snap.labHistory || [],
    medReceta: snap.medReceta || null,
  };
}

/** Misma forma que buildPatientEntry (import por rango / herramientas). */
export function buildPitchDemoPatientEntry(opts) {
  const ref = opts && opts.refDate instanceof Date ? opts.refDate : PITCH_DEMO_EXPORT_REF;
  const { fecha, hora } = formatFechaHora(ref);
  const payload = buildPitchDemoPatientExport(opts);
  return {
    patient: payload.patient,
    note: payload.note || {},
    indicaciones: payload.indicaciones || {},
    labHistory: payload.labHistory || [],
    medReceta: payload.medReceta || null,
    listadoProblemas: buildTourDemoListadoProblemas(fecha, hora),
    todos: buildPitchDemoTodosForPatient(PITCH_DEMO_PATIENT_ID),
  };
}

export function buildPitchDemoBundleExport(opts) {
  const ref = opts && opts.refDate instanceof Date ? opts.refDate : PITCH_DEMO_EXPORT_REF;
  const payload = buildPitchDemoPatientExport(opts);
  return {
    format: 'r-plus-pitch-demo-bundle',
    version: 1,
    exportedAt: ref.toISOString(),
    appVersion: opts && opts.appVersion != null ? opts.appVersion : null,
    patients: [payload],
  };
}
