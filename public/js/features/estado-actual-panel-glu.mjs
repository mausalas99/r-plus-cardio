/** Glucometría + bomba insulina form rows for Estado Actual registro. */
import { STANDARD_GLUCOMETRIA_TIMES } from './estado-actual-registro-defaults.mjs';
import {
  buildStandardGluRowHtml,
  buildExtraGluRowHtml,
  fillGluRowData,
  focusNextStandardGluOrIo,
  focusSiblingGluOrIo,
} from './estado-actual-panel-glu-row.mjs';

export function syncGluRowAltered(row) {
  var alteredEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-altered]'));
  var wrap = row.querySelector('[data-ea-glu-rescue-wrap]');
  var valueEl = /** @type {HTMLInputElement | null} */ (row.querySelector('[data-ea-glu-value]'));
  if (!alteredEl || !wrap) return;
  var altered = !!alteredEl.checked;
  var hasValue = !!(valueEl && String(valueEl.value).trim() !== '');
  var showRescue = altered && hasValue;
  wrap.classList.toggle('ea-glu-rescue-wrap--hidden', !showRescue);
  wrap.hidden = !showRescue;
  row.classList.toggle('ea-glu-row--altered', showRescue);
}

function wireGluRowAltered(row) {
  var alteredEl = row.querySelector('[data-ea-glu-altered]');
  var valueEl = row.querySelector('[data-ea-glu-value]');
  if (alteredEl) alteredEl.addEventListener('change', function () { syncGluRowAltered(row); });
  if (valueEl) valueEl.addEventListener('input', function () { syncGluRowAltered(row); });
  syncGluRowAltered(row);
}

/**
 * @returns {HTMLDivElement | undefined}
 */
export function focusNextGluValueOrIo(row) {
  var list = row.parentElement;
  if (!list) return;
  if (row.classList.contains('ea-glu-row--standard')) {
    if (focusNextStandardGluOrIo(list, row)) return;
  } else if (focusSiblingGluOrIo(row)) {
    return;
  }
}

function wireGluRowKeyboard(row, buildRowFn) {
  var valueEl = row.querySelector('[data-ea-glu-value]');
  if (!valueEl) return;
  valueEl.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    if (row.classList.contains('ea-glu-row--extra')) {
      var list = row.parentElement;
      var extraRows = list ? list.querySelectorAll('.ea-glu-row--extra') : [];
      if (row === extraRows[extraRows.length - 1]) {
        var newRow = buildRowFn();
        if (list) list.appendChild(newRow);
        var focusEl = newRow.querySelector('[data-ea-glu-value]');
        if (focusEl && 'focus' in focusEl) focusEl.focus();
        return;
      }
    }
    focusNextGluValueOrIo(row);
  });
  var timeEl = row.querySelector('[data-ea-glu-time]:not([type="hidden"])');
  if (timeEl) {
    timeEl.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (valueEl && 'focus' in valueEl) valueEl.focus();
    });
  }
}

/**
 * @param {{ value?: number, time?: string, altered?: boolean, rescueUnits?: number, postRescueValue?: number } | null | undefined} [data]
 * @param {{ standardTime?: string } | null | undefined} [opts]
 * @returns {HTMLDivElement}
 */
export function buildGluRow(data, opts) {
  opts = opts || {};
  var standardTime = opts.standardTime ? String(opts.standardTime) : '';
  var isStandard = !!standardTime;
  var row = document.createElement('div');
  row.className = 'ea-glu-row' + (isStandard ? ' ea-glu-row--standard' : ' ea-glu-row--extra');
  if (isStandard) row.setAttribute('data-ea-glu-standard', standardTime);
  row.innerHTML = isStandard ? buildStandardGluRowHtml(standardTime) : buildExtraGluRowHtml();
  fillGluRowData(row, data, isStandard);
  var removeBtn = row.querySelector('[data-ea-glu-remove]');
  if (removeBtn) removeBtn.addEventListener('click', function () { row.remove(); });
  wireGluRowAltered(row);
  wireGluRowKeyboard(row, function () { return buildGluRow(); });
  return row;
}

