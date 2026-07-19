import {
  defaultFrequencySpec,
  clampHours,
  clampShiftTimes,
} from './entrega-vitals-plan-core.mjs';
import {
  normalizeFrequencyObject,
  normalizeFrequencyLegacyString,
} from './entrega-vitals-frequency-parse.mjs';

const HOUR_PRESETS = [1, 2, 3, 4, 6, 8];

export const VITALS_FREQ_HOUR_PRESETS = HOUR_PRESETS;
export const VITALS_FREQ_SHIFT_OPTIONS = [1, 2, 3];

export {
  defaultFrequencySpec,
  normalizeUntilTime,
} from './entrega-vitals-plan-core.mjs';

export const VITALS_METRIC_KEYS = ['ta', 'fc', 'fr', 'temp', 'sat', 'glu'];

export const VITALS_METRIC_LABELS = {
  ta: 'TA',
  fc: 'FC',
  fr: 'FR',
  temp: 'Temp',
  sat: 'Sat O₂',
  glu: 'Glucometría',
};

const DEFAULT_METRICS = Object.fromEntries(VITALS_METRIC_KEYS.map((k) => [k, true]));

/** @returns {{ frequency: VitalsFrequencySpec, metrics: Record<string, boolean> }} */
export function defaultVitalsPlan() {
  return { frequency: defaultFrequencySpec(), metrics: { ...DEFAULT_METRICS } };
}

/**
 * @param {unknown} raw Legacy string, DB enum, or spec object
 * @returns {VitalsFrequencySpec}
 */
export function normalizeFrequencySpec(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeFrequencyObject(raw);
  }
  return normalizeFrequencyLegacyString(String(raw ?? '').trim());
}

/**
 * True when clock has passed the stop time for this shift.
 * Early-morning until + evening now → still active (stop is next morning).
 * @param {VitalsFrequencySpec} spec
 * @param {Date} [now]
 */
export function isVitalsFrequencyPaused(spec, now = new Date()) {
  const norm = normalizeFrequencySpec(spec);
  if (!norm.untilTime) return false;
  const [hh, mm] = norm.untilTime.split(':').map(Number);
  const untilMins = hh * 60 + mm;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (untilMins < 12 * 60 && nowMins >= 12 * 60) return false;
  return nowMins >= untilMins;
}


/** @param {VitalsFrequencySpec} spec */
export function frequencyIntervalMs(spec) {
  const norm = normalizeFrequencySpec(spec);
  if (norm.mode === 'interval') return clampHours(norm.hours ?? 2) * 3600000;
  if (norm.mode === 'shift') {
    const times = clampShiftTimes(norm.timesPerShift ?? 1);
    return Math.floor((8 * 3600000) / times);
  }
  return null;
}

/**
 * @param {VitalsFrequencySpec|unknown} spec
 * @returns {VitalsFrequencyDb}
 */
export function vitalsFrequencyForDb(spec) {
  const norm = normalizeFrequencySpec(spec);
  if (norm.mode === 'routine') return 'None';
  if (norm.mode === 'shift') return 'Shift_Once';
  const h = clampHours(norm.hours ?? 2);
  if (h === 1) return '1h';
  if (h === 2) return '2h';
  if (h === 4) return '4h';
  return 'None';
}

function untilSuffix(untilTime) {
  return untilTime ? ` · hasta ${untilTime}` : '';
}

/**
 * @param {VitalsFrequencySpec|unknown} spec
 * @param {Date} [now]
 */
export function frequencyDisplayLabel(spec, now = new Date()) {
  const norm = normalizeFrequencySpec(spec);
  if (isVitalsFrequencyPaused(norm, now)) {
    return `Finalizado${norm.untilTime ? ` (${norm.untilTime})` : ''}`;
  }
  if (norm.mode === 'routine') return 'Sin signos programados';
  if (norm.mode === 'interval') {
    return `Cada ${clampHours(norm.hours ?? 2)} h${untilSuffix(norm.untilTime)}`;
  }
  const times = clampShiftTimes(norm.timesPerShift ?? 1);
  const base = times === 1 ? '1× por turno' : `${times}× por turno`;
  return `${base}${untilSuffix(norm.untilTime)}`;
}

/** @param {unknown} plan */
export function normalizeVitalsPlan(plan) {
  const base = defaultVitalsPlan();
  if (!plan || typeof plan !== 'object') return base;
  const p = /** @type {{ frequency?: unknown, metrics?: Record<string, boolean> }} */ (plan);
  base.frequency = normalizeFrequencySpec(p.frequency);
  for (const key of VITALS_METRIC_KEYS) {
    if (p.metrics && typeof p.metrics[key] === 'boolean') {
      base.metrics[key] = p.metrics[key];
    }
  }
  return base;
}

/** @param {VitalsFrequencySpec|unknown} spec */
export function isStructuredVitalsFrequency(spec) {
  const norm = normalizeFrequencySpec(spec);
  return norm.mode === 'interval' || norm.mode === 'shift';
}

