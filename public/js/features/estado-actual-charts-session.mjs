import { destroyEaChartInstance } from './estado-actual-charts-chartjs.mjs';

/**
 * @typedef {{
 *   chart: object | null,
 *   tab: string,
 *   vitalFamily: string,
 *   sig: string,
 *   layoutKey: string,
 *   bundle: object | null,
 *   chartCtor: unknown,
 *   tabsWired: boolean,
 * }} EaChartsSession
 */

/**
 * @param {HTMLElement} mountEl
 * @returns {EaChartsSession}
 */
export function getEaChartsSession(mountEl) {
  if (!mountEl._eaSession) {
    mountEl._eaSession = {
      chart: null,
      tab: '',
      vitalFamily: '',
      sig: '',
      layoutKey: '',
      bundle: null,
      chartCtor: null,
      tabsWired: false,
    };
  }
  return mountEl._eaSession;
}

/**
 * @param {HTMLElement | null | undefined} mountEl
 */
export function destroyEaChartsSession(mountEl) {
  if (!mountEl) return;
  destroyEaChartInstance();
  mountEl._eaSession = null;
  mountEl._eaCharts = [];
  mountEl._eaChartSlotIds = [];
}

/**
 * @param {HTMLElement} mountEl
 * @param {string} tab
 */
export function syncEaSessionChartRefs(mountEl, tab) {
  var session = getEaChartsSession(mountEl);
  session.tab = tab;
  var chart = session.chart;
  mountEl._eaCharts = chart ? [chart] : [];
  mountEl._eaChartSlotIds =
    chart && /** @type {any} */ (chart)._eaSlotId ? [/** @type {any} */ (chart)._eaSlotId] : [];
}
