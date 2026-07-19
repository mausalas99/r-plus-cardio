/**
 * Numeric bed ordering for census / guardia lists (cuarto + cama).
 */
import { parseBedLabelSortKey, parseRoomBedSortKey } from './patient-bed-sort-key.mjs';

/**
 * @param {{ cuarto?: string, cama?: string, bed_label?: string, bedLabel?: string, nombre?: string, name?: string }} patient
 */
export function patientBedSortKey(patient) {
  const fromRoom = parseRoomBedSortKey(patient?.cuarto, patient?.cama);
  if (fromRoom != null) return fromRoom;
  const bedLabel = String(patient?.bed_label || patient?.bedLabel || '').trim();
  const fromLabel = parseBedLabelSortKey(bedLabel);
  if (fromLabel != null) return fromLabel;
  return 999999;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
export function comparePatientsByBed(a, b) {
  const ka = patientBedSortKey(a);
  const kb = patientBedSortKey(b);
  if (ka !== kb) return ka - kb;
  return String(a?.nombre || a?.name || '').localeCompare(String(b?.nombre || b?.name || ''), 'es');
}
