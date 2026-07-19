/** Estado clínico field-change helpers — extracted from estado-actual-panel-clinico.mjs */
import {
  resolveDietWeightKg,
  syncDietKcalFromWeight,
  computeDietKcalKgFromTotal,
  applyDietaSuplementoPolicy,
} from './estado-actual-data.mjs';
import { DIET_PENDING_KEYS } from './estado-actual-meds.mjs';
import { markDietAsManuallyConfirmed } from './estado-actual-meds-diet.mjs';

/**
 * @param {Record<string, unknown>} pendienteReceta
 */
export function hasDietProposal(pendienteReceta) {
  return DIET_PENDING_KEYS.some(function (k) {
    return pendienteReceta && pendienteReceta[k] && String(pendienteReceta[k]).trim();
  });
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {string} key
 * @param {string} val
 */
export function syncDietPendingField(monitoreo, key, val) {
  if (!hasDietProposal(monitoreo.pendienteReceta) || DIET_PENDING_KEYS.indexOf(key) < 0) return;
  if (!monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') {
    monitoreo.pendienteReceta = {};
  }
  monitoreo.pendienteReceta[key] = val;
}

/**
 * @param {HTMLElement | null} panel
 * @param {string} selector
 * @param {string} value
 */
function syncDomInput(panel, selector, value) {
  var input = panel && panel.querySelector(selector);
  if (input && 'value' in input) input.value = value;
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {{ peso?: unknown }} patient
 */
export function applyKcalKgFieldChange(monitoreo, patient) {
  var w = resolveDietWeightKg({
    patientPeso: patient.peso,
    pesoRef: monitoreo.estadoClinico.pesoRef,
  });
  if (!syncDietKcalFromWeight(monitoreo.estadoClinico, w)) return;
  var kcalVal = String(monitoreo.estadoClinico.kcal || '');
  syncDomInput(document.getElementById('exp-pane-estado-actual'), '[data-ea-ec="kcal"]', kcalVal);
  syncDietPendingField(monitoreo, 'kcal', kcalVal);
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {{ peso?: unknown }} patient
 */
export function applyKcalFieldChange(monitoreo, patient) {
  var w = resolveDietWeightKg({
    patientPeso: patient.peso,
    pesoRef: monitoreo.estadoClinico.pesoRef,
  });
  var kg = computeDietKcalKgFromTotal(monitoreo.estadoClinico.kcal, w);
  if (kg == null) return;
  monitoreo.estadoClinico.kcalKg = String(kg);
  syncDomInput(document.getElementById('exp-pane-estado-actual'), '[data-ea-ec="kcalKg"]', String(kg));
  syncDietPendingField(monitoreo, 'kcalKg', String(kg));
}

/**
 * @param {HTMLElement} el
 * @param {{ monitoreo?: Record<string, unknown>, peso?: unknown }} patient
 */
export function applyEstadoClinicoFieldChange(el, patient) {
  if (!patient || !patient.monitoreo || !patient.monitoreo.estadoClinico) return;
  var monitoreo = patient.monitoreo;
  var key = el.getAttribute('data-ea-ec');
  if (!key) return;
  var val = 'value' in el ? String(el.value) : '';
  monitoreo.estadoClinico[key] = val;
  if (key === 'dieta') applyDietaSuplementoPolicy(monitoreo.estadoClinico, monitoreo.pendienteReceta);
  if (DIET_PENDING_KEYS.indexOf(key) >= 0) {
    markDietAsManuallyConfirmed(monitoreo);
  } else {
    syncDietPendingField(monitoreo, key, val);
  }
  if (key === 'kcalKg') applyKcalKgFieldChange(monitoreo, patient);
  else if (key === 'kcal') applyKcalFieldChange(monitoreo, patient);
}
