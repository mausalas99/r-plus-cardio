/** Vital sign stack UI for Estado Actual registro form. */
import {
  MAX_VITAL_LAYERS_IN_FORM,
  MAX_VITAL_READINGS_PER_DAY,
  vitalSeriesFromMedicion,
  countVitalReadingsInRegistroWindow,
} from './estado-actual-vital-series.mjs';
import { VITAL_KEYS, VITAL_LABELS, VITAL_UNITS } from './estado-actual-panel-constants.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';

export function vitalLayerBoxKey(baseKey, layerIdx) {
  return baseKey + '__L' + layerIdx;
}

function buildVitalChipHtml(baseKey, labelOverride, opts) {
  opts = opts || {};
  var label = labelOverride || VITAL_LABELS[baseKey] || baseKey;
  var layerIdx = opts.layerIdx != null ? opts.layerIdx : 0;
  var boxKey = vitalLayerBoxKey(baseKey, layerIdx);
  var unit = VITAL_UNITS[baseKey] || '';
  var labelHtml =
    '<div class="vital-label">' +
    '<span class="ea-vital-name">' +
    label +
    '</span>' +
    '<span class="ea-vital-unit">' +
    unit +
    '</span></div>';
  return (
    '<div class="vital-box ea-vital-box ea-vital-chip" data-ea-vital-box="' +
    boxKey +
    '">' +
    labelHtml +
    '<div class="ea-vital-value-wrap">' +
    '<input type="number" class="ea-vital-input" data-ea-vital="' +
    baseKey +
    '" data-ea-layer-idx="' +
    layerIdx +
    '" step="any" inputmode="decimal" placeholder="—" aria-label="' +
    label +
    '">' +
    '</div>' +
    '<div class="ea-altered-slot ea-altered-slot--hidden" data-ea-altered-wrap="' +
    boxKey +
    '" hidden>' +
    '<span class="ea-altered-label">Alterado</span>' +
    '<input type="time" class="ea-altered-time-input" data-ea-altered="' +
    boxKey +
    '" aria-label="Hora ' +
    label +
    ' alterado">' +
    '</div></div>'
  );
}

/**
 * @param {string} vitalKey
 * @returns {string}
 */
