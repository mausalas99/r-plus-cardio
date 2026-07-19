/** Registro form wiring — extracted from estado-actual-panel-registro.mjs */
import { isVitalAltered } from './estado-actual-ranges.mjs';
import { isTurnCloseHm } from './estado-actual-registro-defaults.mjs';
import { eaPanelBridge } from './estado-actual-panel-bridge.mjs';
import { buildGluRow, syncEaGluMode, buildBombaRow } from './estado-actual-panel-glu.mjs';
import { syncGluRowAltered } from './estado-actual-panel-glu.mjs';
import { expandVitalNextLayer, syncAllVitalAddButtonVisibility, vitalLayerBoxKey } from './estado-actual-panel-vitals.mjs';
import { syncIoBalanceFromForm, applyIoNcMode } from './estado-actual-panel-registro-io.mjs';

function defaultAlteredTimeFromForm(form) {
  var recEl = form.querySelector('#ea-recorded-at');
  if (!recEl || !('value' in recEl) || !recEl.value) return '';
  var match = String(recEl.value).match(/T(\d{2}):(\d{2})/);
  if (!match) return '';
  return match[1] + ':' + match[2];
}

function syncAlteredFields(form) {
  var defaultTime = defaultAlteredTimeFromForm(form);
  function syncLayer(baseKey, layerIdx) {
    var boxKey = vitalLayerBoxKey(baseKey, layerIdx);
    var input = form.querySelector('[data-ea-vital="' + baseKey + '"][data-ea-layer-idx="' + layerIdx + '"]');
    var wrap = form.querySelector('[data-ea-altered-wrap="' + boxKey + '"]');
    var box = form.querySelector('[data-ea-vital-box="' + boxKey + '"]');
    var timeEl = form.querySelector('[data-ea-altered="' + boxKey + '"]');
    if (!input || !wrap) return;
    var val = input.value;
    var altered = String(val).trim() !== '' && isVitalAltered(baseKey, val);
    wrap.classList.toggle('ea-altered-slot--hidden', !altered);
    wrap.hidden = !altered;
    if (box) box.classList.toggle('ea-vital-box--altered', altered);
    if (altered && timeEl && 'value' in timeEl && !String(timeEl.value).trim() && defaultTime && !isTurnCloseHm(defaultTime)) {
      timeEl.value = defaultTime;
    }
  }
  form.querySelectorAll('[data-ea-vital][data-ea-layer-idx]').forEach(function (input) {
    syncLayer(input.getAttribute('data-ea-vital') || '', input.getAttribute('data-ea-layer-idx') || '0');
  });
  syncAllVitalAddButtonVisibility(form);
}

function handleFormClick(form, ev) {
  var target = /** @type {HTMLElement | null} */ (ev.target);
  if (!target || !form.contains(target)) return;
  if (target.matches('[data-ea-io-nc]') || target.closest('[data-ea-io-nc]')) {
    applyIoNcMode(form);
    return;
  }
  var addBtn = target.closest('[data-ea-vital-add]');
  if (addBtn) {
    var vitalKey = addBtn.getAttribute('data-ea-vital-add');
    if (!vitalKey) return;
    expandVitalNextLayer(form, vitalKey);
    syncAlteredFields(form);
    return;
  }
  if (target.id === 'ea-add-glu' || target.closest('#ea-add-glu')) {
    var gluList = form.querySelector('#ea-glu-list');
    if (gluList) gluList.appendChild(buildGluRow());
    return;
  }
  if (target.id === 'ea-add-bomba' || target.closest('#ea-add-bomba')) {
    var bombaList = form.querySelector('#ea-bomba-list');
    if (bombaList) bombaList.appendChild(buildBombaRow());
  }
}

function handleFormChange(form, ev) {
  var target = /** @type {HTMLElement | null} */ (ev.target);
  if (!target) return;
  if (target.id === 'ea-bomba-enabled') {
    syncEaGluMode(form);
    return;
  }
  if (target.matches('[data-ea-glu-altered]')) {
    var gluRow = target.closest('.ea-glu-row');
    if (gluRow) syncGluRowAltered(/** @type {HTMLElement} */ (gluRow));
  }
}

function handleFormInput(form, ev) {
  var target = /** @type {HTMLElement | null} */ (ev.target);
  if (!target) return;
  if (target.matches('[data-ea-vital][data-ea-layer-idx]')) syncAlteredFields(form);
  else if (target.id === 'ea-recorded-at') syncAlteredFields(form);
  else if (target.matches('[data-ea-glu-value], [data-ea-glu-rescue-units], [data-ea-glu-post-rescue-value]')) {
    var gluRow = target.closest('.ea-glu-row');
    if (gluRow) syncGluRowAltered(/** @type {HTMLElement} */ (gluRow));
  } else if (target.id === 'ea-io-ing' || target.id === 'ea-io-egr' || target.id === 'ea-io-evac') {
    syncIoBalanceFromForm(form);
  }
}

/**
 * @param {HTMLElement | null} form
 */
export function wireFormInteractions(form) {
  if (!form) return;
  if (!form.dataset.eaRegistroFormWired) {
    form.dataset.eaRegistroFormWired = '1';
    form.addEventListener('click', function (ev) {
      handleFormClick(form, ev);
    });
    form.addEventListener('change', function (ev) {
      handleFormChange(form, ev);
    });
    form.addEventListener('input', function (ev) {
      handleFormInput(form, ev);
    });
    form.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
        ev.preventDefault();
        eaPanelBridge.registrarEstadoActualMedicion();
      }
    });
  }
  syncAlteredFields(form);
  syncIoBalanceFromForm(form);
}
