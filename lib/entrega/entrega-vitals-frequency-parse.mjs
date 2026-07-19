import {
  defaultFrequencySpec,
  normalizeUntilTime,
  clampHours,
  clampShiftTimes,
} from './entrega-vitals-plan-core.mjs';

const STRUCTURED_DB = new Set(['None', '1h', '2h', '4h', 'Shift_Once']);

/** @param {number} n */
function clampHoursLocal(n) {
  return clampHours(n);
}

/** @param {number} n */
function clampShiftTimesLocal(n) {
  return clampShiftTimes(n);
}

/**
 * @param {{ mode?: string, hours?: number, timesPerShift?: number, untilTime?: string|null }} o
 * @returns {import('./entrega-vitals-plan.mjs').VitalsFrequencySpec}
 */
export function normalizeFrequencyObject(o) {
  const mode = String(o.mode || 'routine');
  const untilTime = normalizeUntilTime(o.untilTime);
  if (mode === 'interval') {
    return {
      mode: 'interval',
      hours: clampHoursLocal(o.hours ?? 2),
      ...(untilTime ? { untilTime } : {}),
    };
  }
  if (mode === 'shift') {
    return {
      mode: 'shift',
      timesPerShift: clampShiftTimesLocal(o.timesPerShift ?? 1),
      ...(untilTime ? { untilTime } : {}),
    };
  }
  return defaultFrequencySpec();
}

/**
 * @param {string} t
 * @returns {import('./entrega-vitals-plan.mjs').VitalsFrequencySpec}
 */
export function normalizeFrequencyLegacyString(t) {
  if (!t || t === 'None') return defaultFrequencySpec();
  if (t === 'Shift_Once') return { mode: 'shift', timesPerShift: 1 };
  if (STRUCTURED_DB.has(t) && t.endsWith('h')) {
    return { mode: 'interval', hours: clampHoursLocal(Number(t.replace('h', ''))) };
  }

  const lower = t.toLowerCase();
  if (/turno|por\s+turno/i.test(lower)) {
    const m = lower.match(/(\d+)\s*[x×]/);
    return { mode: 'shift', timesPerShift: clampShiftTimesLocal(m ? Number(m[1]) : 1) };
  }
  const cada = lower.match(/cada\s*(\d+)\s*h|(\d+)\s*h|q\s*(\d+)\s*h|q(\d+)h/);
  if (cada) {
    const n = Number(cada[1] || cada[2] || cada[3] || cada[4]);
    return { mode: 'interval', hours: clampHoursLocal(n) };
  }
  if (/rutina|evoluci[oó]n/i.test(lower)) return defaultFrequencySpec();
  return defaultFrequencySpec();
}
