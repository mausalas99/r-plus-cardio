import { gluPointMs, isGluPointInRegistroWindow } from './estado-actual-registro-defaults.mjs';

/**
 * @param {object} row
 * @param {Date} ref
 * @param {Set<string>} seen
 */
export function collectGlucometriasFromHistorialRow(row, ref, seen) {
  if (!row || typeof row !== 'object') return [];
  const recordedAt = row.recordedAt != null ? String(row.recordedAt) : '';
  const glus = Array.isArray(row.glucometrias) ? row.glucometrias : [];
  /** @type {Array<{ value: unknown, time: string, recordedAt: string }>} */
  const out = [];
  for (let j = 0; j < glus.length; j += 1) {
    const g = glus[j];
    if (!g || typeof g !== 'object') continue;
    const val = /** @type {any} */ (g).value;
    if (val == null || val === '') continue;
    const time = /** @type {any} */ (g).time != null ? String(/** @type {any} */ (g).time) : '';
    const ms = gluPointMs(recordedAt, time);
    if (!isGluPointInRegistroWindow(ms, ref)) continue;
    const key = String(val) + '@' + time + '@' + recordedAt;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value: val, time, recordedAt });
  }
  return out;
}
