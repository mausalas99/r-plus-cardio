import { VITAL_FAMILIES, chartColor } from './estado-actual-charts-series.mjs';
import {
  displayGluChartData,
  displayIoChartData,
  displayVitalsFamilyData,
} from './estado-actual-charts-display.mjs';
import {
  destroyEaChartInstance,
  eaChartTooltipPlugin,
  eaIoChartOptions,
  eaLineChartOptions,
  paintEaChart,
  resolveChartCtor,
} from './estado-actual-charts-chartjs.mjs';

function getCanvas() {
  return /** @type {HTMLCanvasElement | null} */ (document.getElementById('ea-charts-canvas'));
}

function getTabNav() {
  return document.getElementById('ea-charts-tab-nav');
}

function getVitalsNav() {
  return document.getElementById('ea-charts-vitals-nav');
}

function getChartTitle() {
  return document.getElementById('ea-charts-chart-title');
}

function getEmptyEl() {
  return document.getElementById('ea-charts-empty');
}

/**
 * @param {HTMLElement} mountEl
 */
export function destroyAllEaTabCharts(_mountEl) {
  destroyEaChartInstance();
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 * @param {string} tab
 */
export function eaChartTabHasData(slotData, tab) {
  if (tab === 'vitals') {
    return VITAL_FAMILIES.some(function (fam) {
      return !!slotData['vital:' + fam.id];
    });
  }
  if (tab === 'glu') return !!slotData.glu;
  if (tab === 'io') return !!slotData.io;
  return false;
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 */
export function defaultEaChartTab(slotData) {
  if (eaChartTabHasData(slotData, 'vitals')) return 'vitals';
  if (eaChartTabHasData(slotData, 'glu')) return 'glu';
  return 'io';
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 */
function defaultEaVitalFamilyId(slotData) {
  for (var i = 0; i < VITAL_FAMILIES.length; i += 1) {
    if (slotData['vital:' + VITAL_FAMILIES[i].id]) return VITAL_FAMILIES[i].id;
  }
  return '';
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 */
export function buildEaChartsTabNav(slotData) {
  var tabs = [
    { id: 'vitals', label: 'Signos vitales' },
    { id: 'glu', label: 'Glucometrías' },
    { id: 'io', label: 'Balance hídrico' },
  ];
  return tabs
    .map(function (t) {
      var has = eaChartTabHasData(slotData, t.id);
      return (
        '<button type="button" role="tab" class="ea-charts-tab" data-ea-chart-tab="' +
        t.id +
        '" aria-selected="false"' +
        (has ? '' : ' disabled') +
        '>' +
        t.label +
        '</button>'
      );
    })
    .join('');
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 */
function buildEaVitalsFamilyNav(slotData) {
  return VITAL_FAMILIES.filter(function (fam) {
    return !!slotData['vital:' + fam.id];
  })
    .map(function (fam) {
      return (
        '<button type="button" role="tab" class="ea-vitals-family-btn" data-ea-vital-family="' +
        fam.id +
        '" aria-selected="false">' +
        fam.title +
        '</button>'
      );
    })
    .join('');
}

/**
 * @param {string} famId
 */
function markEaVitalFamilyActive(famId) {
  var nav = getVitalsNav();
  if (!nav) return;
  nav.querySelectorAll('[data-ea-vital-family]').forEach(function (btn) {
    var active = btn.getAttribute('data-ea-vital-family') === famId;
    btn.classList.toggle('ea-vitals-family-btn--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/**
 * @param {string} tab
 */
function markEaTabActive(tab) {
  var nav = getTabNav();
  if (!nav) return;
  nav.querySelectorAll('.ea-charts-tab').forEach(function (btn) {
    var active = btn.getAttribute('data-ea-chart-tab') === tab;
    btn.classList.toggle('ea-charts-tab--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/**
 * @param {HTMLElement} mountEl
 * @param {string} tab
 */
export function syncActiveEaChartsRef(mountEl, tab) {
  var chart = mountEl._eaChartInstance;
  mountEl._eaCharts = chart ? [chart] : [];
  mountEl._eaChartSlotIds = chart && chart._eaSlotId ? [chart._eaSlotId] : [];
  mountEl._eaActiveChartTab = tab;
}

/**
 * @param {HTMLElement} mountEl
 * @param {unknown} ChartCtor
 * @param {string} [famId]
 * @param {{ slotData: Record<string, { labels: string[], datasets: object[] }> }} bundle
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement|null} titleEl
 * @param {HTMLElement|null} vitalsNav
 */
function paintEaVitalsTab(mountEl, ChartCtor, famId, bundle, canvas, titleEl, vitalsNav) {
  var slotData = bundle.slotData;
  var familyId = famId || mountEl._eaActiveVitalFamily || defaultEaVitalFamilyId(slotData);
  if (!slotData['vital:' + familyId]) familyId = defaultEaVitalFamilyId(slotData);
  mountEl._eaActiveVitalFamily = familyId;
  if (vitalsNav) {
    vitalsNav.hidden = false;
    markEaVitalFamilyActive(familyId);
  }
  var fam = VITAL_FAMILIES.find(function (f) {
    return f.id === familyId;
  });
  var raw = slotData['vital:' + familyId];
  if (!raw || !fam) return;
  var famData = displayVitalsFamilyData(raw);
  if (titleEl) titleEl.textContent = fam.title;
  mountEl._eaChartInstance = paintEaChart(ChartCtor, canvas, {
    type: 'line',
    slotId: 'vital:' + familyId,
    data: { labels: famData.labels, datasets: famData.datasets },
    options: eaLineChartOptions(),
  });
}

function paintEaGluTab(ChartCtor, bundle, canvas, titleEl) {
  var gluRaw = bundle.slotData.glu;
  if (!gluRaw) return;
  var gluDisplay = displayGluChartData(gluRaw);
  if (titleEl) titleEl.textContent = 'Serie temporal';
  return paintEaChart(ChartCtor, canvas, {
    type: 'line',
    slotId: 'glu',
    data: gluDisplay,
    options: eaLineChartOptions({
      plugins: Object.assign({ legend: { display: false } }, eaChartTooltipPlugin()),
      scales: {
        y: { grace: '5%', title: { display: true, text: 'mg/dL', font: { size: 11 } } },
        x: { ticks: { maxRotation: 0, font: { size: 10 }, autoSkip: true, maxTicksLimit: 12 } },
      },
    }),
  });
}

function paintEaIoTab(ChartCtor, bundle, canvas, titleEl) {
  var ioRaw = bundle.slotData.io;
  if (!ioRaw) return;
  var ioDisplay = displayIoChartData(ioRaw);
  if (titleEl) titleEl.textContent = 'Ingresos / egresos y balance global';
  return paintEaChart(ChartCtor, canvas, {
    type: 'bar',
    slotId: 'io',
    data: {
      labels: ioDisplay.labels,
      datasets: [
        {
          label: 'Ingresos',
          data: ioDisplay.datasets[0].data,
          backgroundColor: chartColor('--ea-chart-io-ing'),
          borderRadius: 4,
          order: 2,
        },
        {
          label: 'Egresos',
          data: ioDisplay.datasets[1].data,
          backgroundColor: chartColor('--ea-chart-io-egr'),
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: 'Balance global',
          data: ioDisplay.datasets[2].data,
          borderColor: chartColor('--ea-chart-io-balance'),
          backgroundColor: chartColor('--ea-chart-io-balance'),
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.25,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    },
    options: eaIoChartOptions(),
  });
}

/**
 * @param {HTMLElement} mountEl
 * @param {unknown} ChartCtor
 * @param {string} tab
 * @param {string} [famId]
 * @param {{ slotData: Record<string, { labels: string[], datasets: object[] }> }} bundle
 */
function paintEaChartView(mountEl, ChartCtor, tab, famId, bundle) {
  var canvas = getCanvas();
  var titleEl = getChartTitle();
  var emptyEl = getEmptyEl();
  var vitalsNav = getVitalsNav();
  if (!canvas) return;

  if (emptyEl) emptyEl.hidden = true;
  canvas.hidden = false;

  if (tab === 'vitals') {
    paintEaVitalsTab(mountEl, ChartCtor, famId, bundle, canvas, titleEl, vitalsNav);
    return;
  }

  if (vitalsNav) vitalsNav.hidden = true;
  if (tab === 'glu') {
    mountEl._eaChartInstance = paintEaGluTab(ChartCtor, bundle, canvas, titleEl);
    return;
  }
  if (tab === 'io') {
    mountEl._eaChartInstance = paintEaIoTab(ChartCtor, bundle, canvas, titleEl);
  }
}

/**
 * @param {HTMLElement} mountEl
 * @param {string} tab
 * @param {{ slotData: Record<string, { labels: string[], datasets: object[] }>, signature: string }} bundle
 * @param {unknown} ChartCtor
 * @param {string} layoutKey
 */
export function activateEaChartTab(mountEl, tab, bundle, ChartCtor, layoutKey) {
  if (!mountEl || !resolveChartCtor(ChartCtor) || !eaChartTabHasData(bundle.slotData, tab)) return;
  markEaTabActive(tab);
  paintEaChartView(mountEl, ChartCtor, tab, undefined, bundle);
  syncActiveEaChartsRef(mountEl, tab);
  mountEl._eaChartsLayoutKey = layoutKey;
  mountEl._eaChartsSig = bundle.signature;
}

/**
 * @param {HTMLElement} mountEl
 * @param {{ slotData: Record<string, { labels: string[], datasets: object[] }>, signature: string }} bundle
 * @param {unknown} ChartCtor
 * @param {string} layoutKey
 */
export function wireEaChartsTabs(mountEl, bundle, ChartCtor, layoutKey) {
  mountEl._eaChartBundle = bundle;
  mountEl._eaChartLayoutKey = layoutKey;
  mountEl._eaChartCtor = ChartCtor;
  if (mountEl._eaChartsTabsWired) return;
  mountEl._eaChartsTabsWired = true;

  mountEl.addEventListener('click', function (ev) {
    var target = /** @type {HTMLElement | null} */ (ev.target);
    if (!target || typeof target.closest !== 'function') return;
    var liveBundle = mountEl._eaChartBundle || bundle;
    var liveChart = mountEl._eaChartCtor || resolveChartCtor(null);
    var liveLayoutKey = mountEl._eaChartLayoutKey || layoutKey;

    var famBtn = /** @type {HTMLElement | null} */ (target.closest('[data-ea-vital-family]'));
    if (famBtn && !famBtn.disabled) {
      var famId = famBtn.getAttribute('data-ea-vital-family');
      if (famId && famId !== mountEl._eaActiveVitalFamily) {
        paintEaChartView(mountEl, liveChart, 'vitals', famId, liveBundle);
        syncActiveEaChartsRef(mountEl, 'vitals');
      }
      return;
    }

    var btn = /** @type {HTMLElement | null} */ (target.closest('[data-ea-chart-tab]'));
    if (!btn || btn.disabled) return;
    var tab = btn.getAttribute('data-ea-chart-tab');
    if (!tab || tab === mountEl._eaActiveChartTab) return;
    activateEaChartTab(mountEl, tab, liveBundle, liveChart, liveLayoutKey);
  });
}

/**
 * @param {HTMLElement} mountEl
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 */
export function mountEaChartsChrome(mountEl, slotData) {
  var tabNav = getTabNav();
  var vitalsNav = getVitalsNav();
  if (tabNav) tabNav.innerHTML = buildEaChartsTabNav(slotData);
  if (vitalsNav) vitalsNav.innerHTML = buildEaVitalsFamilyNav(slotData);
}

/** @deprecated tab shell panels — canvas lives in index.html */
export function buildEaChartsTabShell() {
  return '';
}
