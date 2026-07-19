import { isIoNumericValue } from './estado-actual-data.mjs';
import { formatEgresoPartForText, toEaSalidaText } from './estado-actual-io.mjs';
import { escHtml } from './estado-actual-panel-format.mjs';

/**
 * @param {{ ing?: unknown, egr?: unknown, egrParts?: Array<{ label?: string, value?: unknown }>, evac?: unknown }} io
 * @returns {string}
 */
export function formatSnapshotEgresos(io) {
  io = io || {};
  if (Array.isArray(io.egrParts) && io.egrParts.length) {
    return escHtml(io.egrParts.map(formatEgresoPartForText).join(' · '));
  }
  var egr = io.egr;
  if (egr == null || egr === '') return '—';
  if (isIoNumericValue(egr)) return escHtml(String(egr) + ' CC (DIURESIS)');
  return escHtml(toEaSalidaText(egr));
}
