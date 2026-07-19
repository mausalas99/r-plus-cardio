import { TREND_SPARK_WINDOW } from '../lab-history-cache.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { scheduleIdle } from '../deferred-work.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { tendStore, trendSparkDomId } from './tendencias-state.mjs';
import { destroySparkChartEntry, sparkChartAnim, mountOneTrendSparkChart } from './tendencias-spark.mjs';
import { tendCatalogSeriesKey, toTrendAscendingSets } from './tendencias-catalog.mjs';

var TEND_SECTION_EXPANDED_LS = 'rpc-tend-sections-expanded';

function tendSectionExpandedRead() {
  try {
    var raw = localStorage.getItem(TEND_SECTION_EXPANDED_LS);
    if (!raw) return {};
    var o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function tendSectionExpandedWrite(map) {
  try {
    localStorage.setItem(TEND_SECTION_EXPANDED_LS, JSON.stringify(map || {}));
  } catch (_e) { void _e; }
}

/** @param {string} sectionKey */
function tendSectionIsExpanded(sectionKey) {
  var m = tendSectionExpandedRead();
  if (!Object.prototype.hasOwnProperty.call(m, sectionKey)) return true;
  return m[sectionKey] !== false;
}

function destroySparkChartsForSection(sectionKey) {
  var prefix = String(sectionKey) + '\x01';
  Object.keys(tendStore.sparkCharts).forEach(function (ck) {
    if (!ck.startsWith(prefix)) return;
    destroySparkChartEntry(ck);
  });
}

function mountSectionSparkCharts(sectionKey, history, chartAnim) {
  var seriesIndex = tendStore._tendRenderState.seriesIndex;
  var seriesAvail = tendStore._tendRenderState.seriesAvail;
  if (!seriesIndex || !seriesAvail) return;
  var jobs = [];
  for (var i = 0; i < seriesAvail.length; i += 1) {
    var spec = seriesAvail[i];
    if (spec.sectionKey !== sectionKey) continue;
    var sk2 = spec.sectionKey;
    var fk2 = spec.fieldKey;
    var idx = seriesIndex[tendCatalogSeriesKey(sk2, fk2)];
    if (!idx || !idx.setsDesc.length) continue;
    var sparkDesc = idx.setsDesc.slice(0, TREND_SPARK_WINDOW);
    var setsAsc2 = toTrendAscendingSets(sparkDesc);
    jobs.push({
      sk2: sk2,
      fk2: fk2,
      setsDesc2: sparkDesc,
      labels2: buildTendChartLabels(setsAsc2),
      values2: setsAsc2.map(function (s) {
        return getSetTrendValueForSeries(s, sk2, fk2);
      }),
    });
  }
  if (!jobs.length) return;
  void loadChartJs().then(function (Chart) {
    var jobIndex = 0;
    var SPARK_BATCH = 8;
    function runBatch() {
      var end = Math.min(jobIndex + SPARK_BATCH, jobs.length);
      for (; jobIndex < end; jobIndex += 1) {
        mountOneTrendSparkChart(jobs[jobIndex], history, chartAnim, Chart);
      }
      if (jobIndex < jobs.length) scheduleIdle(runBatch, 24);
    }
    runBatch();
  });
}

function applyTendSectionExpandedState(sectionEl, sectionKey, expanded) {
  var btn = sectionEl.querySelector('.tend-section-toggle');
  var body = sectionEl.querySelector('.tend-section-body');
  var chevron = sectionEl.querySelector('.tend-section-chevron');
  if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (chevron) chevron.textContent = expanded ? '▼' : '▶';
  if (body) body.classList.toggle('tend-section-body--collapsed', !expanded);

  if (!expanded) {
    destroySparkChartsForSection(sectionKey);
    sectionEl.querySelectorAll('.tend-spark-canvas-cell').forEach(function (cell) {
      if (cell.querySelector('canvas')) {
        cell.innerHTML = '<div class="tend-spark-placeholder" aria-hidden="true"></div>';
      }
    });
    return;
  }

  sectionEl.querySelectorAll('.tend-card').forEach(function (card) {
    var seriesKey = card.getAttribute('data-series-key');
    if (!seriesKey) return;
    var pipe = seriesKey.indexOf('|');
    if (pipe < 0) return;
    var sk = seriesKey.slice(0, pipe);
    var fk = seriesKey.slice(pipe + 1);
    var cell = card.querySelector('.tend-spark-canvas-cell');
    if (!cell || cell.querySelector('canvas')) return;
    cell.innerHTML = '<canvas id="' + trendSparkDomId(sk, fk) + '"></canvas>';
  });

  mountSectionSparkCharts(sectionKey, null, sparkChartAnim(400));
}

function toggleTendSection(ev, sectionKey) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var m = tendSectionExpandedRead();
  var cur = tendSectionIsExpanded(sectionKey);
  var next = !cur;
  m[sectionKey] = next;
  tendSectionExpandedWrite(m);

  var container = document.getElementById('tendencias-container');
  var sectionEl =
    container &&
    container.querySelector('.tend-section[data-section="' + String(sectionKey).replace(/"/g, '\\"') + '"]');
  if (sectionEl && container.querySelector('.tend-grid') && tendStore._tendRenderState.seriesIndex) {
    applyTendSectionExpandedState(sectionEl, sectionKey, next);
    return;
  }
  tendenciasBridge.renderTendencias();
}

/** Título y unidad para tarjeta spark (evita «%» duplicado en título y unidad). */
export {
  tendSectionExpandedRead,
  tendSectionExpandedWrite,
  tendSectionIsExpanded,
  destroySparkChartsForSection,
  mountSectionSparkCharts,
  applyTendSectionExpandedState,
  toggleTendSection,
};
