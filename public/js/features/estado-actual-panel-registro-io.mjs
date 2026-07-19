/** Registro IO / prefill helpers — extracted from estado-actual-panel-registro.mjs */
import {
  parseIoEgresoLine,
  parseIoIngresoField,
  serializeEgrPartsToFormText,
  diuresisValueFromParts,
  formatIoBalanceDisplay,
} from './estado-actual-io.mjs';
import { patientHasInsulinRescatesInReceta } from './estado-actual-glu-rescue.mjs';
import { patientHasInsulinPumpInReceta } from '../insulin-pump-some-detect.mjs';
import { insulinPumpAlgorithmFromMonitoreo } from './estado-actual-insulin-pump.mjs';
import { medRecetaByPatient } from '../app-state.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';

/**
 * @param {HTMLElement | null} form
 */
export function syncEaRegistroInsulinRescateFlag(form) {
  if (!form) return;
  var activeId = getEaPanelRuntime().getActiveId();
  var block = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  var hasRescates = patientHasInsulinRescatesInReceta(block);
  form.classList.toggle('ea-form--no-insulin-rescates', !hasRescates);
}

/**
 * Marca el formulario cuando SOME indica bomba de insulina (algoritmo activo).
 * @param {HTMLElement | null} form
 * @param {Record<string, unknown> | null | undefined} [monitoreo]
 */
export function syncEaRegistroInsulinPumpFlag(form, monitoreo) {
  if (!form) return;
  var activeId = getEaPanelRuntime().getActiveId();
  var block = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  var alg = insulinPumpAlgorithmFromMonitoreo(monitoreo);
  var hasPump = alg != null || patientHasInsulinPumpInReceta(block);
  form.classList.toggle('ea-form--insulin-pump-some', hasPump);
  var algEl = form.querySelector('#ea-bomba-algoritmo-hint');
  if (algEl) {
    algEl.textContent = alg != null ? 'BOMBA DE INSULINA EN ALGORITMO ' + alg : '';
    algEl.hidden = alg == null;
  }
}

/**
 * @param {HTMLElement | null} form
 */
export function applyIoNcMode(form) {
  if (!form) return;
  var ingEl = form.querySelector('#ea-io-ing');
  var egrEl = form.querySelector('#ea-io-egr');
  if (ingEl && 'value' in ingEl) ingEl.value = 'NC';
  if (egrEl && 'value' in egrEl) egrEl.value = 'DIURESIS NC';
  syncIoBalanceFromForm(form);
}

/**
 * @param {HTMLElement | null} form
 */
export function syncIoBalanceFromForm(form) {
  if (!form) return;
  var ingEl = form.querySelector('#ea-io-ing');
  var egrEl = form.querySelector('#ea-io-egr');
  var out = form.querySelector('#ea-balance-turno-live');
  if (!ingEl || !egrEl || !out) return;
  var ing = parseIoIngresoField(ingEl.value);
  if (ing === 'NC' && String(egrEl.value || '').trim().toUpperCase() !== 'DIURESIS NC') {
    egrEl.value = 'DIURESIS NC';
  }
  var egrParts = parseIoEgresoLine(egrEl.value);
  out.textContent = formatIoBalanceDisplay(ing, { ing: ing, egrParts: egrParts, egr: diuresisValueFromParts(egrParts) });
}

/**
 * @param {HTMLElement | null} egrEl
 * @param {{ egrParts?: unknown[], egr?: unknown }} io
 */
export function fillEgrField(egrEl, io) {
  if (!egrEl || !('value' in egrEl)) return;
  if (io.egrParts && io.egrParts.length) {
    egrEl.value = serializeEgrPartsToFormText(io.egrParts);
  } else if (io.egr != null && io.egr !== '') {
    egrEl.value = typeof io.egr === 'number' ? String(io.egr) : String(io.egr);
  }
}

/**
 * @param {HTMLElement | null} evacEl
 * @param {unknown} evac
 */
export function fillEvacField(evacEl, evac) {
  if (!evacEl || evac == null || evac === '' || !('value' in evacEl)) return;
  evacEl.value = typeof evac === 'number' ? String(evac) : String(evac);
}

/**
 * @param {HTMLElement} form
 * @param {{ ing?: unknown, egr?: unknown, egrParts?: unknown[], evac?: unknown }} io
 */
export function fillIoFields(form, io) {
  io = io || {};
  var ingEl = form.querySelector('#ea-io-ing');
  var egrEl = form.querySelector('#ea-io-egr');
  var evacEl = form.querySelector('#ea-io-evac');
  if (ingEl && io.ing != null && io.ing !== '' && 'value' in ingEl) ingEl.value = String(io.ing);
  fillEgrField(egrEl, io);
  fillEvacField(evacEl, io.evac);
}

/**
 * @param {HTMLElement} form
 */
export function clearIoFields(form) {
  var ing = form.querySelector('#ea-io-ing');
  var egr = form.querySelector('#ea-io-egr');
  var evac = form.querySelector('#ea-io-evac');
  if (ing && 'value' in ing) ing.value = '';
  if (egr && 'value' in egr) egr.value = '';
  if (evac && 'value' in evac) evac.value = '';
}
