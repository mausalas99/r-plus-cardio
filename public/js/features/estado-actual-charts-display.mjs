import {
  VITAL_FAMILIES,
  buildEaChartsSignatureFromHist,
  buildGluSeries,
  buildIoChartData,
  buildVitalsFamilyData,
  chartColor,
  historialChartRevision,
  historialSortedAsc,
  lineDataset,
  scanEaChartsSummary,
} from './estado-actual-charts-series.mjs';

/** Display cap (like TREND_DETAIL_DOWNSAMPLE) — full series kept for tooltips. */
const EA_CHART_DISPLAY_POINTS = 100;

/** Bump when axis/tooltip label format changes — busts persisted monitoreo._eaChartBundle. */
export const EA_CHART_CACHE_REV = 'glu-dt-v2';

/**
 * @param {unknown} monitoreo
 */
export function stripMonitoreoChartRuntimeCache(monitoreo) {
  if (!monitoreo || typeof monitoreo !== 'object') return;
  /** @type {any} */
  var m = monitoreo;
  delete m._eaChartBundle;
  delete m._eaChartBundleRev;
  delete m._eaChartsSummary;
  delete m._eaChartsSummaryRev;
}

/**
 * @param {unknown[]} hist
 * @returns {string}
 */
function eaChartCacheRev(hist) {
  return historialChartRevision(hist) + '|' + EA_CHART_CACHE_REV;
}

/**
 * @param {number} length
 * @param {number} [maxPoints]
 * @returns {number[]}
 */
function buildEaDisplayIndices(length, maxPoints) {
  var slots = maxPoints == null ? EA_CHART_DISPLAY_POINTS : maxPoints;
  if (length <= slots) {
    /** @type {number[]} */
    var all = [];
    for (var i = 0; i < length; i += 1) all.push(i);
    return all;
  }
  /** @type {number[]} */
  var out = [];
  for (var j = 0; j < slots; j += 1) {
    out.push(Math.round((j * (length - 1)) / (slots - 1)));
  }
  return out;
}

/**
 * @param {string[]} labels
 * @param {(number | null)[]} values
 * @param {boolean[]} [alteredFlags]
 * @param {number} [maxPoints]
 */
export function downsampleEaChartSeries(labels, values, alteredFlags, maxPoints) {
  var indices = buildEaDisplayIndices(labels.length, maxPoints);
  return {
    labels: indices.map(function (i) {
      return labels[i];
    }),
    values: indices.map(function (i) {
      return values[i];
    }),
    alteredFlags: alteredFlags
      ? indices.map(function (i) {
          return !!alteredFlags[i];
        })
      : [],
    sourceIndices: indices,
    fullLabels: labels,
    fullValues: values,
  };
}

/**
 * @param {object} ds
 * @param {string[]} fullLabels
 * @param {Array<number | null>} fullValues
 * @param {number[]} sourceIndices
 */
function attachEaSeriesMetadata(ds, fullLabels, fullValues, sourceIndices) {
  ds._eaFullLabels = fullLabels;
  ds._eaFullValues = fullValues;
  ds._eaSourceIndices = sourceIndices;
}

/**
 * @param {{ labels: string[], datasets: object[] }} famData
 */
export function displayVitalsFamilyData(famData) {
  if (famData.labels.length <= EA_CHART_DISPLAY_POINTS) {
    famData.datasets.forEach(function (ds) {
      var indices = buildEaDisplayIndices(famData.labels.length);
      attachEaSeriesMetadata(ds, famData.labels, ds.data, indices);
    });
    return famData;
  }
  var indices = buildEaDisplayIndices(famData.labels.length);
  var labels = indices.map(function (i) {
    return famData.labels[i];
  });
  var datasets = famData.datasets.map(function (ds) {
    var next = Object.assign({}, ds);
    next.data = indices.map(function (i) {
      return ds.data[i];
    });
    if (Array.isArray(ds.pointRadius)) {
      next.pointRadius = indices.map(function (i) {
        return ds.pointRadius[i];
      });
    }
    if (Array.isArray(ds.pointBackgroundColor)) {
      next.pointBackgroundColor = indices.map(function (i) {
        return ds.pointBackgroundColor[i];
      });
      next.pointBorderColor = next.pointBackgroundColor;
    }
    attachEaSeriesMetadata(next, famData.labels, ds.data, indices);
    return next;
  });
  return { labels: labels, datasets: datasets };
}

/**
 * @param {{ labels: string[], datasets: object[] }} gluData
 */
export function displayGluChartData(gluData) {
  var ds = gluData.datasets[0];
  if (!ds) return gluData;
  var alteredFlags = Array.isArray(gluData._alteredFlags) ? gluData._alteredFlags : [];
  var sampled = downsampleEaChartSeries(
    gluData.labels,
    /** @type {number[]} */ (ds.data),
    alteredFlags,
    EA_CHART_DISPLAY_POINTS
  );
  var nextDs = lineDataset(
    sampled.labels,
    sampled.values,
    sampled.alteredFlags,
    ds.borderColor || chartColor('--ea-chart-glu')
  );
  nextDs.label = ds.label || 'Glu (mg/dL)';
  attachEaSeriesMetadata(nextDs, sampled.fullLabels, sampled.fullValues, sampled.sourceIndices);
  return { labels: sampled.labels, datasets: [nextDs] };
}