/** @param {{ frequency?: unknown, metrics?: Record<string, boolean> }}|unknown} plan */
export function vitalsMonitoringEnabled(plan) {
  const norm = normalizeVitalsPlan(plan);
  return VITALS_METRIC_KEYS.some((k) => norm.metrics[k]);
}

/** Intervalo o por turno con al menos una métrica activa (rutina = sin signos en interno). */
export function vitalsStructuredMonitoringEnabled(plan) {
  const norm = normalizeVitalsPlan(plan);
  if (!VITALS_METRIC_KEYS.some((k) => norm.metrics[k])) return false;
  return isStructuredVitalsFrequency(norm.frequency);
}

/** @param {{ frequency?: unknown, metrics?: Record<string, boolean> }}|unknown} plan */
export function enabledVitalsMetricLabels(plan) {
  const norm = normalizeVitalsPlan(plan);
  return VITALS_METRIC_KEYS.filter((k) => norm.metrics[k]).map((k) => VITALS_METRIC_LABELS[k]);
}

/** @param {{ frequency?: unknown, metrics?: Record<string, boolean> }}|unknown} plan */
export function enabledVitalsMetricKeys(plan) {
  const norm = normalizeVitalsPlan(plan);
  return VITALS_METRIC_KEYS.filter((k) => norm.metrics[k]);
}

/**
 * Prefer structured vitalsPlan frequency; fall back to legacy active_guardias column.
 * @param {{ frequency?: unknown }|null|undefined} vitalsPlan
 * @param {unknown} vitalsFrequencyDb
 */
export function resolveGuardiaVitalsFrequencySpec(vitalsPlan, vitalsFrequencyDb) {
  const planSpec = vitalsPlan ? normalizeFrequencySpec(vitalsPlan.frequency) : null;
  if (planSpec && planSpec.mode !== 'routine') return planSpec;
  const db = String(vitalsFrequencyDb ?? '').trim();
  if (db && db !== 'None') return normalizeFrequencySpec(db);
  return planSpec || normalizeFrequencySpec(vitalsFrequencyDb);
}

/**
 * Interno board: honor v2 vitalsPlan; fall back when legacy row only has vitals_frequency.
 * @param {{ vitalsPlan?: unknown }|unknown} pendientesDoc normalized pendientes doc
 * @param {{ vitals_frequency?: string|null }} [guardiaRow]
 */
function pendientesJsonHadExplicitVitalsPlan(guardiaRow) {
  try {
    const raw = guardiaRow?.pendientes_json;
    if (!raw) return false;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      parsed.version === 2 &&
      Object.prototype.hasOwnProperty.call(parsed, 'vitalsPlan')
    );
  } catch {
    return false;
  }
}

export function resolveInternoBoardVitalsPlan(pendientesDoc, guardiaRow) {
  const rawDoc = pendientesDoc && typeof pendientesDoc === 'object' ? pendientesDoc : null;
  const plan = normalizeVitalsPlan(rawDoc?.vitalsPlan);
  if (vitalsStructuredMonitoringEnabled(plan)) return plan;
  if (
    pendientesJsonHadExplicitVitalsPlan(guardiaRow) &&
    normalizeFrequencySpec(plan.frequency).mode === 'routine'
  ) {
    return plan;
  }
  const dbFreq = String(guardiaRow?.vitals_frequency ?? '').trim();
  if (!dbFreq || dbFreq === 'None') return plan;
  const legacyPlan = normalizeVitalsPlan({
    frequency: resolveGuardiaVitalsFrequencySpec(plan, dbFreq),
    metrics: Object.fromEntries(VITALS_METRIC_KEYS.map((k) => [k, true])),
  });
  return vitalsStructuredMonitoringEnabled(legacyPlan) ? legacyPlan : plan;
}

/** @param {{ frequency?: unknown, metrics?: Record<string, boolean> }} plan */
export function vitalsPlanSummary(plan) {
  const norm = normalizeVitalsPlan(plan);
  const enabled = VITALS_METRIC_KEYS.filter((k) => norm.metrics[k]);
  if (!enabled.length) return 'Sin signos solicitados';
  const freqLabel =
    norm.frequency.mode === 'routine'
      ? 'sin signos en interno'
      : frequencyDisplayLabel(norm.frequency).toLowerCase();
  if (norm.frequency.mode === 'routine') {
    return enabled.length
      ? `${enabled.map((k) => VITALS_METRIC_LABELS[k]).join(', ')} · ${freqLabel}`
      : 'Sin signos en interno';
  }
  return `${enabled.map((k) => VITALS_METRIC_LABELS[k]).join(', ')} · ${freqLabel}`;
}

/** @deprecated Use vitalsFrequencyForDb(spec) */
export function inferStructuredFrequency(raw) {
  return vitalsFrequencyForDb(raw);
}
