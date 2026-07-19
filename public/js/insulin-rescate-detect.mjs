/**
 * Detección de insulina PRN SC por glucometría (rescates) en bloques SOME.
 */

var INSULIN_RE = /\bINSULINA\b/i;
var SC_VIA_RE = /\b(?:VIA\s+)?SUBCUTANEA\b|\bSC\b/i;
var DESTROXTIS_RE = /\b(DESTROXTIS|DESTROXTIAS|GLUCOSA|MG\/DL)\b/i;

/**
 * @param {{ nombreRaw?: unknown, viaRaw?: unknown, dosisRaw?: unknown, frecuenciaRaw?: unknown, suspendido?: boolean }} item
 * @returns {boolean}
 */
export function isInsulinRescateMedicationItem(item) {
  if (!item || item.suspendido) return false;
  if (!INSULIN_RE.test(String(item.nombreRaw || ''))) return false;
  var via = String(item.viaRaw || '');
  if (!SC_VIA_RE.test(via)) return false;
  var blob = [item.dosisRaw, item.frecuenciaRaw].join(' ');
  if (!/\bPRN\b/i.test(blob)) return false;
  return DESTROXTIS_RE.test(blob);
}

/**
 * @param {unknown[]} items
 * @returns {unknown[]}
 */
export function insulinRescateItemsFromList(items) {
  return (Array.isArray(items) ? items : []).filter(isInsulinRescateMedicationItem);
}

/**
 * @param {unknown[]} items
 * @returns {boolean}
 */
export function patientHasInsulinRescateMeds(items) {
  return insulinRescateItemsFromList(items).length > 0;
}
