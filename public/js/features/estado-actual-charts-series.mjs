import { isVitalAltered, isGlucometriaMarkedAltered } from './estado-actual-ranges.mjs';
import { gluPointMs, isGluPointInRegistroWindow } from './estado-actual-registro-defaults.mjs';

/** @type {Record<string, string>} */
const VITAL_LABELS = {
  tas: 'TAS',
  tad: 'TAD',
  fc: 'FC',
  fr: 'FR',
  temp: 'Temp',
  sat: 'SatO₂',
};

/** @type {readonly { id: string, title: string, keys: readonly string[] }[]} */
export const VITAL_FAMILIES = [
  { id: 'hemo', title: 'Hemodinámico', keys: ['tas', 'tad', 'fc'] },
  { id: 'resp', title: 'Respiratorio', keys: ['fr', 'sat'] },
  { id: 'metab', title: 'Metabólico', keys: ['temp'] },
];

const VITAL_COLOR_TOKENS = [
  '--ea-chart-vital-1',
  '--ea-chart-vital-2',
  '--ea-chart-vital-3',
  '--ea-chart-vital-4',
  '--ea-chart-vital-5',
  '--ea-chart-vital-6',
];

const CHART_TOKEN_FALLBACKS = {
  '--ea-chart-vital-1': '#4a52e8',
  '--ea-chart-vital-2': '#c62828',
  '--ea-chart-vital-3': '#047857',
  '--ea-chart-vital-4': '#b45309',
  '--ea-chart-vital-5': '#0891b2',
  '--ea-chart-vital-6': '#7c3aed',
  '--ea-chart-glu': '#047857',
  '--ea-chart-io-ing': '#60a5fa',
  '--ea-chart-io-egr': '#f87171',
  '--ea-chart-io-balance': '#4a52e8',
  '--ea-chart-altered': '#b45309',
};

/** @type {Record<string, string> | null} */
var chartColorCache = null;

function ensureChartColorCache() {
  if (chartColorCache) return chartColorCache;
  /** @type {Record<string, string>} */
  var out = {};
  Object.keys(CHART_TOKEN_FALLBACKS).forEach(function (token) {
    var fallback = CHART_TOKEN_FALLBACKS[token] || '#4a52e8';
    if (typeof document === 'undefined') {
      out[token] = fallback;
      return;
    }
    var value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    out[token] = value || fallback;
  });
  chartColorCache = out;
  return out;
}

/**
 * @param {string} token
 * @returns {string}
 */
export function chartColor(token) {
  var cache = ensureChartColorCache();
  return cache[token] || CHART_TOKEN_FALLBACKS[token] || '#4a52e8';
}

/**
 * @param {number} index
 * @returns {string}
 */
