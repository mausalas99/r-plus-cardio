import { emptyFantasticos } from './med-segments.mjs';

/** @returns {Record<string, unknown>} */
export function emptyCardio() {
  return {
    inicioDescongestion: '',
    overrides: {},
    pocusByDay: [],
    fantasticos: emptyFantasticos(),
    medSegments: [],
    diureticSegments: [],
    medCatalog: [],
  };
}

/**
 * Ensure `patient.cardio` exists with IC persistence defaults.
 * Fills missing top-level keys without wiping existing data.
 * @param {unknown} patient
 * @returns {unknown}
 */
export function ensureCardio(patient) {
  if (!patient || typeof patient !== 'object') return patient;
  /** @type {any} */
  var p = patient;
  if (!p.cardio || typeof p.cardio !== 'object') {
    p.cardio = emptyCardio();
    return p;
  }
  var defaults = emptyCardio();
  if (typeof p.cardio.inicioDescongestion !== 'string') {
    p.cardio.inicioDescongestion = defaults.inicioDescongestion;
  }
  if (!p.cardio.overrides || typeof p.cardio.overrides !== 'object') {
    p.cardio.overrides = defaults.overrides;
  }
  if (!Array.isArray(p.cardio.pocusByDay)) {
    p.cardio.pocusByDay = defaults.pocusByDay;
  }
  if (!Array.isArray(p.cardio.fantasticos)) {
    p.cardio.fantasticos = defaults.fantasticos;
  }
  if (!Array.isArray(p.cardio.medSegments)) {
    p.cardio.medSegments = defaults.medSegments;
  }
  if (!Array.isArray(p.cardio.diureticSegments)) {
    p.cardio.diureticSegments = defaults.diureticSegments;
  }
  if (!Array.isArray(p.cardio.medCatalog)) {
    p.cardio.medCatalog = defaults.medCatalog;
  }
  return p;
}
