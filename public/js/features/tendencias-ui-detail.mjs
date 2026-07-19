import { notes } from '../app-state.mjs';
import { dedupeTrendSetsForSeries, getSetTrendValueForSeries, buildTendChartLabels, parseFechaLabToMs, normalizeFechaLabHistory } from '../tend-core.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from '../ui-motion.mjs';
import { TREND_DETAIL_DOWNSAMPLE } from '../lab-history-cache.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import { aid, tendStore } from './tendencias-state.mjs';
import {
  tendCardLabelParts,
  tendRefForSeries,
  tendParsedHistoryDesc,
  toTrendAscendingSets,
} from './tendencias-catalog.mjs';

function formatDMYDate(d) {
  if (!d || isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

/** Fecha aproximada desde id numérico (timestamp al guardar el set). */
function inferFechaLabSetFromId(set) {
  if (!set || set.fecha === 'Anterior') return '';
  var id = String(set.id || '');
  if (!/^\d{10,}$/.test(id)) return '';
  var ms = parseInt(id, 10);
  if (id.length === 10) ms *= 1000;
  return formatDMYDate(new Date(ms));
}

/**
 * Bloque "anterior" de estudios (líneas 0–2): suele traer la fecha en la 1.ª línea
 * o en FECHA/HORA. Si no, se usa la fecha de la nota clínica como último recurso.
 */
function tryInferDateFromLine(text) {
  var mFh = text.match(/FECHA[^\d:]*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i);
  if (mFh) {
    var nf0 = normalizeFechaLabHistory(mFh[1]);
    if (nf0 && nf0 !== 'Anterior' && parseFechaLabToMs(nf0, '') > 0) return nf0;
  }
  var mSub = text.match(/(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/);
  if (mSub) {
    var nf1 = normalizeFechaLabHistory(mSub[1]);
    if (nf1 && nf1 !== 'Anterior' && parseFechaLabToMs(nf1, '') > 0) return nf1;
  }
  var nf2 = normalizeFechaLabHistory(text);
  if (nf2 && nf2 !== 'Anterior' && parseFechaLabToMs(nf2, '') > 0) return nf2;
  return '';
}

function inferAnteriorLabDateFromNote(patientId) {
  var n = notes[patientId];
  if (!n || !n.estudios) return '';
  var lines = n.estudios.split('\n');
  for (var i = 0; i < 3 && i < lines.length; i++) {
    var t = (lines[i] || '').trim();
    if (!t) continue;
    var inferred = tryInferDateFromLine(t);
    if (inferred) return inferred;
  }
  if (!n.fecha) return '';
  var nf3 = normalizeFechaLabHistory(n.fecha);
  if (nf3 && nf3 !== 'Anterior' && parseFechaLabToMs(nf3, '') > 0) return nf3;
  return '';
}

function tendFinishRangeVbars(container, instant) {
  if (!container) return;
  var reduced = instant || rt.rpcPrefersReducedMotion();
  var apply = function () {
    var vbars = container.querySelectorAll('.tend-range-vbar');
    for (var i = 0; i < vbars.length; i++) {
      var vb = vbars[i];
      vb.classList.add('tend-vbar-ready');
      var m = vb.querySelector('.tend-range-vbar-marker');
      if (m) {
        var t = m.getAttribute('data-target-bottom');
        if (t !== null && t !== '') {
          m.style.bottom = 'max(2px, calc(' + t + '% - 5px))';
        }
      }
    }
  };
  if (reduced) apply();
  else {
    requestAnimationFrame(function () {
      requestAnimationFrame(apply);
    });
  }
}

/**
 * HTML de la barra de rango (modal de tendencia).
 * Con yBounds (eje Y del gráfico): misma escala que el chart; solo si el rango
 * orientativo intersecta lo visible; si no hay intersección, no se dibuja.
 */
function computeVbarNormsFromYBounds(low, high, latestN, yBounds) {
  var yMin = yBounds.min;
  var yMax = yBounds.max;
  var ySpan = yMax - yMin;
  var visLow = Math.max(low, yMin);
  var visHigh = Math.min(high, yMax);
  if (visHigh <= visLow) return null;
  return {
    normBottom: ((visLow - yMin) / ySpan) * 100,
    normTop: ((visHigh - yMin) / ySpan) * 100,
    pos: ((latestN - yMin) / ySpan) * 100,
  };
}

function computeVbarNormsFromSpan(low, high, latestN) {
  var span = high - low;
  var fullMin = low - span * 0.5;
  var fullMax = high + span * 0.5;
  if (fullMax <= fullMin) {
    fullMin = low;
    fullMax = high;
  }
  var range = fullMax - fullMin;
  return {
    normBottom: ((low - fullMin) / range) * 100,
    normTop: ((high - fullMin) / range) * 100,
    pos: ((latestN - fullMin) / range) * 100,
  };
}

function clampVbarNorms(normBottom, normTop, pos) {
  if (pos < 0) pos = 0;
  if (pos > 100) pos = 100;
  if (normBottom < 0) normBottom = 0;
  if (normTop > 100) normTop = 100;
  return { normBottom: normBottom, normTop: normTop, pos: pos };
}

function resolveVbarNorms(low, high, latestN, yBounds) {
  if (yBounds && isFinite(yBounds.min) && isFinite(yBounds.max) && yBounds.max > yBounds.min) {
    return computeVbarNormsFromYBounds(low, high, latestN, yBounds);
  }
  return computeVbarNormsFromSpan(low, high, latestN);
}

function tendRefVbarMarkup(ref, latest, delayMs, extraClass, yBounds) {
  extraClass = extraClass || '';
  if (!ref || !isFinite(ref[0]) || !isFinite(ref[1]) || ref[1] <= ref[0] || !isFinite(latest)) {
    return '';
  }
  var low = Number(ref[0]);
  var high = Number(ref[1]);
  var latestN = Number(latest);
  var isAb = latestN < low || latestN > high;
  var norms = resolveVbarNorms(low, high, latestN, yBounds);
  if (!norms) return '';
  var clamped = clampVbarNorms(norms.normBottom, norms.normTop, norms.pos);
  var normH = clamped.normTop - clamped.normBottom;
  if (normH <= 0) return '';
  var stateClass = isAb ? ' is-abnormal' : ' is-normal';
  var d = delayMs != null ? delayMs : 0;
  return (
    '<div class="tend-range-vbar' +
    extraClass +
    stateClass +
    '" style="--tend-vbar-delay:' +
    d +
    'ms" title="Rango de referencia (' +
    low +
    '–' +
    high +
    ') · último ' +
    latest +
    '">' +
    '<div class="tend-range-vbar-track"></div>' +
    '<div class="tend-range-vbar-norm" style="bottom:' +
    clamped.normBottom.toFixed(2) +
    '%;height:' +
    normH.toFixed(2) +
    '%"></div>' +
    '<div class="tend-range-vbar-marker" data-target-bottom="' +
    clamped.pos.toFixed(2) +
    '"></div>' +
    '</div>'
  );
}

function tendDetailChartOptions(title, unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    transitions: {
      active: { animation: { duration: 0 } },
    },
    layout: { padding: { right: 12, left: 4, top: 8, bottom: 4 } },
    interaction: { mode: 'index', intersect: false, axis: 'x' },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        position: 'nearest',
        callbacks: {
          label: function (ctx) {
            return ctx.datasetIndex === 0 ? title + ': ' + ctx.parsed.y + ' ' + unit : null;
          },
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 12 } }, offset: true },
      y: {
        ticks: { font: { size: 12 } },
        title: { display: !!unit, text: unit, font: { size: 11 } },
        grace: '5%',
      },
    },
  };
}

