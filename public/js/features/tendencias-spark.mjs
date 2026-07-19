import { TREND_SPARK_WINDOW } from '../lab-history-cache.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { tendStore, trendSparkDomId, trendSparkChartKey } from './tendencias-state.mjs';
import { tendRefForSeries, tendCatalogSeriesKey, tendSectionIsExpanded, toTrendAscendingSets } from './tendencias-series.mjs';

function tendSeriesKeySelector(seriesKey) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return '.tend-card[data-series-key="' + CSS.escape(seriesKey) + '"]';
  }
  return '.tend-card[data-series-key="' + String(seriesKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
}

function patchTendCardsFromIndex(seriesIndex, seriesAvail) {
  var patched = 0;
  for (var i = 0; i < seriesAvail.length; i += 1) {
    var sp = seriesAvail[i];
    var key = tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey);
    var idx = seriesIndex[key];
    if (!idx) return false;
    var card = document.querySelector(tendSeriesKeySelector(key));
    if (!card) return false;
    var valEl = card.querySelector('.tend-param-value');
    if (valEl) {
      valEl.textContent = idx.latest != null ? String(idx.latest) : '—';
      valEl.classList.toggle('tend-abnormal', !!idx.isAbnormal);
    }
    card.setAttribute('data-abnormal', idx.isAbnormal ? '1' : '0');
    patched += 1;
  }
  return patched > 0;
}

function destroySparkChartEntry(ck) {
  var chart = tendStore.sparkCharts[ck];
  if (!chart) return;
  if (typeof chart.destroy === 'function') chart.destroy();
  delete tendStore.sparkCharts[ck];
}

function sparkLineColorForJob(job, history) {
  var sk2 = job.sk2;
  var fk2 = job.fk2;
  var latestSetSpark = job.setsDesc2.length ? job.setsDesc2[0] : null;
  var latestSpark = latestSetSpark
    ? getSetTrendValueForSeries(latestSetSpark, sk2, fk2)
    : null;
  var refSpark = tendRefForSeries(history, sk2, fk2, latestSetSpark);
  var isAbSpark =
    refSpark &&
    latestSpark != null &&
    (latestSpark < refSpark[0] || latestSpark > refSpark[1]);
  return isAbSpark ? '#f87171' : 'rgba(52,211,153,0.95)';
}

function sparkChartAnim(duration) {
  return rt.rpcPrefersReducedMotion() ? false : { duration: duration, easing: 'easeOutQuart' };
}

function updateSparkChartsFromJobs(sparkJobs, history) {
  for (var i = 0; i < sparkJobs.length; i += 1) {
    var job = sparkJobs[i];
    var ck = trendSparkChartKey(job.sk2, job.fk2);
    var chart = tendStore.sparkCharts[ck];
    if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
      chart.data.labels = job.labels2;
      chart.data.datasets[0].data = job.values2;
      var lineColor = sparkLineColorForJob(job, history);
      chart.data.datasets[0].borderColor = lineColor;
      chart.data.datasets[0].pointBackgroundColor = lineColor;
      chart.update('none');
    } else {
      mountOneTrendSparkChartAsync(job, history, sparkChartAnim(400));
    }
  }
}

function mountOneTrendSparkChart(job, history, chartAnim, Chart) {
  var sk2 = job.sk2;
  var fk2 = job.fk2;
  var canvas2 = document.getElementById(trendSparkDomId(sk2, fk2));
  if (!canvas2 || !Chart) return;
  var ck = trendSparkChartKey(sk2, fk2);
  var lineColor = sparkLineColorForJob(job, history);
  tendStore.sparkCharts[ck] = new Chart(canvas2, {
    type: 'line',
    data: {
      labels: job.labels2,
      datasets: [
        {
          data: job.values2,
          borderColor: lineColor,
          borderWidth: 2.25,
          pointRadius: 2,
          pointBackgroundColor: lineColor,
          tension: 0.3,
          fill: false,
          clip: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim,
      layout: { padding: { left: 6, right: 6, top: 8, bottom: 6 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false, grid: { display: false }, offset: true },
        y: { display: false, grid: { display: false }, grace: '12%' },
      },
    },
  });
}

function mountOneTrendSparkChartAsync(job, history, chartAnim) {
  void loadChartJs()
    .then(function (Chart) {
      mountOneTrendSparkChart(job, history, chartAnim, Chart);
    })
    .catch(function (err) {
      console.error('[R+ Tendencias] spark chart', err);
    });
}

function buildSparkJobsFromIndex(seriesAvail, seriesIndex, history, chartAnim) {
  var sparkJobs = [];
  for (var cj = 0; cj < seriesAvail.length; cj += 1) {
    var spec2 = seriesAvail[cj];
    var sk2 = spec2.sectionKey;
    var fk2 = spec2.fieldKey;
    if (!tendSectionIsExpanded(sk2)) continue;
    var idx = seriesIndex[tendCatalogSeriesKey(sk2, fk2)];
    if (!idx || !idx.setsDesc.length) continue;
    var sparkDesc = idx.setsDesc.slice(0, TREND_SPARK_WINDOW);
    var setsAsc2 = toTrendAscendingSets(sparkDesc);
    sparkJobs.push({
      sk2: sk2,
      fk2: fk2,
      setsDesc2: sparkDesc,
      labels2: buildTendChartLabels(setsAsc2),
      values2: setsAsc2.map(function (s) {
        return getSetTrendValueForSeries(s, sk2, fk2);
      }),
    });
  }
  function runSparkBatches(Chart) {
    var jobIndex = 0;
    var SPARK_BATCH = 8;
    function runSparkBatch() {
      var end = Math.min(jobIndex + SPARK_BATCH, sparkJobs.length);
      for (; jobIndex < end; jobIndex += 1) {
        mountOneTrendSparkChart(sparkJobs[jobIndex], history, chartAnim, Chart);
      }
      if (jobIndex < sparkJobs.length) {
        requestAnimationFrame(runSparkBatch);
        return;
      }
      tendenciasBridge.mountTendCardSortables();
      tendenciasBridge.syncTendHiddenModalIfOpen();
    }
    if (sparkJobs.length) runSparkBatch();
    else {
      tendenciasBridge.mountTendCardSortables();
      tendenciasBridge.syncTendHiddenModalIfOpen();
    }
  }

  if (!sparkJobs.length) {
    tendenciasBridge.mountTendCardSortables();
    tendenciasBridge.syncTendHiddenModalIfOpen();
    return sparkJobs;
  }

  void loadChartJs()
    .then(runSparkBatches)
    .catch(function (err) {
      console.error('[R+ Tendencias] Chart.js for sparks', err);
      tendenciasBridge.mountTendCardSortables();
      tendenciasBridge.syncTendHiddenModalIfOpen();
    });
  return sparkJobs;
}

export {
  tendSeriesKeySelector,
  patchTendCardsFromIndex,
  destroySparkChartEntry,
  sparkLineColorForJob,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  mountOneTrendSparkChartAsync,
  buildSparkJobsFromIndex,
  mountOneTrendSparkChart,
};
