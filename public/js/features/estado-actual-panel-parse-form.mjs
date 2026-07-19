/** parseFormMedicion helpers — extracted from estado-actual-panel-actions.mjs */
import { isVitalAltered } from './estado-actual-ranges.mjs';
import { isTurnCloseHm } from './estado-actual-registro-defaults.mjs';
import { getVitalExtraStorageKey } from './estado-actual-vital-extras.mjs';
import { VITAL_KEYS } from './estado-actual-panel-constants.mjs';
import { parseNumOrNull } from './estado-actual-panel-format.mjs';
import { readVitalSeriesFromStack } from './estado-actual-panel-vitals.mjs';
import { vitalSeriesToLegacyFields } from './estado-actual-vital-series.mjs';

/**
 * @param {HTMLFormElement} form
 * @param {string} defaultTime
 */
export function parseVitalsFromForm(form, defaultTime) {
  /** @type {Record<string, Array<{ value: number, time?: string }>>} */
  var vitalSeries = {};
  VITAL_KEYS.forEach(function (key) {
    vitalSeries[key] = readVitalSeriesFromStack(form, key);
  });
  var legacy = vitalSeriesToLegacyFields(vitalSeries);
  var vitals = legacy.vitals;
  var alteredAt = legacy.alteredAt;
  VITAL_KEYS.forEach(function (key) {
    var list = vitalSeries[key] || [];
    for (var li = 0; li < list.length; li++) {
      var rd = list[li];
      if (rd.time) {
        if (li === list.length - 1) alteredAt[key] = rd.time;
        else if (li === list.length - 2 && key === 'temp') alteredAt.tempPeak = rd.time;
        else if (li === list.length - 2) alteredAt[getVitalExtraStorageKey(key)] = rd.time;
      } else if (li === list.length - 1 && isVitalAltered(key, rd.value) && !isTurnCloseHm(defaultTime)) {
        alteredAt[key] = defaultTime;
      }
    }
  });
  return { vitals, vitalSeries, alteredAt };
}

/**
 * @param {Element} row
 * @param {string} defaultTime
 */
function applyAlteredGluExtras(entry, row) {
  var alteredEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-altered]'));
  if (!alteredEl || !alteredEl.checked) return entry;
  entry.altered = true;
  var rescueEl = row.querySelector('[data-ea-glu-rescue-units]');
  var postRescueEl = row.querySelector('[data-ea-glu-post-rescue-value]');
  var rescueUnits = parseNumOrNull(rescueEl && 'value' in rescueEl ? rescueEl.value : '');
  if (rescueUnits != null && rescueUnits > 0) entry.rescueUnits = rescueUnits;
  var postRescueValue = parseNumOrNull(postRescueEl && 'value' in postRescueEl ? postRescueEl.value : '');
  if (postRescueValue != null) entry.postRescueValue = postRescueValue;
  return entry;
}

function parseGluRow(row, defaultTime) {
  var valEl = row.querySelector('[data-ea-glu-value]');
  var timeEl = row.querySelector('[data-ea-glu-time]');
  var value = parseNumOrNull(valEl && 'value' in valEl ? valEl.value : '');
  if (value == null) return null;
  var slotTime = row.getAttribute('data-ea-glu-standard');
  var time = slotTime || (timeEl && 'value' in timeEl && timeEl.value ? String(timeEl.value) : defaultTime);
  return applyAlteredGluExtras({ value: value, time: time }, row);
}

/**
 * @param {HTMLFormElement} form
 * @param {string} defaultTime
 */
export function parseGlucometriasFromForm(form, defaultTime) {
  /** @type {Array<{ value: number, time: string, altered?: boolean, rescueUnits?: number, postRescueValue?: number }>} */
  var glucometrias = [];
  form.querySelectorAll('.ea-glu-row').forEach(function (row) {
    var entry = parseGluRow(row, defaultTime);
    if (entry) glucometrias.push(entry);
  });
  return glucometrias;
}

/**
 * @param {Element} row
 * @param {string} defaultTime
 */
function parseBombaRow(row, defaultTime) {
  var valEl = row.querySelector('[data-ea-bomba-value]');
  var unitsEl = row.querySelector('[data-ea-bomba-units]');
  var timeEl = row.querySelector('[data-ea-bomba-time]');
  var value = parseNumOrNull(valEl && 'value' in valEl ? valEl.value : '');
  if (value == null) return null;
  var units = parseNumOrNull(unitsEl && 'value' in unitsEl ? unitsEl.value : '');
  var time = timeEl && 'value' in timeEl && timeEl.value ? String(timeEl.value) : defaultTime;
  return { value: value, units: units != null ? units : 0, time: time };
}

/**
 * @param {HTMLFormElement} form
 * @param {string} defaultTime
 */
export function parseBombaFromForm(form, defaultTime) {
  /** @type {Array<{ value: number, units: number, time: string }>} */
  var bombaInsulina = [];
  form.querySelectorAll('.ea-bomba-row').forEach(function (row) {
    var entry = parseBombaRow(row, defaultTime);
    if (entry) bombaInsulina.push(entry);
  });
  return bombaInsulina;
}