export function buildVitalStackHtml(vitalKey) {
  var label = VITAL_LABELS[vitalKey] || vitalKey;
  var slots = '';
  for (var li = 0; li < MAX_VITAL_LAYERS_IN_FORM; li++) {
    slots +=
      '<div class="ea-vital-slot" data-ea-layer="' +
      li +
      '"' +
      (li > 0 ? ' hidden' : '') +
      '>' +
      buildVitalChipHtml(vitalKey, label, { layerIdx: li }) +
      '</div>';
  }
  return (
    '<div class="ea-vital-stack" data-ea-vital-stack="' +
    vitalKey +
    '" data-ea-layer-count="1">' +
    slots +
    '<button type="button" class="ea-vital-add-btn ea-temp-add-btn" data-ea-vital-add="' +
    vitalKey +
    '" hidden title="Otra lectura de ' +
    label +
    ' (máx. ' +
    MAX_VITAL_READINGS_PER_DAY +
    '/día)">+1</button>' +
    '<div class="ea-vital-prev-badge" data-ea-vital-prev-view hidden>' +
    '<span class="ea-vital-prev-summary" data-ea-vital-prev-summary></span>' +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} stack
 * @returns {number}
 */
function getVitalStackLayerCount(stack) {
  return Math.min(
    MAX_VITAL_LAYERS_IN_FORM,
    Math.max(1, Number(stack.getAttribute('data-ea-layer-count') || '1'))
  );
}

/**
 * @param {HTMLElement} stack
 * @param {number} count
 */
function setVitalStackLayerCount(stack, count) {
  stack.setAttribute('data-ea-layer-count', String(count));
  stack.classList.toggle('ea-vital-stack--multi', count > 1);
  stack.classList.toggle('ea-vital-stack--dual', count > 1);
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 */
function updateVitalStackLayerVisibility(form, vitalKey) {
  if (!form) return;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return;
  var count = getVitalStackLayerCount(stack);
  var active = count - 1;
  for (var li = 0; li < MAX_VITAL_LAYERS_IN_FORM; li++) {
    var slot = stack.querySelector('[data-ea-layer="' + li + '"]');
    if (!slot) continue;
    var on = li === active;
    slot.hidden = !on;
    slot.style.visibility = '';
    slot.style.pointerEvents = '';
    slot.style.zIndex = '';
  }
  var prevBadge = stack.querySelector('[data-ea-vital-prev-view]');
  if (prevBadge) prevBadge.hidden = count <= 1;
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 */
function syncVitalPrevSummary(form, vitalKey) {
  if (!form) return;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return;
  var summary = stack.querySelector('[data-ea-vital-prev-summary]');
  if (!summary) return;
  var count = getVitalStackLayerCount(stack);
  var unit = VITAL_UNITS[vitalKey] || '';
  /** @type {string[]} */
  var parts = [];
  for (var li = 0; li < count - 1; li++) {
    var input = stack.querySelector(
      '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + li + '"]'
    );
    var boxKey = vitalLayerBoxKey(vitalKey, li);
    var timeEl = stack.querySelector('[data-ea-altered="' + boxKey + '"]');
    var val = input && 'value' in input ? String(input.value).trim() : '';
    if (!val) continue;
    var time = timeEl && 'value' in timeEl && timeEl.value ? String(timeEl.value) : '';
    parts.push(val + (unit ? ' ' + unit : '') + (time ? ' @ ' + time : ''));
  }
  summary.textContent = parts.length ? parts.join(' · ') : '—';
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 */
export function syncVitalAddButtonVisibility(form, vitalKey) {
  if (!form) return;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return;
  var addBtn = stack.querySelector('[data-ea-vital-add="' + vitalKey + '"]');
  if (!addBtn) return;
  var count = getVitalStackLayerCount(stack);
  var active = count - 1;
  var activeInput = stack.querySelector(
    '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + active + '"]'
  );
  var hasVal =
    activeInput && 'value' in activeInput && String(activeInput.value).trim() !== '';
  var atFormMax = count >= MAX_VITAL_LAYERS_IN_FORM;
  addBtn.hidden = !hasVal || atFormMax;
  if (atFormMax) {
    addBtn.title = 'Máximo ' + MAX_VITAL_LAYERS_IN_FORM + ' lecturas en este registro';
  }
}

/**
 * @param {HTMLElement | null} form
 */
export function syncAllVitalAddButtonVisibility(form) {
  VITAL_KEYS.forEach(function (key) {
    syncVitalAddButtonVisibility(form, key);
  });
}

/**
 * @param {unknown[]} historial
 * @param {Record<string, Array<{ value: number, time?: string }>>} vitalSeries
 * @param {Date} [now]
 * @returns {{ ok: true } | { ok: false, key: string, label: string }}
 */
export function validateVitalSeriesTurnLimits(historial, vitalSeries, now) {
  var hist = Array.isArray(historial) ? historial : [];
  for (var ki = 0; ki < VITAL_KEYS.length; ki++) {
    var key = VITAL_KEYS[ki];
    var newList = vitalSeries && vitalSeries[key] ? vitalSeries[key] : [];
    if (!newList.length) continue;
    var inWindow = countVitalReadingsInRegistroWindow(hist, key, now);
    if (inWindow + newList.length > MAX_VITAL_READINGS_PER_DAY) {
      return { ok: false, key: key, label: VITAL_LABELS[key] || key };
    }
  }
  return { ok: true };
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 */
export function expandVitalNextLayer(form, vitalKey) {
  if (!form) return;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return;
  var count = getVitalStackLayerCount(stack);
  if (count >= MAX_VITAL_LAYERS_IN_FORM) {
    getEaPanelRuntime().showToast('Máximo ' + MAX_VITAL_LAYERS_IN_FORM + ' lecturas por signo en este registro', 'error');
    return;
  }
  var active = count - 1;
  var activeInput = stack.querySelector(
    '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + active + '"]'
  );
  if (!activeInput || !('value' in activeInput) || !String(activeInput.value).trim()) {
    getEaPanelRuntime().showToast('Captura el valor actual antes de agregar otra lectura', 'error');
    return;
  }
  setVitalStackLayerCount(stack, count + 1);
  updateVitalStackLayerVisibility(form, vitalKey);
  syncVitalPrevSummary(form, vitalKey);
  syncVitalAddButtonVisibility(form, vitalKey);
  var nextInput = stack.querySelector(
    '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + count + '"]'
  );
  if (nextInput && 'focus' in nextInput) nextInput.focus();
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 * @param {Array<{ value: number, time?: string }>} [readings]
 * @param {number} [layerCount]
 */
export function setVitalStackFromSeries(form, vitalKey, readings, layerCount) {
  if (!form) return;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return;
  var list = Array.isArray(readings) ? readings.slice(0, MAX_VITAL_LAYERS_IN_FORM) : [];
  var count = layerCount != null ? layerCount : Math.max(1, list.length);
  count = Math.min(MAX_VITAL_LAYERS_IN_FORM, count);
  setVitalStackLayerCount(stack, count);
  for (var li = 0; li < MAX_VITAL_LAYERS_IN_FORM; li++) {
    var input = stack.querySelector(
      '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + li + '"]'
    );
    var boxKey = vitalLayerBoxKey(vitalKey, li);
    var timeEl = stack.querySelector('[data-ea-altered="' + boxKey + '"]');
    var rd = list[li];
    if (input && 'value' in input) input.value = rd && rd.value != null ? String(rd.value) : '';
    if (timeEl && 'value' in timeEl) timeEl.value = rd && rd.time ? String(rd.time) : '';
  }
  updateVitalStackLayerVisibility(form, vitalKey);
  syncVitalPrevSummary(form, vitalKey);
  syncVitalAddButtonVisibility(form, vitalKey);
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 */
export function collapseVitalStack(form, vitalKey) {
  setVitalStackFromSeries(form, vitalKey, [], 1);
}

/**
 * @param {HTMLElement | null} form
 */
export function collapseAllVitalStacks(form) {
  VITAL_KEYS.forEach(function (key) {
    collapseVitalStack(form, key);
  });
}

/**
 * @param {HTMLElement | null} form
 * @param {string} vitalKey
 * @returns {Array<{ value: number, time?: string }>}
 */
export function readVitalSeriesFromStack(form, vitalKey) {
  /** @type {Array<{ value: number, time?: string }>} */
  var out = [];
  if (!form) return out;
  var stack = form.querySelector('[data-ea-vital-stack="' + vitalKey + '"]');
  if (!stack) return out;
  var count = getVitalStackLayerCount(stack);
  for (var li = 0; li < count; li++) {
    var input = stack.querySelector(
      '[data-ea-vital="' + vitalKey + '"][data-ea-layer-idx="' + li + '"]'
    );
    var boxKey = vitalLayerBoxKey(vitalKey, li);
    var timeEl = stack.querySelector('[data-ea-altered="' + boxKey + '"]');
    if (!input || !('value' in input)) continue;
    var raw = String(input.value).trim();
    if (!raw) continue;
    var n = Number(raw);
    if (!Number.isFinite(n)) continue;
    var time =
      timeEl && 'value' in timeEl && timeEl.value ? String(timeEl.value) : undefined;
    out.push({ value: n, time: time });
  }
  return out;
}

/**
 * @param {unknown[]} historial
 * @param {string} vitalKey
 * @returns {Array<{ value: number, time?: string }>}
 */
export function mergeVitalSeriesFromHistorial(historial, vitalKey) {
  var hist = Array.isArray(historial) ? historial : [];
  /** @type {Array<{ value: number, time?: string }>} */
  var out = [];
  for (var i = 0; i < hist.length; i++) {
    var list = vitalSeriesFromMedicion(hist[i])[vitalKey] || [];
    for (var j = 0; j < list.length; j++) {
      var rd = list[j];
      var dup = out.some(function (x) {
        return x.value === rd.value && (x.time || '') === (rd.time || '');
      });
      if (!dup) out.push(rd);
    }
  }
  return out.slice(-MAX_VITAL_READINGS_PER_DAY);
}
