/** Apply parsed EA paste to registro form — extracted from estado-actual-panel-registro.mjs */
import { ensureMonitoreo } from './estado-actual-data.mjs';
import { getVitalExtraStorageKey } from './estado-actual-vital-extras.mjs';
import { STANDARD_GLUCOMETRIA_TIMES } from './estado-actual-registro-defaults.mjs';
import { MAX_VITAL_LAYERS_IN_FORM } from './estado-actual-vital-series.mjs';
import { VITAL_KEYS } from './estado-actual-panel-constants.mjs';
import { buildGluRow, fillStandardGluList } from './estado-actual-panel-glu.mjs';
import { setVitalStackFromSeries } from './estado-actual-panel-vitals.mjs';
import { fillIoFields } from './estado-actual-panel-registro-io.mjs';
import { syncIoBalanceFromForm } from './estado-actual-panel-registro-io.mjs';
import { findActivePatient } from './estado-actual-panel-core.mjs';
import { persistEstadoClinicoLight } from './estado-actual-panel-clinico.mjs';

/**
 * @param {HTMLElement} form
 * @param {Record<string, unknown>} vitals
 * @param {Record<string, string>} alteredAt
 */
function applyParsedVitals(form, vitals, alteredAt) {
  VITAL_KEYS.forEach(function (key) {
    /** @type {Array<{ value: number, time?: string }>} */
    var readings = [];
    if (vitals[key] != null && vitals[key] !== '') {
      readings.push({ value: Number(vitals[key]), time: alteredAt[key] ? String(alteredAt[key]) : undefined });
    }
    var extraKey = getVitalExtraStorageKey(key);
    if (vitals[extraKey] != null && vitals[extraKey] !== '') {
      readings.push({
        value: Number(vitals[extraKey]),
        time: alteredAt[extraKey] ? String(alteredAt[extraKey]) : undefined,
      });
    }
    setVitalStackFromSeries(form, key, readings.slice(0, MAX_VITAL_LAYERS_IN_FORM));
  });
}

/**
 * @param {HTMLElement} form
 * @param {Array<{ time?: string }>} glucometrias
 */
function applyParsedGlus(form, glucometrias) {
  var gluList = form.querySelector('#ea-glu-list');
  if (!gluList || !glucometrias.length) return;
  var standardSet = new Set(STANDARD_GLUCOMETRIA_TIMES);
  var standardGlus = [];
  var extraGlus = [];
  glucometrias.forEach(function (g) {
    var t = g.time != null ? String(g.time) : '';
    if (t && standardSet.has(t)) standardGlus.push(g);
    else extraGlus.push(g);
  });
  fillStandardGluList(gluList, standardGlus);
  extraGlus.forEach(function (g) {
    gluList.appendChild(buildGluRow(g));
  });
}

/**
 * @param {string | undefined} soporteHint
 */
function applyParsedSoporte(soporteHint) {
  if (!soporteHint) return;
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  if (!patient.monitoreo.estadoClinico) patient.monitoreo.estadoClinico = {};
  patient.monitoreo.estadoClinico.soporte = soporteHint;
  var soporteSel = document.querySelector('[data-ea-ec="soporte"]');
  if (soporteSel && 'value' in soporteSel) soporteSel.value = soporteHint;
  persistEstadoClinicoLight(patient.monitoreo, patient);
}

/**
 * @param {ReturnType<typeof import('./estado-actual-parser.mjs').parseEstadoActualPaste>} parsed
 */
export function applyEstadoActualParsedToForm(parsed) {
  var form = document.getElementById('ea-form');
  if (!form || !parsed || !parsed.ok) return;
  applyParsedVitals(form, parsed.vitals, parsed.alteredAt);
  applyParsedGlus(form, parsed.glucometrias);
  fillIoFields(form, parsed.io);
  syncIoBalanceFromForm(form);
  applyParsedSoporte(parsed.soporteHint);
}