function updateTendDetailChartInPlace(labels, values, title, ref, latest, unit) {
  if (!tendStore.detailChart || !tendStore.detailChart.data || !tendStore.detailChart.data.datasets[0]) return false;
  tendStore.detailChart.data.labels = labels;
  tendStore.detailChart.data.datasets[0].label = title;
  tendStore.detailChart.data.datasets[0].data = values;
  tendStore.detailChart.options = tendDetailChartOptions(title, unit);
  tendStore.detailChart.update('none');
  syncTendDetailVbar(ref, latest);
  return true;
}

function tendDetailChartYBounds(chart) {
  if (!chart || !chart.scales || !chart.scales.y) return null;
  var y = chart.scales.y;
  if (!isFinite(y.min) || !isFinite(y.max) || y.max <= y.min) return null;
  return { min: y.min, max: y.max };
}

function syncTendDetailVbar(ref, latest) {
  var vbarSlot = document.getElementById('tend-detail-vbar-slot');
  if (!vbarSlot) return;
  var yBounds = tendDetailChartYBounds(tendStore.detailChart);
  vbarSlot.innerHTML = tendRefVbarMarkup(ref, latest, 0, ' tend-detail-vbar', yBounds);
  vbarSlot.setAttribute('aria-hidden', vbarSlot.innerHTML ? 'false' : 'true');
  tendFinishRangeVbars(vbarSlot, true);
}

function downsampleTrendChartSeries(labels, values, maxPoints) {
  var slots = maxPoints == null ? TREND_DETAIL_DOWNSAMPLE : maxPoints;
  if (!labels || !labels.length || labels.length <= slots) {
    return { labels: labels || [], values: values || [] };
  }
  var outL = [];
  var outV = [];
  var n = labels.length;
  for (var i = 0; i < slots; i += 1) {
    var idx = Math.round((i * (n - 1)) / (slots - 1));
    outL.push(labels[idx]);
    outV.push(values[idx]);
  }
  return { labels: outL, values: outV };
}

