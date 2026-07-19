import { VITAL_FAMILIES, chartColor } from './estado-actual-charts-series.mjs';
import {
  displayGluChartData,
  displayIoChartData,
  displayVitalsFamilyData,
} from './estado-actual-charts-display.mjs';
import {
  eaChartTooltipPlugin,
  eaIoChartOptions,
  eaLineChartOptions,
  paintEaChart,
} from './estado-actual-charts-chartjs.mjs';

function defaultEaVitalFamilyId(slotData) {
  for (var i = 0; i < VITAL_FAMILIES.length; i += 1) {
    if (slotData['vital:' + VITAL_FAMILIES[i].id]) return VITAL_FAMILIES[i].id;
  }
  return VITAL_FAMILIES[0].id;
}

function markEaVitalFamilyActive(familyId) {
  var vitalsNav = document.getElementById('ea-charts-vitals-nav');
  if (!vitalsNav) return;
  vitalsNav.querySelectorAll('[data-ea-vital-family]').forEach(function (btn) {
    var on = btn.getAttribute('data-ea-vital-family') === familyId;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/** @param {HTMLElement} mountEl @param {unknown} ChartCtor @param {object} bundle @param {string} [famId] */
export function paintEaVitalsChartView(mountEl, ChartCtor, bundle, famId) {
  var canvas = document.getElementById('ea-charts-canvas');
  var titleEl = document.getElementById('ea-charts-chart-title');
  var vitalsNav = document.getElementById('ea-charts-vitals-nav');
  var slotData = bundle.slotData;
  if (!canvas) return null;

  var familyId = famId || mountEl._eaActiveVitalFamily || defaultEaVitalFamilyId(slotData);
  if (!slotData['vital:' + familyId]) familyId = defaultEaVitalFamilyId(slotData);
  mountEl._eaActiveVitalFamily = familyId;
  if (vitalsNav) {
    vitalsNav.hidden = false;
    markEaVitalFamilyActive(familyId);
  }
  var fam = VITAL_FAMILIES.find(function (f) { return f.id === familyId; });
  var raw = slotData['vital:' + familyId];
  if (!raw || !fam) return null;
  var famData = displayVitalsFamilyData(raw);
  if (titleEl) titleEl.textContent = fam.title;
  return paintEaChart(ChartCtor, canvas, {
    type: 'line',
    slotId: 'vital:' + familyId,
    data: { labels: famData.labels, datasets: famData.datasets },
    options: eaLineChartOptions(),
  });
}

/** @param {unknown} ChartCtor @param {object} bundle */
export function paintEaGluChartView(ChartCtor, bundle) {
  var canvas = document.getElementById('ea-charts-canvas');
  var titleEl = document.getElementById('ea-charts-chart-title');
  var gluRaw = bundle.slotData.glu;
  if (!canvas || !gluRaw) return null;
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

/** @param {unknown} ChartCtor @param {object} bundle */
export function paintEaIoChartView(ChartCtor, bundle) {
  var canvas = document.getElementById('ea-charts-canvas');
  var titleEl = document.getElementById('ea-charts-chart-title');
  var ioRaw = bundle.slotData.io;
  if (!canvas || !ioRaw) return null;
  var ioDisplay = displayIoChartData(ioRaw);
  if (titleEl) titleEl.textContent = 'Ingresos / egresos y balance global';
  return paintEaChart(ChartCtor, canvas, {
    type: 'bar',
    slotId: 'io',
    data: {
      labels: ioDisplay.labels,
      datasets: [
        { label: 'Ingresos', data: ioDisplay.datasets[0].data, backgroundColor: chartColor('--ea-chart-io-ing'), borderRadius: 4, order: 2 },
        { label: 'Egresos', data: ioDisplay.datasets[1].data, backgroundColor: chartColor('--ea-chart-io-egr'), borderRadius: 4, order: 2 },
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
