import {
  detectInsulinPumpAlgorithmFromRecetaBlock,
  formatInsulinPumpAlgoritmoLabel,
  patientHasInsulinPumpInReceta,
} from '../insulin-pump-some-detect.mjs';

export { formatInsulinPumpAlgoritmoLabel, patientHasInsulinPumpInReceta };

/**
 * Sincroniza `monitoreo.bombaInsulinaAlgoritmo` (1–4 | null) desde SOME pegado.
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} recetaBlock
 * @returns {boolean} true si cambió
 */
export function syncMonitoreoInsulinPumpFromReceta(monitoreo, recetaBlock) {
  if (!monitoreo || typeof monitoreo !== 'object') return false;
  var next = detectInsulinPumpAlgorithmFromRecetaBlock(recetaBlock);
  var prev = monitoreo.bombaInsulinaAlgoritmo != null ? Number(monitoreo.bombaInsulinaAlgoritmo) : null;
  if (prev === next || (prev == null && next == null)) return false;
  if (next == null) delete monitoreo.bombaInsulinaAlgoritmo;
  else monitoreo.bombaInsulinaAlgoritmo = next;
  return true;
}

/**
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @returns {number | null}
 */
export function insulinPumpAlgorithmFromMonitoreo(monitoreo) {
  if (!monitoreo || monitoreo.bombaInsulinaAlgoritmo == null) return null;
  var n = Number(monitoreo.bombaInsulinaAlgoritmo);
  if (!Number.isFinite(n) || n < 1 || n > 4) return null;
  return n;
}

/**
 * Bomba activa por SOME o por historial con lecturas bomba.
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {{ bombaInsulina?: unknown[] } | null | undefined} [snapshot]
 */
export function patientUsesInsulinPumpMode(monitoreo, snapshot) {
  if (insulinPumpAlgorithmFromMonitoreo(monitoreo) != null) return true;
  return !!(snapshot && Array.isArray(snapshot.bombaInsulina) && snapshot.bombaInsulina.length);
}