function openTendDetail(sectionKey, fieldKey) {
  void openTendDetailAsync(sectionKey, fieldKey);
}

function openTendDetailAsync(sectionKey, fieldKey) {
  if (!aid() || sectionKey == null || fieldKey == null) return Promise.resolve();
  var history = tendParsedHistoryDesc(aid());
  var setsDesc = dedupeTrendSetsForSeries(
    history.filter(function (s) {
      return getSetTrendValueForSeries(s, sectionKey, fieldKey) != null;
    }),
    sectionKey,
    fieldKey
  );
  if (setsDesc.length < 2) return Promise.resolve();
  var setsAsc = toTrendAscendingSets(setsDesc);
  var labels = buildTendChartLabels(setsAsc);
  var values = setsAsc.map(function (s) {
    return getSetTrendValueForSeries(s, sectionKey, fieldKey);
  });
  var sampled =
    labels.length > TREND_DETAIL_DOWNSAMPLE
      ? downsampleTrendChartSeries(labels, values, TREND_DETAIL_DOWNSAMPLE)
      : { labels: labels, values: values };
  labels = sampled.labels;
  values = sampled.values;
  var labelParts = tendCardLabelParts(sectionKey, fieldKey);
  var title = labelParts.title;
  var unit = labelParts.unit;
  var latestSet = setsDesc.length ? setsDesc[0] : null;
  var latest = latestSet ? getSetTrendValueForSeries(latestSet, sectionKey, fieldKey) : null;
  var ref = tendRefForSeries(history, sectionKey, fieldKey, latestSet);
  document.getElementById('tend-detail-title').textContent =
    title + (labelParts.unit ? ' (' + labelParts.unit + ')' : '');
  var vbarSlot = document.getElementById('tend-detail-vbar-slot');
  if (vbarSlot) {
    vbarSlot.innerHTML = '';
    vbarSlot.setAttribute('aria-hidden', 'true');
  }
  var backdrop = document.getElementById('tend-detail-backdrop');
  if (!backdrop) return;
  cancelOverlayClose(backdrop);
  backdrop.style.display = 'flex';
  var canvas = document.getElementById('tend-detail-canvas');
  if (!canvas) {
    backdrop.style.display = 'none';
    return Promise.resolve();
  }
  return loadChartJs()
    .then(function (Chart) {
      try {
        if (
          tendStore.detailChart &&
          tendStore.detailChart.canvas === canvas &&
          updateTendDetailChartInPlace(labels, values, title, ref, latest, unit)
        ) {
          return;
        }
        if (tendStore.detailChart) {
          tendStore.detailChart.destroy();
          tendStore.detailChart = null;
        }
        mountTendDetailChart(Chart, canvas, labels, values, title, ref, latest, unit);
      } catch (mountErr) {
        console.error('[R+ Tendencias] detail chart mount', mountErr);
        rt.showToast('Gráfica no disponible (error al dibujar). Recarga la app.', 'error');
        backdrop.style.display = 'none';
      }
    })
    .catch(function (err) {
      console.error('[R+ Tendencias] detail chart load', err);
      rt.showToast('Gráfica no disponible (Chart.js no cargó). Recarga la app.', 'error');
      backdrop.style.display = 'none';
    });
}

function mountTendDetailChart(Chart, canvas, labels, values, title, ref, latest, unit) {
  var datasets = [
    {
      label: title,
      data: values,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      borderWidth: 2.5,
      pointRadius: 5,
      pointBackgroundColor: '#10b981',
      tension: 0.3,
      fill: false,
    },
  ];
  tendStore.detailChart = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: tendDetailChartOptions(title, unit),
  });
  syncTendDetailVbar(ref, latest);
}

export function closeTendDetail() {
  var backdrop = document.getElementById('tend-detail-backdrop');
  closeOverlayAnimated(backdrop, function () {
    if (backdrop) backdrop.style.display = 'none';
    var vbarSlot = document.getElementById('tend-detail-vbar-slot');
    if (vbarSlot) {
      vbarSlot.innerHTML = '';
      vbarSlot.setAttribute('aria-hidden', 'true');
    }
    if (tendStore.detailChart) { tendStore.detailChart.destroy(); tendStore.detailChart = null; }
  });
}


export {
  formatDMYDate,
  inferFechaLabSetFromId,
  inferAnteriorLabDateFromNote,
  tendFinishRangeVbars,
  tendRefVbarMarkup,
  tendDetailChartOptions,
  updateTendDetailChartInPlace,
  tendDetailChartYBounds,
  syncTendDetailVbar,
  downsampleTrendChartSeries,
  openTendDetail,
  openTendDetailAsync,
};
