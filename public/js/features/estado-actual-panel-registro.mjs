/** EA registro manual — form markup, wiring, reset. */
import { getDefaultRegistroRecordedAt } from './estado-actual-registro-defaults.mjs';
import { VITAL_KEYS } from './estado-actual-panel-constants.mjs';
import { toDatetimeLocalValue } from './estado-actual-panel-format.mjs';
import {
  fillStandardGluList,
  syncEaGluMode,
  buildBombaRow,
} from './estado-actual-panel-glu.mjs';
import {
  buildVitalStackHtml,
  syncAllVitalAddButtonVisibility,
  collapseAllVitalStacks,
} from './estado-actual-panel-vitals.mjs';
import { refreshRpcDateFields } from '../rpc-date-picker.mjs';
import { wireFormInteractions } from './estado-actual-panel-registro-wire.mjs';
import { syncIoBalanceFromForm, clearIoFields, applyIoNcMode, syncEaRegistroInsulinRescateFlag, syncEaRegistroInsulinPumpFlag } from './estado-actual-panel-registro-io.mjs';
import { prefillRegistroFormFromMonitoreo } from './estado-actual-panel-registro-prefill.mjs';
import { applyEstadoActualParsedToForm } from './estado-actual-panel-registro-apply.mjs';

export { applyEstadoActualParsedToForm };

export function buildRegistroFormMarkup() {
  var vitalFields = VITAL_KEYS.map(function (key) {
    return buildVitalStackHtml(key);
  }).join('');

  return (
    '<div class="ea-registro-shell">' +
    '<div class="ea-registro-form-scroll">' +
    '<form id="ea-form" class="ea-form ea-form--registro" onsubmit="return false;">' +
    '<p class="ea-registro-hint ea-muted">Cierre <strong>00:00</strong>. Ningún campo es obligatorio; basta un dato para registrar. Glu estándar: 08:00 y 16:00 ayer, 00:00 hoy. <span class="ea-registro-kbd-hint">⌘↵ registrar</span></p>' +
    '<label class="ea-field ea-field--datetime">' +
    '<span class="ea-label">Fecha y hora del registro</span>' +
    '<input type="datetime-local" class="ea-input rpc-datetime-input" id="ea-recorded-at" value="' +
    toDatetimeLocalValue(getDefaultRegistroRecordedAt()) +
    '">' +
    '</label>' +
    '<div class="vitals-grid ea-vitals-grid">' +
    vitalFields +
    '</div>' +
    '<div class="ea-glu-section">' +
    '<div class="ea-glu-mode-row lab-pref-row">' +
    '<span class="lab-pref-row-label" id="ea-glu-section-lbl">Glucometrías</span>' +
    '<div class="ea-glu-mode-switch">' +
    '<span class="ea-glu-mode-switch-label" id="ea-bomba-enabled-lbl">Bomba de insulina</span>' +
    '<label class="rpc-switch">' +
    '<input type="checkbox" id="ea-bomba-enabled" class="rpc-switch-input" role="switch" aria-labelledby="ea-bomba-enabled-lbl">' +
    '<span class="rpc-switch-track" aria-hidden="true"><span class="rpc-switch-thumb"></span></span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '<div id="ea-glu-normal-block" class="ea-glu-pane ea-glu-block">' +
    '<div class="ea-glu-head">' +
    '<button type="button" class="ea-btn ea-btn--ghost" id="ea-add-glu">+ Agregar</button>' +
    '</div>' +
    '<div id="ea-glu-list" class="ea-glu-list"></div>' +
    '</div>' +
    '<div id="ea-bomba-block" class="ea-glu-pane ea-glu-block ea-bomba-block ea-glu-pane--off" hidden>' +
    '<p id="ea-bomba-algoritmo-hint" class="ea-bomba-algoritmo-hint ea-muted" hidden></p>' +
    '<div class="ea-glu-head">' +
    '<button type="button" class="ea-btn ea-btn--ghost" id="ea-add-bomba">+ Agregar</button>' +
    '</div>' +
    '<div id="ea-bomba-list" class="ea-glu-list"></div>' +
    '</div>' +
    '</div>' +
    '<div class="ea-io-grid">' +
    '<label class="ea-field">' +
    '<span class="ea-label ea-label--with-action">Ingresos (cc)' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-io-nc-btn" data-ea-io-nc title="Marcar ingresos, egresos y balance como NC">NC</button>' +
    '</span>' +
    '<input type="text" class="ea-input" id="ea-io-ing" inputmode="text" autocomplete="off" placeholder="cc o NC">' +
    '</label>' +
    '<label class="ea-field ea-field--full">' +
    '<span class="ea-label">Egresos (diuresis, drenajes, nefrostomías…)</span>' +
    '<input type="text" class="ea-input" id="ea-io-egr" inputmode="text" autocomplete="off" placeholder="DIURESIS NC, DRENAJE 50 CC, NEFRO IZQ 20 CC">' +
    '</label>' +
    '<label class="ea-field">' +
    '<span class="ea-label">Evacuaciones</span>' +
    '<input type="text" class="ea-input" id="ea-io-evac" inputmode="text" autocomplete="off" placeholder="NC, cc o texto">' +
    '</label>' +
    '<div class="ea-field ea-io-balance">' +
    '<span class="ea-label">Balance turno</span>' +
    '<span id="ea-balance-turno-live" class="ea-balance-live">—</span>' +
    '</div>' +
    '</div>' +
    '</form>' +
    '</div>' +
    '<footer class="ea-registro-modal-foot">' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-registro-paste-btn" onclick="openEstadoActualPasteModal({ skipRegistro: true })">Pegar monitoreo</button>' +
    '<div class="ea-registro-modal-actions">' +
    '<button type="button" class="ea-btn ea-btn--ghost" onclick="closeEstadoActualRegistroModal()">Cancelar</button>' +
    '<button type="button" class="ea-btn ea-btn--success" onclick="registrarEstadoActualMedicion()">Registrar</button>' +
    '</div>' +
    '</footer>' +
    '</div>'
  );
}

