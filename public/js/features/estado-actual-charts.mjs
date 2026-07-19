// Estado Actual charts — public façade. Series math in -series.mjs,
// downsampling in -display.mjs, Chart.js paint in -chartjs.mjs, tabs in -tabs.mjs.
import {
  historialChartRevision,
  scanEaChartsSummary,
} from './estado-actual-charts-series.mjs';
import {
  displaySlotForChart,
  getCachedEaChartBundle,
  getCachedEaChartsSummary,
} from './estado-actual-charts-display.mjs';
import { destroyEaChartInstance, resolveChartCtor } from './estado-actual-charts-chartjs.mjs';
import { activateEaChartTab, defaultEaChartTab, destroyAllEaTabCharts, mountEaChartsChrome, syncActiveEaChartsRef, wireEaChartsTabs } from './estado-actual-charts-tabs.mjs';

export {
  buildGluSeries,
  buildIoChartData,
  buildVitalsSeries,
  formatChartLabel,
  formatChartLabelFromMs,
  historialSortedAsc,
} from './estado-actual-charts-series.mjs';
export {
  downsampleEaChartSeries,
  stripMonitoreoChartRuntimeCache,
} from './estado-actual-charts-display.mjs';

export function destroyEstadoActualCharts(mountEl) {
  if (!mountEl) return;
  destroyAllEaTabCharts(mountEl);
  destroyEaChartInstance();
  mountEl._eaCharts = [];
  mountEl._eaChartSlotIds = [];
  mountEl._eaChartInstance = null;
  mountEl._eaChartsSig = '';
  mountEl._eaChartsLayoutKey = '';
  mountEl._eaActiveChartTab = '';
  mountEl._eaChartsTabsWired = false;
}

/**
 * @param {unknown} monitoreo
 * @returns {string}
 */
export function buildEaChartsLayoutKey(monitoreo) {
  return getCachedEaChartBundle(monitoreo).layoutKey;
}

/**
 * @param {unknown} chart
 * @param {string} slotId
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 * @returns {boolean}
 */
function patchEaChartFromSlot(chart, slotId, slotData) {
  /** @type {any} */
  var ch = chart;
  var next = displaySlotForChart(slotData, slotId);
  if (!ch || !next || !ch.data) return false;
  ch.data.labels = next.labels;
  ch.data.datasets = next.datasets;
  if (typeof ch.update === 'function') ch.update('none');
  return true;
}

