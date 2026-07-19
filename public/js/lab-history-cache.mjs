import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
} from './tend-core.mjs';

export const TREND_SPARK_WINDOW = 5;
export const TREND_CATALOG_WINDOW = 12;
export const TREND_DETAIL_DOWNSAMPLE = 100;
export const TREND_REFRESH_DEBOUNCE_MS = 80;

/** @type {Record<string, number>} */
var _revisionByPatient = Object.create(null);

export function resetLabHistoryCacheForTests() {
  _revisionByPatient = Object.create(null);
  invalidateTrendSeriesIndexCache();
}

/** @type {{ key: string, index: object|null }} */
var _trendSeriesIndexCache = { key: '', index: null };

export function invalidateTrendSeriesIndexCache() {
  _trendSeriesIndexCache.key = '';
  _trendSeriesIndexCache.index = null;
}

export function bumpLabHistoryRevision(patientId) {
  if (patientId == null || patientId === '') return;
  var k = String(patientId);
  _revisionByPatient[k] = (_revisionByPatient[k] || 0) + 1;
  invalidateTrendSeriesIndexCache();
}

export function getLabHistoryRevision(patientId) {
  if (patientId == null || patientId === '') return 0;
  return _revisionByPatient[String(patientId)] || 0;
}

/**
 * @param {unknown[] | null | undefined} historyAsc
 * @param {'spark'|'catalog'|'full'} mode
 */
export function getTrendRenderWindow(historyAsc, mode) {
  var hist = historyAsc || [];
  if (mode === 'full') return hist.slice();
  var n = mode === 'spark' ? TREND_SPARK_WINDOW : TREND_CATALOG_WINDOW;
  if (hist.length <= n) return hist.slice();
  return hist.slice(-n);
}

export function trendCatalogSeriesKey(sectionKey, fieldKey) {
  return String(sectionKey) + '|' + String(fieldKey);
}

/**
 * @param {{
 *   catalogSpecs: Array<{ sectionKey: string, fieldKey: string }>,
 *   historyFullDesc: unknown[],
 *   windowHistoryAsc: unknown[],
 *   tendRefForSeries: (history: unknown[], sk: string, fk: string, preferSet: unknown) => [number, number] | null,
 * }} opts
 */
export function buildTrendSeriesIndex(opts) {
  var catalogSpecs = opts.catalogSpecs || [];
  var historyFullDesc = opts.historyFullDesc || [];
  var windowHistoryAsc = opts.windowHistoryAsc || [];
  var tendRefForSeries = opts.tendRefForSeries;
  var windowDesc = windowHistoryAsc.slice().reverse();
  var out = Object.create(null);

  for (var i = 0; i < catalogSpecs.length; i += 1) {
    var spec = catalogSpecs[i];
    var sk = spec.sectionKey;
    var fk = spec.fieldKey;
    var key = trendCatalogSeriesKey(sk, fk);
    var rawFull = historyFullDesc.filter(function (s) {
      return getSetTrendValueForSeries(s, sk, fk) != null;
    });
    var setsDescFull = dedupeTrendSetsForSeries(rawFull, sk, fk);
    var rawWindow = windowDesc.filter(function (s) {
      return getSetTrendValueForSeries(s, sk, fk) != null;
    });
    var setsDesc = dedupeTrendSetsForSeries(rawWindow, sk, fk);
    var latestSet = setsDescFull.length ? setsDescFull[0] : null;
    var latest = latestSet ? getSetTrendValueForSeries(latestSet, sk, fk) : null;
    var ref = tendRefForSeries(historyFullDesc, sk, fk, latestSet);
    var isAbnormal =
      ref && latest != null && (latest < ref[0] || latest > ref[1]);
    out[key] = {
      setsDesc: setsDesc,
      setsDescFull: setsDescFull,
      latest: latest,
      ref: ref,
      isAbnormal: !!isAbnormal,
    };
  }
  return out;
}

/**
 * Memoiza buildTrendSeriesIndex mientras el historial del paciente no cambia.
 * @param {string} cacheKey p. ej. `${patientId}|${revision}|${catalogLen}`
 */
export function buildTrendSeriesIndexCached(cacheKey, opts) {
  var key = String(cacheKey || '');
  if (key && _trendSeriesIndexCache.key === key && _trendSeriesIndexCache.index) {
    return _trendSeriesIndexCache.index;
  }
  var index = buildTrendSeriesIndex(opts);
  if (key) {
    _trendSeriesIndexCache.key = key;
    _trendSeriesIndexCache.index = index;
  }
  return index;
}
