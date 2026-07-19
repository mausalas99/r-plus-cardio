/** Validación y normalización de JSON de exportación de paciente (import Ajustes). */

import { resolvePatientImportPayloads } from './patient-export-payloads.mjs';

export const PATIENT_EXPORT_FORMAT = 'r-plus-patient-export';
export const PATIENT_EXPORT_VERSION = 1;
export const DEMO_BUNDLE_FORMAT = 'r-plus-pitch-demo-bundle';
const RANGE_EXPORT_FORMAT = 'r-plus-range-export';

export { resolvePatientImportPayloads };

/**
 * @param {string} text
 */
export function stripJsonBom(text) {
  const s = String(text == null ? '' : text);
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

/**
 * @param {Record<string, unknown>} entry
 */
export function entryToPatientExportPayload(entry) {
  if (!entry || typeof entry !== 'object' || !entry.patient || typeof entry.patient !== 'object') {
    return null;
  }
  if (Array.isArray(entry.patient)) return null;
  return {
    format: PATIENT_EXPORT_FORMAT,
    version: PATIENT_EXPORT_VERSION,
    exportedAt: typeof entry.exportedAt === 'string' ? entry.exportedAt : new Date().toISOString(),
    appVersion: entry.appVersion != null ? entry.appVersion : null,
    patient: entry.patient,
    note: entry.note != null ? entry.note : null,
    indicaciones: entry.indicaciones != null ? entry.indicaciones : null,
    labHistory: Array.isArray(entry.labHistory) ? entry.labHistory : [],
    medReceta: entry.medReceta != null ? entry.medReceta : null,
  };
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function isRPlusPatientExportPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (p.format !== PATIENT_EXPORT_FORMAT) return false;
  if (Number(p.version) !== PATIENT_EXPORT_VERSION) return false;
  if (!p.patient || typeof p.patient !== 'object' || Array.isArray(p.patient)) return false;
  return true;
}

/**
 * @param {string} text
 * @returns {{ parsed: unknown, payloads: Array<Record<string, unknown>> }}
 */
export function parsePatientImportJsonText(text) {
  const trimmed = stripJsonBom(text).trim();
  const parsed = JSON.parse(trimmed);
  return { parsed, payloads: resolvePatientImportPayloads(parsed) };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function describePatientImportRejection(raw) {
  if (raw == null) {
    return 'El archivo está vacío o no es JSON.';
  }
  if (typeof raw !== 'object') {
    return 'El archivo no contiene un objeto JSON válido.';
  }
  if (Array.isArray(raw)) {
    return 'Es una lista JSON; usa un solo objeto de exportación o el bundle demo.';
  }
  const root = /** @type {Record<string, unknown>} */ (raw);
  const format = String(root.format || '(sin format)');
  if (format === DEMO_BUNDLE_FORMAT) {
    const n = Array.isArray(root.patients) ? root.patients.length : 0;
    if (!n) return 'Bundle demo sin pacientes en el arreglo "patients".';
    return 'Bundle demo: actualiza R+ (npm run build:ui) o usa demo-perez.json.';
  }
  if (format === 'r-plus-backup') {
    return 'Es un respaldo completo. Usa «Importar copia de seguridad…», no «Importar paciente…».';
  }
  if (format === 'r-plus-purge-ghosts-backup') {
    return 'Es un respaldo de fantasmas (formato anterior). Usa «Importar copia de seguridad…».';
  }
  if (format === RANGE_EXPORT_FORMAT) {
    return 'Es export por rango: también puedes usar «Importar paciente…» (versión reciente) o «Importar rango…».';
  }
  if (!root.format && root.patient) {
    return 'Tiene "patient" pero falta format; vuelve a generar con npm run export:demo-patients.';
  }
  return (
    'Se esperaba format "' +
    PATIENT_EXPORT_FORMAT +
    '" v' +
    PATIENT_EXPORT_VERSION +
    ' con patient; se encontró "' +
    format +
    '".'
  );
}
