export const RANGES = {
  tas: { min: 90, max: 140 },
  tad: { min: 60, max: 90 },
  fc: { min: 60, max: 100 },
  fr: { min: 12, max: 20 },
  temp: { min: 36.0, max: 37.5 },
  sat: { min: 94, max: Infinity },
};

export const GLU_RANGE = { min: 70, max: 180 };

/** Umbral de fiebre para documentar PICO en SOAP (°C, inclusive). */
export const TEMP_FEVER_PICO_MIN = 38;

/** @param {unknown} raw */
export function isTempFeverPeak(raw) {
  if (raw == null || String(raw).trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  return n >= TEMP_FEVER_PICO_MIN;
}

/** @param {unknown} raw */
export function isGluAltered(raw) {
  if (raw == null || String(raw).trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  return n < GLU_RANGE.min || n > GLU_RANGE.max;
}

/**
 * @param {{ altered?: unknown, value?: unknown } | null | undefined} glu
 */
export function isGlucometriaMarkedAltered(glu) {
  if (!glu || typeof glu !== 'object') return false;
  if (/** @type {{ altered?: unknown }} */ (glu).altered === true) return true;
  return isGluAltered(/** @type {{ value?: unknown }} */ (glu).value);
}

export function isVitalAltered(key, raw) {
  if (raw == null || String(raw).trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  const r = RANGES[key];
  if (!r) return false;
  return n < r.min || n > r.max;
}

/** @param {unknown} raw */
export function isTempFebrile(raw) {
  if (raw == null || String(raw).trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  return n > RANGES.temp.max;
}

/**
 * @param {unknown} tas
 * @param {unknown} tad
 */
export function isBpHypotensive(tas, tad) {
  if (tas != null && String(tas).trim() !== '') {
    const n = Number(tas);
    if (Number.isFinite(n) && n < RANGES.tas.min) return true;
  }
  if (tad != null && String(tad).trim() !== '') {
    const n = Number(tad);
    if (Number.isFinite(n) && n < RANGES.tad.min) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown> | null | undefined} vitals
 * @param {unknown} vasopField
 */
export function isHemodynamicallyUnstable(vitals, vasopField) {
  const v = vitals && typeof vitals === 'object' ? vitals : {};
  if (isBpHypotensive(v.tas, v.tad)) return true;
  if (isVitalAltered('fc', v.fc)) return true;
  if (vasopField != null && String(vasopField).trim() !== '') return true;
  return false;
}

import { isTurnCloseHm } from './estado-actual-registro-defaults.mjs';

export function buildAlteredAtDefaults(vitals, defaultTime) {
  const out = {};
  const dt =
    defaultTime != null && String(defaultTime).trim() && !isTurnCloseHm(defaultTime)
      ? String(defaultTime).trim()
      : '';
  Object.keys(RANGES).forEach((k) => {
    if (isVitalAltered(k, vitals[k]) && dt) out[k] = dt;
  });
  return out;
}
