/** Glu row DOM builders — extracted from estado-actual-panel-glu.mjs */
import { gluRescueFieldsHtml } from './estado-actual-panel-glu-rescue-html.mjs';

/**
 * @param {string} standardTime
 */
export function buildStandardGluRowHtml(standardTime) {
  return (
    '<span class="ea-glu-time-badge">' +
    standardTime +
    '</span>' +
    '<input type="number" class="ea-input ea-glu-value-input" data-ea-glu-value min="0" step="1" placeholder="mg/dL" inputmode="numeric" aria-label="Glucometría ' +
    standardTime +
    '">' +
    '<input type="hidden" data-ea-glu-time value="' +
    standardTime +
    '">' +
    '<div class="ea-glu-row-meta">' +
    gluRescueFieldsHtml() +
    '</div>'
  );
}

export function buildExtraGluRowHtml() {
  return (
    '<input type="time" class="ea-input ea-input--time ea-glu-time-input" data-ea-glu-time aria-label="Hora de glucometría">' +
    '<input type="number" class="ea-input ea-glu-value-input" data-ea-glu-value min="0" step="1" placeholder="mg/dL" inputmode="numeric" aria-label="Glucometría">' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-btn--icon ea-glu-remove-btn" data-ea-glu-remove title="Quitar fila" aria-label="Quitar glucometría">×</button>' +
    '<div class="ea-glu-row-meta">' +
    gluRescueFieldsHtml() +
    '</div>'
  );
}

/**
 * @param {HTMLDivElement} row
 * @param {{ value?: number, time?: string, altered?: boolean, rescueUnits?: number, postRescueValue?: number } | null | undefined} data
 * @param {boolean} isStandard
 */
function applyGluRescueFields(row, data) {
  var alteredEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-altered]'));
  var rescueEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-rescue-units]'));
  var postRescueEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-post-rescue-value]'));
  if (alteredEl && data.altered) alteredEl.checked = true;
  if (rescueEl && data.rescueUnits != null && data.rescueUnits !== '') rescueEl.value = String(data.rescueUnits);
  if (postRescueEl && data.postRescueValue != null && data.postRescueValue !== '') {
    postRescueEl.value = String(data.postRescueValue);
  }
}

export function fillGluRowData(row, data, isStandard) {
  if (!data) return;
  var val = row.querySelector('[data-ea-glu-value]');
  var time = row.querySelector('[data-ea-glu-time]');
  if (val && data.value != null && 'value' in val) val.value = String(data.value);
  if (!isStandard && time && data.time && 'value' in time) time.value = String(data.time);
  applyGluRescueFields(row, data);
}

/**
 * @param {HTMLElement} list
 * @param {HTMLElement} row
 */
export function focusNextStandardGluOrIo(list, row) {
  var standardRows = list.querySelectorAll('.ea-glu-row--standard');
  for (var si = 0; si < standardRows.length; si++) {
    if (standardRows[si] !== row) continue;
    if (si < standardRows.length - 1) {
      var nextStd = standardRows[si + 1].querySelector('[data-ea-glu-value]');
      if (nextStd && 'focus' in nextStd) {
        nextStd.focus();
        return true;
      }
    }
    break;
  }
  return false;
}

/**
 * @param {HTMLElement} row
 */
export function focusSiblingGluOrIo(row) {
  var next = row.nextElementSibling;
  var nextFocus = next && next.querySelector('[data-ea-glu-value]');
  if (nextFocus && 'focus' in nextFocus) {
    nextFocus.focus();
    return true;
  }
  var ioIng = document.getElementById('ea-io-ing');
  if (ioIng && 'focus' in ioIng) ioIng.focus();
  return true;
}
