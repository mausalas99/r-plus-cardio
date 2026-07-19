import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TREND_SPARK_WINDOW,
  TREND_CATALOG_WINDOW,
  bumpLabHistoryRevision,
  buildTrendSeriesIndex,
  getLabHistoryRevision,
  getTrendRenderWindow,
  resetLabHistoryCacheForTests,
  trendCatalogSeriesKey,
} from './lab-history-cache.mjs';

test('constants match spec', () => {
  assert.equal(TREND_SPARK_WINDOW, 5);
  assert.equal(TREND_CATALOG_WINDOW, 12);
});

test('getTrendRenderWindow full returns all', () => {
  var hist = [{ id: '1' }, { id: '2' }, { id: '3' }];
  assert.deepEqual(getTrendRenderWindow(hist, 'full'), hist);
});

test('getTrendRenderWindow spark returns last 5', () => {
  var hist = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));
  var win = getTrendRenderWindow(hist, 'spark');
  assert.equal(win.length, 5);
  assert.equal(win[0].id, '3');
  assert.equal(win[4].id, '7');
});

test('getTrendRenderWindow catalog returns last 12 or shorter', () => {
  var short = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(getTrendRenderWindow(short, 'catalog'), short);
  var long = Array.from({ length: 20 }, (_, i) => ({ id: String(i) }));
  assert.equal(getTrendRenderWindow(long, 'catalog').length, 12);
});

test('bumpLabHistoryRevision is monotonic per patient', () => {
  resetLabHistoryCacheForTests();
  assert.equal(getLabHistoryRevision('p1'), 0);
  bumpLabHistoryRevision('p1');
  assert.equal(getLabHistoryRevision('p1'), 1);
  bumpLabHistoryRevision('p1');
  assert.equal(getLabHistoryRevision('p1'), 2);
  assert.equal(getLabHistoryRevision('p2'), 0);
});

function mockSet(fecha, hora, sectionKey, fieldKey, val) {
  return {
    fecha,
    hora,
    parsedBySection: { [sectionKey]: { [fieldKey]: String(val) } },
  };
}

test('buildTrendSeriesIndex latest from full history', () => {
  resetLabHistoryCacheForTests();
  var fullDesc = [
    mockSet('22/05/2026', '08:00', 'BH', 'Hb', 12),
    mockSet('21/05/2026', '08:00', 'BH', 'Hb', 11),
    mockSet('20/05/2026', '08:00', 'BH', 'Hb', 10),
  ];
  var fullAsc = fullDesc.slice().reverse();
  var catalogAsc = fullAsc.slice(-2);
  var specs = [{ sectionKey: 'BH', fieldKey: 'Hb' }];
  var idx = buildTrendSeriesIndex({
    catalogSpecs: specs,
    historyFullDesc: fullDesc,
    windowHistoryAsc: catalogAsc,
    tendRefForSeries: function () { return null; },
  });
  var key = trendCatalogSeriesKey('BH', 'Hb');
  assert.ok(idx[key]);
  assert.equal(idx[key].latest, 12);
  assert.equal(idx[key].setsDesc.length, 2);
  assert.equal(idx[key].setsDescFull.length, 3);
});

test('trendCatalogSeriesKey format', () => {
  assert.equal(trendCatalogSeriesKey('BH', 'Hb'), 'BH|Hb');
});