/**
 * @param {{ labels: string[], datasets: object[] }} ioSlot
 */
export function displayIoChartData(ioSlot) {
  if (ioSlot.labels.length <= EA_CHART_DISPLAY_POINTS) return ioSlot;
  var indices = buildEaDisplayIndices(ioSlot.labels.length);
  var pick = function (arr) {
    return indices.map(function (i) {
      return arr[i];
    });
  };
  var fullLabels = ioSlot.labels;
  var fullIng = ioSlot.datasets[0].data;
  var fullEgr = ioSlot.datasets[1].data;
  var fullBal = ioSlot.datasets[2].data;
  var meta = { _eaFullLabels: fullLabels, _eaSourceIndices: indices };
  return {
    labels: pick(fullLabels),
    datasets: [
      Object.assign({ label: 'Ingresos', data: pick(fullIng) }, meta, { _eaFullValues: fullIng }),
      Object.assign({ label: 'Egresos', data: pick(fullEgr) }, meta, { _eaFullValues: fullEgr }),
      Object.assign(
        { type: 'line', label: 'Balance global', data: pick(fullBal) },
        meta,
        { _eaFullValues: fullBal }
      ),
    ],
  };
}

/**
 * @param {Record<string, { labels: string[], datasets: object[] }>} slotData
 * @param {string} slotId
 */
export function displaySlotForChart(slotData, slotId) {
  if (slotId.indexOf('vital:') === 0) {
    var fam = slotData[slotId];
    return fam ? displayVitalsFamilyData(fam) : null;
  }
  if (slotId === 'glu') {
    return slotData.glu ? displayGluChartData(slotData.glu) : null;
  }
  if (slotId === 'io') {
    return slotData.io ? displayIoChartData(slotData.io) : null;
  }
  return slotData[slotId] || null;
}

/**
 * @param {unknown} monitoreo
 * @returns {{
 *   histAsc: unknown[],
 *   slotData: Record<string, { labels: string[], datasets: object[] }>,
 *   layoutKey: string,
 *   signature: string,
 *   summary: object
 * }}
 */
function prepareEaChartBundle(monitoreo) {
  /** @type {any} */
  var m = monitoreo || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var histAsc = historialSortedAsc(hist);
  /** @type {Record<string, { labels: string[], datasets: object[] }>} */
  var slotData = {};
  var layoutParts = [];
  var vitalsReady = false;

  VITAL_FAMILIES.forEach(function (fam) {
    var famData = buildVitalsFamilyData(histAsc, fam.keys);
    layoutParts.push(fam.id + ':' + (famData ? '1' : '0'));
    if (famData) {
      vitalsReady = true;
      slotData['vital:' + fam.id] = { labels: famData.labels, datasets: famData.datasets };
    }
  });

  var gluSeries = buildGluSeries(histAsc, undefined, { forCharts: true });
  layoutParts.push('g' + gluSeries.values.length);
  if (gluSeries.values.length >= 2) {
    var gluColor = chartColor('--ea-chart-glu');
    var gluDs = lineDataset(gluSeries.labels, gluSeries.values, gluSeries.alteredFlags || [], gluColor);
    gluDs.label = 'Glu (mg/dL)';
    slotData.glu = {
      labels: gluSeries.labels,
      datasets: [gluDs],
      _alteredFlags: gluSeries.alteredFlags || [],
    };
  }

  var ioData = buildIoChartData(histAsc);
  layoutParts.push('i' + ioData.labels.length);
  if (ioData.labels.length >= 2) {
    slotData.io = {
      labels: ioData.labels,
      datasets: [
        { label: 'Ingresos', data: ioData.ing },
        { label: 'Egresos', data: ioData.egr },
        {
          type: 'line',
          label: 'Balance global',
          data: ioData.globalBalance,
        },
      ],
    };
  }

  var summary = scanEaChartsSummary(monitoreo);
  summary.vitalsReady = vitalsReady;

  return {
    histAsc: histAsc,
    slotData: slotData,
    layoutKey: layoutParts.join('|'),
    signature: buildEaChartsSignatureFromHist(histAsc),
    summary: summary,
  };
}

/**
 * @param {unknown} monitoreo
 * @returns {ReturnType<typeof prepareEaChartBundle>}
 */
export function getCachedEaChartBundle(monitoreo) {
  /** @type {any} */
  var m = monitoreo || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var rev = eaChartCacheRev(hist);
  if (m._eaChartBundle && m._eaChartBundleRev === rev) {
    return m._eaChartBundle;
  }
  var bundle = prepareEaChartBundle(monitoreo);
  m._eaChartBundleRev = rev;
  m._eaChartBundle = bundle;
  return bundle;
}

/**
 * @param {unknown} monitoreo
 */
export function getCachedEaChartsSummary(monitoreo) {
  /** @type {any} */
  var m = monitoreo || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var rev = eaChartCacheRev(hist);
  if (m._eaChartsSummary && m._eaChartsSummaryRev === rev) {
    return m._eaChartsSummary;
  }
  var summary = scanEaChartsSummary(monitoreo);
  m._eaChartsSummaryRev = rev;
  m._eaChartsSummary = summary;
  return summary;
}
