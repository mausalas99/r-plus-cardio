import { gluPointMs, isGluPointInRegistroWindow } from './estado-actual-registro-defaults.mjs';
import {
  VITAL_BASE_KEYS,
  getVitalExtraStorageKey,
} from './estado-actual-vital-extras.mjs';
import {
  capVitalSeriesLengths,
  mergeVitalSeriesFromLegacyVitals,
  mergeVitalSeriesFromStoredSeries,
  pushVitalReading,
} from './estado-actual-vital-series-helpers.mjs';

export { mergeVitalSeriesFromHistorial } from './estado-actual-panel-vitals.mjs';

/** Máximo de lecturas del mismo signo vital en la ventana del turno (por día de registro). */
export const MAX_VITAL_READINGS_PER_DAY = 4;

/** Máximo de capas en el modal (+1 en el mismo chip). */
export const MAX_VITAL_LAYERS_IN_FORM = 4;

/**
 * @typedef {{ value: number, time?: string }} VitalReading
 */

/**
 * @param {unknown} medicion
 * @returns {Record<string, VitalReading[]>}
 */
export function vitalSeriesFromMedicion(medicion) {
  /** @type {Record<string, VitalReading[]>} */
  var out = {};
  if (!medicion || typeof medicion !== 'object') return out;
  /** @type {any} */
  var m = medicion;

  mergeVitalSeriesFromStoredSeries(out, m.vitalSeries);

  var vit = m.vitals && typeof m.vitals === 'object' ? /** @type {any} */ (m.vitals) : {};
  var alt =
    m.alteredAt && typeof m.alteredAt === 'object'
      ? /** @type {Record<string, string>} */ (m.alteredAt)
      : {};

  mergeVitalSeriesFromLegacyVitals(out, vit, alt);
  capVitalSeriesLengths(out);
  return out;
}

/**
 * @param {Record<string, VitalReading[]>} series
 */
export function vitalSeriesToLegacyFields(series) {
  /** @type {Record<string, number | null>} */
  var vitals = {};
  /** @type {Record<string, string>} */
  var alteredAt = {};

  VITAL_BASE_KEYS.forEach(function (key) {
    vitals[key] = null;
    var list = series[key] || [];
    if (!list.length) return;
    var last = list[list.length - 1];
    vitals[key] = last.value;
    if (last.time) alteredAt[key] = last.time;
    if (list.length >= 2 && key === 'temp') {
      var second = list[list.length - 2];
      vitals.tempPeak = second.value;
      if (second.time) alteredAt.tempPeak = second.time;
    } else if (list.length >= 2) {
      var sec = list[list.length - 2];
      vitals[getVitalExtraStorageKey(key)] = sec.value;
      if (sec.time) alteredAt[getVitalExtraStorageKey(key)] = sec.time;
    }
  });
  return { vitals: vitals, alteredAt: alteredAt };
}

/**
 * @param {Array<{ recordedAt?: string, vitals?: Record<string, unknown>, vitalSeries?: Record<string, VitalReading[]>, alteredAt?: Record<string, string> }>} historial
 * @param {string} vitalKey
 * @param {Date} [now]
 */
export function countVitalReadingsInRegistroWindow(historial, vitalKey, now) {
  var hist = Array.isArray(historial) ? historial : [];
  /** @type {VitalReading[]} */
  var all = [];
  for (var i = 0; i < hist.length; i++) {
    var row = hist[i];
    if (!row || typeof row !== 'object') continue;
    var recordedAt = row.recordedAt != null ? String(row.recordedAt) : '';
    var series = vitalSeriesFromMedicion(row);
    var list = series[vitalKey] || [];
    for (var j = 0; j < list.length; j++) {
      var rd = list[j];
      var ms = gluPointMs(recordedAt, rd.time || '');
      if (!isGluPointInRegistroWindow(ms, now)) continue;
      pushVitalReading(all, rd);
    }
  }
  return all.length;
}

/**
 * @param {unknown} row
 * @param {Set<string>} seen
 * @param {Date} [now]
 * @returns {Array<{ value: number, units: number, time: string }>}
 */
function bombaEntriesFromHistorialRow(row, seen, now) {
  /** @type {Array<{ value: number, units: number, time: string }>} */
  var chunk = [];
  if (!row || typeof row !== 'object') return chunk;
  var recordedAt = row.recordedAt != null ? String(row.recordedAt) : '';
  var entries = Array.isArray(row.bombaInsulina) ? row.bombaInsulina : [];
  for (var j = 0; j < entries.length; j++) {
    var e = entries[j];
    if (!e || typeof e !== 'object') continue;
    var val = Number(/** @type {any} */ (e).value);
    var units = Number(/** @type {any} */ (e).units);
    if (!Number.isFinite(val)) continue;
    if (!Number.isFinite(units)) units = 0;
    var time = /** @type {any} */ (e).time != null ? String(/** @type {any} */ (e).time) : '';
    var ms = gluPointMs(recordedAt, time);
    if (!isGluPointInRegistroWindow(ms, now)) continue;
    var key = val + '@' + units + '@' + time;
    if (seen.has(key)) continue;
    seen.add(key);
    chunk.push({ value: val, units: units, time: time });
  }
  return chunk;
}

/**
 * @param {Array<{ recordedAt?: string, bombaInsulina?: Array<{ value?: unknown, units?: unknown, time?: string }> }>} historial
 * @param {Date} [now]
 * @returns {Array<{ value: number, units: number, time: string }>}
 */
export function collectBombaInsulinaForRegistroWindow(historial, now) {
  var hist = Array.isArray(historial) ? historial : [];
  /** @type {Array<{ value: number, units: number, time: string }>} */
  var out = [];
  /** @type {Set<string>} */
  var seen = new Set();

  for (var i = 0; i < hist.length; i++) {
    out.push(...bombaEntriesFromHistorialRow(hist[i], seen, now));
  }

  out.sort(function (a, b) {
    return String(a.time || '').localeCompare(String(b.time || ''));
  });
  return out;
}
