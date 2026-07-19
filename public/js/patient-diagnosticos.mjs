import { mergeAccesosPatientFields } from './patient-accesos.mjs';

function normalizePlusSeparators(text) {
  return String(text || '')
    .replace(/[\uFF0B\u2795]/g, '+')
    .replace(/\s+\+\s+/g, ' + ');
}

/** @param {string} text @returns {string[]} */
export function parseDiagnosticosText(text) {
  var raw = normalizePlusSeparators(String(text || '').trim());
  if (!raw) return [];
  var parts = /\+/.test(raw) ? raw.split(/\s*\+\s*/) : raw.split(/\r?\n/);
  return parts
    .map(function (p) {
      return String(p || '')
        .trim()
        .replace(/^\d+\.\s*/, '')
        .toUpperCase();
    })
    .filter(Boolean);
}

/** @param {string[]} list @returns {string} */
export function formatDiagnosticosCopy(list) {
  return (list || [])
    .map(function (d, i) {
      return i + 1 + '. ' + String(d || '').trim();
    })
    .filter(function (line) {
      return line.length > 2;
    })
    .join('\n');
}

/** @param {Record<string, unknown>|null|undefined} patient */
export function ensurePatientDiagnosticos(patient) {
  if (!patient) return;
  if (!Array.isArray(patient.diagnosticosList)) patient.diagnosticosList = [];
  if (!patient.diagnosticosList.length && patient.diagnosticosText) {
    patient.diagnosticosList = parseDiagnosticosText(String(patient.diagnosticosText));
  }
  if (!patient.diagnosticosList.length) patient.diagnosticosList = [''];
  var normalized = patient.diagnosticosList.map(function (d) {
    return String(d || '').trim().toUpperCase();
  });
  patient.diagnosticosList = normalized;
  var nonEmpty = normalized.filter(Boolean);
  patient.diagnosticosText = formatDiagnosticosCopy(nonEmpty);
}

/** Máximo de diagnósticos exportados al censo (los primeros N de la lista). */
export const CENSO_MAX_DIAGNOSTICOS = 3;

/** @param {string[]} list @param {{ max?: number }} [options] */
export function diagnosticosTextForCenso(list, options) {
  var max =
    options && options.max != null ? options.max : CENSO_MAX_DIAGNOSTICOS;
  return (list || [])
    .map(function (d) {
      return String(d || '').trim().toUpperCase();
    })
    .filter(Boolean)
    .slice(0, max)
    .join(' + ');
}

/**
 * @param {Record<string, unknown>} patient
 * @param {Record<string, unknown>|null|undefined} vpoState
 */
export function migratePatientDiagnosticosFromVpo(patient, vpoState) {
  if (!patient || !vpoState) return false;
  var has = (patient.diagnosticosList || []).some(function (d) {
    return String(d).trim();
  });
  if (has) return false;
  var from = (vpoState.diagnosticosList || []).filter(function (d) {
    return String(d).trim();
  });
  if (!from.length) return false;
  patient.diagnosticosList = from
    .map(function (d) {
      return String(d).trim().toUpperCase();
    })
    .concat(['']);
  ensurePatientDiagnosticos(patient);
  return true;
}

/**
 * @param {Record<string, unknown>} patient
 * @param {string[]} list
 */
export function applyPatientDiagnosticosList(patient, list) {
  patient.diagnosticosList = list;
  ensurePatientDiagnosticos(patient);
}

/** @param {{ diagnosticos?: string[] }} note @param {Record<string, unknown>} patient */
export function preloadNoteDxFromPatient(note, patient) {
  if (!note || !patient) return false;
  var dx = note.diagnosticos || [];
  var empty = !dx.some(function (d) {
    return String(d).trim();
  });
  if (!empty) return false;
  ensurePatientDiagnosticos(patient);
  var from = (patient.diagnosticosList || []).filter(function (d) {
    return String(d).trim();
  });
  if (!from.length) return false;
  note.diagnosticos = from.slice();
  return true;
}

/** @param {Record<string, unknown>} target @param {Record<string, unknown>|undefined} source */
export function mergeCensoPatientFields(target, source) {
  if (!target || !source) return;
  mergeAccesosPatientFields(target, source);
  if (source.censoMedsText) target.censoMedsText = source.censoMedsText;
  if (Array.isArray(source.diagnosticosList) && source.diagnosticosList.length) {
    target.diagnosticosList = source.diagnosticosList;
    if (source.diagnosticosText) target.diagnosticosText = source.diagnosticosText;
    else ensurePatientDiagnosticos(target);
  }
}

export function pushDiagnosticosToPatient(patient, list) {
  if (!patient) return;
  var cleaned = (list || [])
    .map(function (d) {
      return String(d || '').trim().toUpperCase();
    })
    .filter(Boolean);
  applyPatientDiagnosticosList(patient, cleaned.length ? cleaned.concat(['']) : ['']);
}
