import {
  VITAL_BASE_KEYS,
  getVitalExtraStorageKey,
} from './estado-actual-vital-extras.mjs';

const MAX_VITAL_READINGS_PER_DAY = 4;

/**
 * @param {unknown} raw
 * @returns {{ value: number, time?: string } | null}
 */
export function normalizeVitalReading(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var val = Number(/** @type {any} */ (raw).value);
  if (!Number.isFinite(val)) return null;
  var time = /** @type {any} */ (raw).time;
  return { value: val, time: time != null && String(time).length ? String(time) : undefined };
}

/**
 * @param {Array<{ value: number, time?: string }>} list
 * @param {{ value: number, time?: string }} item
 */
export function pushVitalReading(list, item) {
  var key = item.value + '@' + (item.time || '');
  for (var i = 0; i < list.length; i++) {
    var k = list[i].value + '@' + (list[i].time || '');
    if (k === key) return;
  }
  list.push(item);
}

/**
 * @param {Record<string, Array<{ value: number, time?: string }>>} out
 * @param {unknown} rawSeries
 */
export function mergeVitalSeriesFromStoredSeries(out, rawSeries) {
  if (!rawSeries || typeof rawSeries !== 'object') return;
  for (var sk = 0; sk < VITAL_BASE_KEYS.length; sk++) {
    var bk = VITAL_BASE_KEYS[sk];
    var arr = /** @type {any} */ (rawSeries)[bk];
    if (!Array.isArray(arr)) continue;
    out[bk] = [];
    for (var ai = 0; ai < arr.length; ai++) {
      var norm = normalizeVitalReading(arr[ai]);
      if (norm) pushVitalReading(out[bk], norm);
    }
  }
}

/**
 * @param {Record<string, Array<{ value: number, time?: string }>>} out
 * @param {Record<string, unknown>} vit
 * @param {Record<string, string>} alt
 */
export function mergeVitalSeriesFromLegacyVitals(out, vit, alt) {
  for (var vi = 0; vi < VITAL_BASE_KEYS.length; vi++) {
    var key = VITAL_BASE_KEYS[vi];
    if (!out[key]) out[key] = [];
    var hadStoredSeries = out[key].length > 0;
    if (vit[key] != null && vit[key] !== '' && !hadStoredSeries) {
      pushVitalReading(out[key], {
        value: Number(vit[key]),
        time: alt[key] ? String(alt[key]) : undefined,
      });
    }
    var extraKey = getVitalExtraStorageKey(key);
    if (vit[extraKey] != null && vit[extraKey] !== '') {
      pushVitalReading(out[key], {
        value: Number(vit[extraKey]),
        time: alt[extraKey] ? String(alt[extraKey]) : undefined,
      });
    }
  }
}

/** @param {Record<string, Array<{ value: number, time?: string }>>} out */
export function capVitalSeriesLengths(out) {
  for (var ck = 0; ck < VITAL_BASE_KEYS.length; ck++) {
    var ckKey = VITAL_BASE_KEYS[ck];
    if (out[ckKey] && out[ckKey].length > MAX_VITAL_READINGS_PER_DAY) {
      out[ckKey] = out[ckKey].slice(-MAX_VITAL_READINGS_PER_DAY);
    }
  }
}