export function wireEaRegistroForm(monitoreo) {
  var form = document.getElementById('ea-form');
  wireFormInteractions(form);
  refreshRpcDateFields(form);
  syncEaRegistroInsulinRescateFlag(form);
  syncEaRegistroInsulinPumpFlag(form, monitoreo);
  var gluList = document.getElementById('ea-glu-list');
  if (gluList && !gluList.querySelector('.ea-glu-row')) fillStandardGluList(gluList);
  var bombaList = document.getElementById('ea-bomba-list');
  if (bombaList && !bombaList.querySelector('.ea-bomba-row')) bombaList.appendChild(buildBombaRow());
  syncEaGluMode(form);
}

export function syncEaRegistroGluMode() {
  syncEaGluMode(document.getElementById('ea-form'));
}

function clearVitalFormFields(form) {
  form.querySelectorAll('[data-ea-vital]').forEach(function (el) {
    if ('value' in el) el.value = '';
  });
  form.querySelectorAll('[data-ea-altered]').forEach(function (el) {
    if ('value' in el) el.value = '';
  });
  form.querySelectorAll('.ea-altered-slot').forEach(function (el) {
    el.classList.add('ea-altered-slot--hidden');
    el.hidden = true;
  });
  form.querySelectorAll('.ea-vital-box').forEach(function (el) {
    el.classList.remove('ea-vital-box--altered');
  });
  collapseAllVitalStacks(form);
}

function resetGluAndBombaFields() {
  var gluList = document.getElementById('ea-glu-list');
  if (gluList) fillStandardGluList(gluList);
  var bombaToggle = document.getElementById('ea-bomba-enabled');
  var bombaList = document.getElementById('ea-bomba-list');
  if (bombaToggle && 'checked' in bombaToggle) bombaToggle.checked = false;
  if (bombaList) {
    bombaList.innerHTML = '';
    bombaList.appendChild(buildBombaRow());
  }
}

/**
 * @param {{ monitoreo?: ReturnType<typeof import('./estado-actual-data-model.mjs').emptyMonitoreo> } | null | undefined} [_patient]
 * @param {{ prefill?: boolean } | null | undefined} [opts]
 */
export function resetEaRegistroForm(_patient, opts) {
  opts = opts || {};
  var form = document.getElementById('ea-form');
  if (!form) return;
  clearVitalFormFields(form);
  var recorded = document.getElementById('ea-recorded-at');
  if (recorded && 'value' in recorded) recorded.value = toDatetimeLocalValue(getDefaultRegistroRecordedAt());
  clearIoFields(form);
  resetGluAndBombaFields();
  if (opts.prefill && _patient && _patient.monitoreo) prefillRegistroFormFromMonitoreo(form, _patient.monitoreo);
  syncEaRegistroInsulinPumpFlag(form, _patient && _patient.monitoreo ? _patient.monitoreo : null);
  syncEaGluMode(form);
  syncIoBalanceFromForm(form);
  syncAllVitalAddButtonVisibility(form);
}