export function updateEstadoActualChartsInPlace(mountEl, monitoreo, slotDataIn) {
  var slotData = slotDataIn || getCachedEaChartBundle(monitoreo).slotData;
  var chart = mountEl._eaChartInstance;
  var slotIds = mountEl._eaChartSlotIds;
  if (chart && Array.isArray(slotIds) && slotIds.length === 1) {
    if (patchEaChartFromSlot(chart, slotIds[0], slotData)) {
      syncActiveEaChartsRef(mountEl, mountEl._eaActiveChartTab || '');
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} monitoreo
 * @returns {string}
 */
export function buildEaChartsSignature(monitoreo) {
  return getCachedEaChartBundle(monitoreo).signature;
}

/**
 * @param {unknown} monitoreo
 */
export function buildEaChartsSummary(monitoreo) {
  return scanEaChartsSummary(monitoreo);
}

/**
 * @param {unknown} monitoreo
 * @returns {string}
 */
export function buildEaHistorialChartsRevision(monitoreo) {
  /** @type {any} */
  var m = monitoreo || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  return historialChartRevision(hist);
}

function eaChartsSummaryTile(label, value, hint) {
  return (
    '<div class="ea-charts-summary-tile">' +
    '<span class="ea-charts-summary-tile-label">' +
    label +
    '</span>' +
    '<span class="ea-charts-summary-tile-value">' +
    value +
    '</span>' +
    (hint ? '<span class="ea-charts-summary-tile-hint">' + hint + '</span>' : '') +
    '</div>'
  );
}

export function renderEaChartsSummarySection(monitoreo) {
  var summary = getCachedEaChartsSummary(monitoreo);
  var vitalsValue = summary.vitalsReady ? 'Listo' : '—';
  var vitalsHint = summary.vitalsReady
    ? summary.measurementCount + ' mediciones'
    : 'Mín. 2 mediciones con signos';
  var gluValue = summary.gluReady
    ? String(summary.gluLatest) + ' mg/dL'
    : summary.gluPointCount === 1
      ? '1 punto'
      : '—';
  var gluHint = summary.gluReady
    ? summary.gluPointCount + ' puntos'
    : 'Mín. 2 glucometrías';
  var ioValue =
    summary.ioReady && summary.ioTurn != null
      ? (summary.ioTurn >= 0 ? '+' : '') + summary.ioTurn + ' cc'
      : '—';
  var ioHint = summary.ioReady
    ? summary.ioPointCount + ' registros I/O'
    : 'Mín. 2 pares ingreso/egreso';
  var canOpen =
    summary.measurementCount >= 2 &&
    (summary.vitalsReady || summary.gluReady || summary.ioReady);
  return (
    '<section class="ea-section ea-charts-summary" id="ea-charts-summary">' +
    '<div class="ea-charts-summary-head">' +
    '<h3 class="ea-section-title">Gráficas de monitoreo</h3>' +
    (canOpen
      ? '<button type="button" class="ea-btn ea-btn--ghost ea-charts-open-btn" onclick="openEstadoActualChartsModal()">' +
        '<svg class="ea-charts-open-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 17l6-6 4 4 8-10"/>' +
        '<path d="M3 12l5-4 4 3 9-7"/>' +
        '</svg>' +
        '<span>Ver gráficas</span></button>'
      : '<div class="ea-charts-summary-empty" role="status">' +
        '<span class="empty-state-title">Sin datos para graficar</span>' +
        '<span class="empty-state-lead">Registra al menos 2 mediciones para ver gráficas.</span>' +
        '</div>') +
    '</div>' +
    '<div class="ea-charts-summary-grid">' +
    eaChartsSummaryTile('Signos vitales', vitalsValue, vitalsHint) +
    eaChartsSummaryTile('Glucometrías', gluValue, gluHint) +
    eaChartsSummaryTile('Balance hídrico', ioValue, ioHint) +
    '</div>' +
    '</section>'
  );
}

/**
 * @param {HTMLElement | null} mountEl
 * @param {unknown} monitoreo
 * @param {unknown} [ChartCtor]
 * @param {{ showTitle?: boolean } | undefined} [opts]
 */
function hideEaChartsEmptyState() {
  var empty = document.getElementById('ea-charts-empty');
  if (empty) empty.hidden = true;
}

export function renderEstadoActualCharts(mountEl, monitoreo, ChartCtor, _opts) {
  if (!mountEl) return;
  var bundle = getCachedEaChartBundle(monitoreo);
  var sig = bundle.signature;
  var slotData = bundle.slotData;
  var layoutKey = bundle.layoutKey;
  var Chart = resolveChartCtor(ChartCtor);

  if (mountEl._eaChartsSig === sig && mountEl._eaChartInstance) {
    mountEl._eaChartBundle = bundle;
    hideEaChartsEmptyState();
    return;
  }

  if (
    mountEl._eaChartsLayoutKey === layoutKey &&
    mountEl._eaChartsSig !== sig &&
    updateEstadoActualChartsInPlace(mountEl, monitoreo, slotData)
  ) {
    mountEl._eaChartsSig = sig;
    hideEaChartsEmptyState();
    return;
  }

  var histAsc = bundle.histAsc;
  if (histAsc.length < 2) {
    var empty = document.getElementById('ea-charts-empty');
    if (empty) {
      empty.className = 'ea-charts-empty empty-state empty-state--compact';
      empty.setAttribute('role', 'status');
      empty.innerHTML =
        '<span class="empty-state-title">Sin datos para graficar</span>' +
        '<span class="empty-state-lead">Registra al menos 2 mediciones para ver gráficas.</span>';
      empty.hidden = false;
    }
    return;
  }

  if (!Chart) return;

  hideEaChartsEmptyState();
  mountEaChartsChrome(mountEl, slotData);
  mountEl._eaChartBundle = bundle;
  wireEaChartsTabs(mountEl, bundle, Chart, layoutKey);
  activateEaChartTab(mountEl, defaultEaChartTab(slotData), bundle, Chart, layoutKey);
}
