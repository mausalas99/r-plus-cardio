/** Build multi-patient export payload (same format as rango → importable both ways). */
import { buildPatientEntry } from '../../patients.mjs';

/**
 * @param {string[]} patientIds
 * @returns {{ format: string, version: number, exportedAt: string, from: string, to: string, entries: object[] }}
 */
export function buildPatientsSelectionExportPayload(patientIds) {
  var entries = [];
  for (var i = 0; i < patientIds.length; i += 1) {
    var entry = buildPatientEntry(patientIds[i]);
    if (entry) entries.push(entry);
  }
  var n = entries.length;
  return {
    format: 'r-plus-range-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    from: 'Selección manual',
    to: n + ' paciente' + (n === 1 ? '' : 's'),
    entries: entries,
  };
}

/**
 * @param {Array<{ id: string }>} list
 */
export function sortPatientsForExportPicker(list) {
  return list.slice().sort(function (a, b) {
    var ca = String(a.cuarto || '');
    var cb = String(b.cuarto || '');
    if (ca !== cb) return ca.localeCompare(cb, 'es', { numeric: true });
    var ka = String(a.cama || '');
    var kb = String(b.cama || '');
    if (ka !== kb) return ka.localeCompare(kb, 'es', { numeric: true });
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}