/**
 * @param {HTMLElement | null} gluList
 * @param {Array<{ value?: number, time?: string, altered?: boolean, rescueUnits?: number, postRescueValue?: number }>} [prefill]
 */
export function fillStandardGluList(gluList, prefill) {
  if (!gluList) return;
  /** @type {Map<string, { value?: number, time?: string }>} */
  var byTime = new Map();
  (prefill || []).forEach(function (g) {
    var t = g.time != null ? String(g.time) : '';
    if (t) byTime.set(t, g);
  });
  gluList.innerHTML = '';
  gluList.classList.add('ea-glu-list--slots');
  STANDARD_GLUCOMETRIA_TIMES.forEach(function (slotTime) {
    gluList.appendChild(buildGluRow(byTime.get(slotTime), { standardTime: slotTime }));
  });
}

/**
 * @param {HTMLFormElement | null | undefined} form
 */
export function syncEaGluMode(form) {
  if (!form) return;
  var toggle = form.querySelector('#ea-bomba-enabled');
  var normalBlock = form.querySelector('#ea-glu-normal-block');
  var bombaBlock = form.querySelector('#ea-bomba-block');
  if (!toggle || !normalBlock || !bombaBlock) return;
  var bombaOn = /** @type {HTMLInputElement} */ (toggle).checked;
  normalBlock.hidden = bombaOn;
  bombaBlock.hidden = !bombaOn;
  normalBlock.classList.toggle('ea-glu-pane--off', bombaOn);
  bombaBlock.classList.toggle('ea-glu-pane--off', !bombaOn);
  if (bombaOn) {
    var bombaList = form.querySelector('#ea-bomba-list');
    if (bombaList && !bombaList.querySelector('.ea-bomba-row')) bombaList.appendChild(buildBombaRow());
  } else {
    var gluList = form.querySelector('#ea-glu-list');
    if (gluList && !gluList.querySelector('.ea-glu-row')) fillStandardGluList(gluList);
  }
}

/**
 * @param {{ value?: number, units?: number, time?: string } | null | undefined} [data]
 * @returns {HTMLDivElement}
 */
export function buildBombaRow(data) {
  var row = document.createElement('div');
  row.className = 'ea-bomba-row';
  row.innerHTML =
    '<label class="ea-field ea-field--inline">' +
    '<span class="ea-label">Glu</span>' +
    '<input type="number" class="ea-input" data-ea-bomba-value min="0" step="1" placeholder="mg/dL">' +
    '</label>' +
    '<label class="ea-field ea-field--inline">' +
    '<span class="ea-label">Unidades</span>' +
    '<input type="number" class="ea-input" data-ea-bomba-units min="0" step="0.1" placeholder="U">' +
    '</label>' +
    '<label class="ea-field ea-field--inline">' +
    '<span class="ea-label">Hora</span>' +
    '<input type="time" class="ea-input ea-input--time" data-ea-bomba-time>' +
    '</label>' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-btn--icon" data-ea-bomba-remove title="Quitar" aria-label="Quitar registro bomba">×</button>';
  if (data) {
    var val = row.querySelector('[data-ea-bomba-value]');
    var units = row.querySelector('[data-ea-bomba-units]');
    var time = row.querySelector('[data-ea-bomba-time]');
    if (val && data.value != null && 'value' in val) val.value = String(data.value);
    if (units && data.units != null && 'value' in units) units.value = String(data.units);
    if (time && data.time && 'value' in time) time.value = String(data.time);
  }
  var removeBtn = row.querySelector('[data-ea-bomba-remove]');
  if (removeBtn) {
    removeBtn.addEventListener('click', function () {
      var list = row.parentElement;
      if (!list) return;
      if (list.querySelectorAll('.ea-bomba-row').length <= 1) {
        ['[data-ea-bomba-value]', '[data-ea-bomba-units]', '[data-ea-bomba-time]'].forEach(function (sel) {
          var el = row.querySelector(sel);
          if (el) el.value = '';
        });
        return;
      }
      row.remove();
    });
  }
  return row;
}