function vitalSeriesColor(index) {
  var token = VITAL_COLOR_TOKENS[index % VITAL_COLOR_TOKENS.length];
  return chartColor(token);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatChartLabel(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatChartLocalDateTime(d);
}

/**
 * @param {Date} d
 * @returns {string}
 */
function formatChartLocalDateTime(d) {
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatChartLabelFromMs(ms) {
  if (!ms) return '';
  var d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return formatChartLocalDateTime(d);
}

/**
 * @param {unknown} v
 */
function hasIoPair(io) {
  if (!io || typeof io !== 'object') return false;
  var ing = /** @type {{ ing?: unknown, egr?: unknown }} */ (io).ing;
  var egr = /** @type {{ ing?: unknown, egr?: unknown }} */ (io).egr;
  if (ing == null || ing === '' || egr == null || egr === '') return false;
  var ingN = Number(ing);
  var egrN = Number(egr);
  return Number.isFinite(ingN) && Number.isFinite(egrN);
}

/**
 * @param {unknown[]} historial
 * @returns {unknown[]}
 */
export function historialSortedAsc(historial) {
  return historial.slice().sort(function (a, b) {
    var ra =
      typeof a === 'object' && a && 'recordedAt' in a ? String(/** @type {any} */ (a).recordedAt) : '';
    var rb =
      typeof b === 'object' && b && 'recordedAt' in b ? String(/** @type {any} */ (b).recordedAt) : '';
    return ra.localeCompare(rb);
  });
}

/**
 * @param {unknown[]} histAsc
 */
export function buildIoChartData(histAsc) {
  /** @type {string[]} */
  var labels = [];
  /** @type {number[]} */
  var ing = [];
  /** @type {number[]} */
  var egr = [];
  /** @type {number[]} */
  var turnBalance = [];
  /** @type {number[]} */
  var globalBalance = [];
  var running = 0;

  for (var i = 0; i < histAsc.length; i++) {
    var row = histAsc[i];
    if (!row || typeof row !== 'object') continue;
    var io =
      /** @type {any} */ (row).io && typeof /** @type {any} */ (row).io === 'object'
        ? /** @type {any} */ (/** @type {any} */ (row).io)
        : {};
    if (!hasIoPair(io)) continue;
    var ingN = Number(io.ing);
    var egrN = Number(io.egr);
    var turn = ingN - egrN;
    running += turn;
    labels.push(formatChartLabel(/** @type {any} */ (row).recordedAt));
    ing.push(ingN);
    egr.push(egrN);
    turnBalance.push(turn);
    globalBalance.push(running);
  }

  return { labels, ing, egr, turnBalance, globalBalance };
}

/**
 * @param {unknown[]} histAsc
 * @param {string} key
 */
export function buildVitalsSeries(histAsc, key) {
  /** @type {string[]} */
  var labels = [];
  /** @type {(number | null)[]} */
  var values = [];
  /** @type {boolean[]} */
  var alteredFlags = [];

  for (var i = 0; i < histAsc.length; i++) {
    var row = histAsc[i];
    if (!row || typeof row !== 'object') continue;
    var vit =
      /** @type {any} */ (row).vitals && typeof /** @type {any} */ (row).vitals === 'object'
        ? /** @type {any} */ (/** @type {any} */ (row).vitals)
        : {};
    var raw = vit[key];
    if (raw == null || raw === '') continue;
    var n = Number(raw);
    if (!Number.isFinite(n)) continue;
    var rowAlt =
      /** @type {any} */ (row).alteredAt && typeof /** @type {any} */ (row).alteredAt === 'object'
        ? /** @type {Record<string, string>} */ (/** @type {any} */ (row).alteredAt)
        : {};
    var altered = isVitalAltered(key, raw) || !!(rowAlt && rowAlt[key]);
    var label = formatChartLabel(/** @type {any} */ (row).recordedAt);
    if (rowAlt && rowAlt[key]) {
      label = String(rowAlt[key]) + ' · ' + label;
    }
    labels.push(label);
    values.push(n);
    alteredFlags.push(altered);
  }

  return { labels, values, alteredFlags };
}

/**
 * @param {string[]} labels
 * @param {(number | null)[]} values
 * @param {boolean[]} alteredFlags
 * @param {string} color
 */
export function lineDataset(labels, values, alteredFlags, color) {
  var hasAltered = false;
  for (var ai = 0; ai < alteredFlags.length; ai += 1) {
    if (alteredFlags[ai]) {
      hasAltered = true;
      break;
    }
  }
  if (!hasAltered) {
    return {
      label: '',
      data: values,
      borderColor: color,
      backgroundColor: color,
      pointRadius: 2,
      tension: 0,
      spanGaps: true,
    };
  }
  var alteredColor = chartColor('--ea-chart-altered');
  var pointRadius = values.map(function (_v, i) {
    return alteredFlags[i] ? 6 : 3;
  });
  var pointBackgroundColor = values.map(function (_v, i) {
    return alteredFlags[i] ? alteredColor : color;
  });
  return {
    label: '',
    data: values,
    borderColor: color,
    backgroundColor: color,
    pointRadius: pointRadius,
    pointBackgroundColor: pointBackgroundColor,
    pointBorderColor: pointBackgroundColor,
    tension: 0,
    spanGaps: true,
  };
}

/**
 * @param {unknown[]} histAsc
 * @param {readonly string[]} keys
 */
function rowHasVitalKeys(row, keys) {
  var vit =
    /** @type {any} */ (row).vitals && typeof /** @type {any} */ (row).vitals === 'object'
      ? /** @type {any} */ (/** @type {any} */ (row).vitals)
      : {};
  for (var ki = 0; ki < keys.length; ki++) {
    var raw = vit[keys[ki]];
    if (raw != null && raw !== '') return true;
  }
  return false;
}

function filterHistorialWithVitals(histAsc, keys) {
  /** @type {unknown[]} */
  var rows = [];
  for (var ri = 0; ri < histAsc.length; ri++) {
    var row = histAsc[ri];
    if (!row || typeof row !== 'object') continue;
    if (rowHasVitalKeys(row, keys)) rows.push(row);
  }
  return rows;
}

function buildVitalDatasetForKey(rows, labels, key, k) {
  /** @type {(number | null)[]} */
  var values = [];
  /** @type {boolean[]} */
  var alteredFlags = [];
  var count = 0;
  for (var j = 0; j < rows.length; j++) {
    var r2 = rows[j];
    var vit2 =
      /** @type {any} */ (r2).vitals && typeof /** @type {any} */ (r2).vitals === 'object'
        ? /** @type {any} */ (/** @type {any} */ (r2).vitals)
        : {};
    var raw2 = vit2[key];
    if (raw2 == null || raw2 === '') {
      values.push(null);
      alteredFlags.push(false);
      continue;
    }
    var n = Number(raw2);
    if (!Number.isFinite(n)) {
      values.push(null);
      alteredFlags.push(false);
      continue;
    }
    values.push(n);
    count++;
    var rowAlt =
      /** @type {any} */ (r2).alteredAt && typeof /** @type {any} */ (r2).alteredAt === 'object'
        ? /** @type {Record<string, string>} */ (/** @type {any} */ (r2).alteredAt)
        : {};
    alteredFlags.push(isVitalAltered(key, raw2) || !!(rowAlt && rowAlt[key]));
  }
  if (count < 2) return null;
  var color = vitalSeriesColor(k);
  var ds = lineDataset(labels, values, alteredFlags, color);
  ds.label = VITAL_LABELS[key] || key;
  return ds;
}

export function buildVitalsFamilyData(histAsc, keys) {
  var rows = filterHistorialWithVitals(histAsc, keys);
  if (rows.length < 2) return null;

  var labels = rows.map(function (r) {
    return formatChartLabel(/** @type {any} */ (r).recordedAt);
  });

  /** @type {object[]} */
  var datasets = [];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var ds = buildVitalDatasetForKey(rows, labels, key, k);
    if (ds) datasets.push(ds);
  }

  if (!datasets.length) return null;
  return { labels: labels, datasets: datasets };
}

/**
 * @param {Array<{ ms: number, label: string, value: number, altered: boolean }>} points
 * @param {string} recordedAt
 * @param {unknown[]} readings
 * @param {Date} [now]
 * @param {{ forCharts?: boolean } | undefined} [opts]
 */
function pushGluReadingPoints(points, recordedAt, readings, now, opts) {
  opts = opts || {};
  var forCharts = opts.forCharts === true;
  for (var g = 0; g < readings.length; g++) {
    var glu = readings[g];
    if (!glu || typeof glu !== 'object') continue;
    var val = Number(/** @type {any} */ (glu).value);
    if (!Number.isFinite(val)) continue;
    var timeHm = /** @type {any} */ (glu).time ? String(/** @type {any} */ (glu).time) : '';
    var ms = gluPointMs(recordedAt, timeHm);
    if (!forCharts && !isGluPointInRegistroWindow(ms, now)) continue;
    points.push({
      ms: ms,
      label: formatChartLabelFromMs(ms),
      value: val,
      altered: isGlucometriaMarkedAltered(/** @type {{ altered?: boolean, value?: unknown }} */ (glu)),
    });
  }
}

export function buildGluSeries(histAsc, now, seriesOpts) {
  /** @type {Array<{ ms: number, label: string, value: number, altered: boolean }>} */
  var points = [];

  for (var i = 0; i < histAsc.length; i++) {
    var row = histAsc[i];
    if (!row || typeof row !== 'object') continue;
    var recordedAt = String(/** @type {any} */ (row).recordedAt || '');
    var glus = Array.isArray(/** @type {any} */ (row).glucometrias)
      ? /** @type {any} */ (/** @type {any} */ (row).glucometrias)
      : [];
    pushGluReadingPoints(points, recordedAt, glus, now, seriesOpts);
    var bombas = Array.isArray(/** @type {any} */ (row).bombaInsulina)
      ? /** @type {any} */ (/** @type {any} */ (row).bombaInsulina)
      : [];
    pushGluReadingPoints(points, recordedAt, bombas, now, seriesOpts);
  }

  points.sort(function (a, b) {
    return a.ms - b.ms;
  });

  return {
    labels: points.map(function (p) {
      return p.label;
    }),
    values: points.map(function (p) {
      return p.value;
    }),
    alteredFlags: points.map(function (p) {
      return p.altered;
    }),
  };
}

/**
 * @param {unknown} row
 * @returns {string}
 */
function glucometriaSignature(rows) {
  return rows
    .map(function (g) {
      if (!g || typeof g !== 'object') return '';
      return String(/** @type {any} */ (g).time || '') + '@' + String(/** @type {any} */ (g).value || '');
    })
    .join(';');
}

function vitalsFingerprint(vit) {
  return (
    String(vit.tas || '') +
    '/' +
    String(vit.tad || '') +
    '/' +
    String(vit.fc || '') +
    '/' +
    String(vit.fr || '') +
    '/' +
    String(vit.temp || '') +
    '/' +
    String(vit.sat || '')
  );
}

function eaHistorialRowFingerprint(row) {
  if (!row || typeof row !== 'object') return '';
  /** @type {any} */
  var r = row;
  var vit = r.vitals && typeof r.vitals === 'object' ? r.vitals : {};
  var io = r.io && typeof r.io === 'object' ? r.io : {};
  var gluSig = glucometriaSignature(Array.isArray(r.glucometrias) ? r.glucometrias : []);
  var bombaSig = glucometriaSignature(Array.isArray(r.bombaInsulina) ? r.bombaInsulina : []);
  return (
    String(r.id || '') +
    '@' +
    String(r.recordedAt || '') +
    ':' +
    vitalsFingerprint(vit) +
    ':' +
    String(io.ing || '') +
    '/' +
    String(io.egr || '') +
    ':' +
    gluSig +
    ':' +
    bombaSig
  );
}

/**
 * @param {unknown[]} histAsc
 * @returns {string}
 */
export function buildEaChartsSignatureFromHist(histAsc) {
  var parts = ['n' + histAsc.length];
  for (var i = 0; i < histAsc.length; i += 1) {
    parts.push(eaHistorialRowFingerprint(histAsc[i]));
  }
  return parts.join('|');
}

/**
 * @param {unknown[]} hist
 * @returns {string}
 */
export function historialChartRevision(hist) {
  var n = hist.length;
  if (!n) return '0';
  var parts = ['n' + n];
  for (var i = Math.max(0, n - 4); i < n; i += 1) {
    parts.push(eaHistorialRowFingerprint(hist[i]));
  }
  return parts.join('|');
}

/**
 * @param {unknown[]} histAsc
 * @param {readonly string[]} keys
 * @returns {boolean}
 */
function countFiniteVitalValues(rows, key) {
  var count = 0;
  for (var j = 0; j < rows.length; j++) {
    var vit2 =
      /** @type {any} */ (rows[j]).vitals && typeof /** @type {any} */ (rows[j]).vitals === 'object'
        ? /** @type {any} */ (/** @type {any} */ (rows[j]).vitals)
        : {};
    var raw2 = vit2[key];
    if (raw2 == null || raw2 === '') continue;
    if (!Number.isFinite(Number(raw2))) continue;
    count += 1;
  }
  return count;
}

function scanFamilyChartReady(histAsc, keys) {
  var rows = filterHistorialWithVitals(histAsc, keys);
  if (rows.length < 2) return false;
  for (var k = 0; k < keys.length; k++) {
    if (countFiniteVitalValues(rows, keys[k]) >= 2) return true;
  }
  return false;
}

/**
 * Lightweight readiness scan — no Chart.js datasets (panel summary strip).
 * @param {unknown} monitoreo
 */
export function scanEaChartsSummary(monitoreo) {
  /** @type {any} */
  var m = monitoreo || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var histAsc = historialSortedAsc(hist);
  var vitalsReady = false;
  for (var fi = 0; fi < VITAL_FAMILIES.length; fi += 1) {
    if (scanFamilyChartReady(histAsc, VITAL_FAMILIES[fi].keys)) {
      vitalsReady = true;
      break;
    }
  }
  var gluSeries = buildGluSeries(histAsc, undefined, { forCharts: true });
  var ioData = buildIoChartData(histAsc);
  return {
    measurementCount: histAsc.length,
    vitalsReady: vitalsReady,
    gluReady: gluSeries.values.length >= 2,
    gluLatest: gluSeries.values.length ? gluSeries.values[gluSeries.values.length - 1] : null,
    gluPointCount: gluSeries.values.length,
    ioReady: ioData.labels.length >= 2,
    ioPointCount: ioData.labels.length,
    ioTurn:
      ioData.labels.length >= 2 && ioData.turnBalance.length
        ? ioData.turnBalance[ioData.turnBalance.length - 1]
        : null,
  };
}
