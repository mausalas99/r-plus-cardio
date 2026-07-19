/** @typedef {'None'|'1h'|'2h'|'4h'|'Shift_Once'} VitalsFrequencyDb */
/** @typedef {'routine'|'interval'|'shift'} VitalsFreqMode */
/** @typedef {{ mode: VitalsFreqMode, hours?: number, timesPerShift?: number, untilTime?: string|null }} VitalsFrequencySpec */

/** @returns {VitalsFrequencySpec} */
export function defaultFrequencySpec() {
  return { mode: 'routine' };
}

/** @param {unknown} raw @returns {string|null} HH:mm */
export function normalizeUntilTime(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** @param {number} n */
export function clampHours(n) {
  const h = Math.round(Number(n));
  if (!Number.isFinite(h)) return 2;
  return Math.min(24, Math.max(1, h));
}

/** @param {number} n */
export function clampShiftTimes(n) {
  const t = Math.round(Number(n));
  if (!Number.isFinite(t)) return 1;
  return Math.min(3, Math.max(1, t));
}
