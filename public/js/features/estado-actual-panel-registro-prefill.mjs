/** Registro prefill helpers — extracted from estado-actual-panel-registro.mjs */
import { deriveSnapshot } from './estado-actual-data.mjs';
import {
  collectGlucometriasForRegistroWindow,
  STANDARD_GLUCOMETRIA_TIMES,
} from './estado-actual-registro-defaults.mjs';
import { buildGluRow, fillStandardGluList, syncEaGluMode, buildBombaRow } from './estado-actual-panel-glu.mjs';
import { mergeVitalSeriesFromHistorial, collectBombaInsulinaForRegistroWindow } from './estado-actual-vital-series.mjs';
import { insulinPumpAlgorithmFromMonitoreo } from './estado-actual-insulin-pump.mjs';
import { syncEaRegistroInsulinPumpFlag } from './estado-actual-panel-registro-io.mjs';
import { VITAL_KEYS } from './estado-actual-panel-constants.mjs';
import { setVitalStackFromSeries, collapseVitalStack, syncAllVitalAddButtonVisibility } from './estado-actual-panel-vitals.mjs';
import { fillIoFields } from './estado-actual-panel-registro-io.mjs';

/**
 * @param {HTMLElement} form
 * @param {unknown[]} hist
 */
export function prefillVitalsFromHistorial(form, hist) {
  VITAL_KEYS.forEach(function (key) {
    var readings = mergeVitalSeriesFromHistorial(hist, key);
    if (readings.length) setVitalStackFromSeries(form, key, readings);
    else collapseVitalStack(form, key);
  });
}

/**
 * @param {HTMLElement} form
 * @param {unknown[]} hist
 * @param {boolean} bombaOn
 */
export function prefillGluFromHistorial(form, hist, bombaOn) {
  var gluList = form.querySelector('#ea-glu-list');
  if (!gluList) return;
  if (bombaOn) {
    gluList.innerHTML = '';
    fillStandardGluList(gluList);
    return;
  }
  var glus = collectGlucometriasForRegistroWindow(hist);
  fillStandardGluList(gluList, glus);
  var standardSet = new Set(STANDARD_GLUCOMETRIA_TIMES);
  glus.forEach(function (g) {
    var t = g.time != null ? String(g.time) : '';
    if (t && !standardSet.has(t)) gluList.appendChild(buildGluRow(g));
  });
}

/**
 * @param {HTMLElement} form
 * @param {unknown[]} hist
 * @param {Record<string, unknown> | null | undefined} [monitoreo]
 */
export function prefillBombaFromHistorial(form, hist, monitoreo) {
  var bombaToggle = form.querySelector('#ea-bomba-enabled');
  var bombaList = form.querySelector('#ea-bomba-list');
  var bombas = collectBombaInsulinaForRegistroWindow(hist);
  var algFromSome = insulinPumpAlgorithmFromMonitoreo(monitoreo);
  var bombaOn = bombas.length > 0 || algFromSome != null;
  if (bombaToggle && 'checked' in bombaToggle) bombaToggle.checked = bombaOn;
  if (!bombaList) return bombaOn;
  bombaList.innerHTML = '';
  if (bombas.length) bombas.forEach(function (b) {
    bombaList.appendChild(buildBombaRow(b));
  });
  else bombaList.appendChild(buildBombaRow());
  return bombaOn;
}

/**
 * @param {HTMLElement} form
 * @param {ReturnType<typeof import('./estado-actual-data-model.mjs').emptyMonitoreo>} monitoreo
 */
export function prefillRegistroFormFromMonitoreo(form, monitoreo) {
  var hist = Array.isArray(monitoreo.historial) ? monitoreo.historial : [];
  var snap = deriveSnapshot(monitoreo);
  prefillVitalsFromHistorial(form, hist);
  fillIoFields(form, snap.io || {});
  var bombaOn = prefillBombaFromHistorial(form, hist, monitoreo);
  prefillGluFromHistorial(form, hist, bombaOn);
  syncEaRegistroInsulinPumpFlag(form, monitoreo);
  syncEaGluMode(form);
  syncAllVitalAddButtonVisibility(form);
}
