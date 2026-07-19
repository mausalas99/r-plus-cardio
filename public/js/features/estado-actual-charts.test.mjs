import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEaChartsLayoutKey,
  buildEaChartsSignature,
  buildEaChartsSummary,
  buildGluSeries,
  buildIoChartData,
  buildVitalsSeries,
  downsampleEaChartSeries,
  updateEstadoActualChartsInPlace,
} from './estado-actual-charts.mjs';

test('buildGluSeries labels use actual reading datetime, not recordedAt midnight', () => {
  var hist = [
    {
      recordedAt: new Date(2026, 5, 20, 0, 0, 0).toISOString(),
      glucometrias: [
        { value: 171, time: '08:00' },
        { value: 243, time: '00:00' },
        { value: 110, time: '04:00' },
      ],
    },
  ];
  var s = buildGluSeries(hist, new Date(2026, 5, 20, 13, 25, 0), { forCharts: true });
  assert.match(s.labels[0], /^19\/06 08:00$/);
  assert.match(s.labels[1], /^20\/06 00:00$/);
  assert.match(s.labels[2], /^20\/06 04:00$/);
  assert.doesNotMatch(s.labels.join('|'), / · | - \d/);
});

test('stripMonitoreoChartRuntimeCache drops persisted chart bundle', async () => {
  var { stripMonitoreoChartRuntimeCache, getCachedEaChartBundle } = await import(
    './estado-actual-charts-display.mjs'
  );
  /** @type {any} */
  var monitoreo = {
    historial: [
      {
        recordedAt: new Date(2026, 5, 19, 0, 0, 0).toISOString(),
        glucometrias: [{ value: 138, time: '16:00' }],
      },
      {
        recordedAt: new Date(2026, 5, 20, 0, 0, 0).toISOString(),
        glucometrias: [{ value: 142, time: '08:00' }],
      },
    ],
    _eaChartBundle: {
      slotData: {
        glu: { labels: ['16:00 · 19/06 00:00'], datasets: [{ data: [138] }] },
      },
    },
    _eaChartBundleRev: 'stale',
  };
  stripMonitoreoChartRuntimeCache(monitoreo);
  var bundle = getCachedEaChartBundle(monitoreo);
  assert.match(bundle.slotData.glu.labels[0], /^18\/06 16:00$/);
});

test('buildGluSeries includes all glucometrias when forCharts is true', () => {
  var now = new Date(2026, 5, 20, 13, 25, 0);
  var hist = [
    {
      recordedAt: new Date(2026, 5, 20, 0, 0, 0).toISOString(),
      glucometrias: [
        { value: 171, time: '08:00' },
        { value: 125, time: '16:00' },
        { value: 243, time: '00:00' },
        { value: 110, time: '04:00' },
      ],
    },
  ];
  var s = buildGluSeries(hist, now, { forCharts: true });
  assert.deepEqual(s.values, [171, 125, 243, 110]);
});

test('buildGluSeries only plots glucometrias from yesterday 08:00 through today 00:00', () => {
  var now = new Date(2026, 4, 28, 8, 39, 0);
  var hist = [
    {
      recordedAt: new Date(2026, 4, 27, 17, 20, 0).toISOString(),
      glucometrias: [
        { value: 190, time: '08:00' },
        { value: 280, time: '10:00' },
        { value: 221, time: '16:00' },
        { value: 136, time: '20:00' },
      ],
    },
    {
      recordedAt: new Date(2026, 4, 28, 0, 0, 0).toISOString(),
      glucometrias: [
        { value: 159, time: '00:00' },
        { value: 135, time: '08:00' },
        { value: 191, time: '12:00' },
        { value: 194, time: '16:00' },
      ],
    },
  ];
  var s = buildGluSeries(hist, now);
  assert.deepEqual(s.values, [190, 135, 280, 221, 194, 136, 159]);
});

test('buildGluSeries registro window includes 08/16 from turn-close row after gluPointMs fix', () => {
  var now = new Date(2026, 5, 20, 13, 25, 0);
  var hist = [
    {
      recordedAt: new Date(2026, 5, 20, 0, 0, 0).toISOString(),
      glucometrias: [
        { value: 171, time: '08:00' },
        { value: 125, time: '16:00' },
        { value: 243, time: '00:00' },
      ],
    },
  ];
  var s = buildGluSeries(hist, now);
  assert.deepEqual(s.values, [171, 125, 243]);
});

test('buildGluSeries includes glucometrias even when bombaInsulina is present', () => {
  var now = new Date(2026, 4, 28, 8, 39, 0);
  var hist = [
    {
      recordedAt: new Date(2026, 4, 27, 17, 20, 0).toISOString(),
      glucometrias: [
        { value: 190, time: '08:00' },
        { value: 136, time: '20:00' },
      ],
      bombaInsulina: [{ value: 175, time: '14:00', units: 2 }],
    },
  ];
  var s = buildGluSeries(hist, now);
  assert.deepEqual(s.values, [190, 175, 136]);
});

test('buildEaChartsSummary flags ready series with enough points', () => {
  const hist = [
    { recordedAt: '2026-05-26T06:00:00.000Z', vitals: { fc: 70, tas: 110 }, io: { ing: 500, egr: 300 } },
    { recordedAt: '2026-05-26T12:00:00.000Z', vitals: { fc: 88, tas: 118 }, io: { ing: 600, egr: 450 } },
  ];
  const summary = buildEaChartsSummary({ historial: hist });
  assert.equal(summary.measurementCount, 2);
  assert.equal(summary.vitalsReady, true);
  assert.equal(summary.ioReady, true);
});

test('buildIoChartData produces turn balance and global line', () => {
  const hist = [
    { recordedAt: '2026-05-26T06:00:00.000Z', io: { ing: 500, egr: 300 } },
    { recordedAt: '2026-05-26T14:00:00.000Z', io: { ing: 600, egr: 450 } },
  ];
  const d = buildIoChartData(hist);
  assert.equal(d.turnBalance[0], 200);
  assert.equal(d.globalBalance[1], 350);
});

test('buildVitalsSeries collects numeric points with altered flags', () => {
  const hist = [
    { recordedAt: '2026-05-26T08:00:00.000Z', vitals: { fc: 82 } },
    { recordedAt: '2026-05-26T12:00:00.000Z', vitals: { fc: 120 }, alteredAt: { fc: '11:40' } },
  ];
  const s = buildVitalsSeries(hist, 'fc');
  assert.equal(s.values.length, 2);
  assert.equal(s.values[1], 120);
  assert.equal(s.alteredFlags[0], false);
  assert.equal(s.alteredFlags[1], true);
});

test('downsampleEaChartSeries keeps endpoints and full series metadata', () => {
  const labels = [];
  const values = [];
  for (let i = 0; i < 150; i += 1) {
    labels.push('t' + i);
    values.push(i);
  }
  const sampled = downsampleEaChartSeries(labels, values, [], 100);
  assert.equal(sampled.labels.length, 100);
  assert.equal(sampled.values[0], 0);
  assert.equal(sampled.values[99], 149);
  assert.equal(sampled.fullLabels.length, 150);
  assert.equal(sampled.fullValues[149], 149);
});

test('updateEstadoActualChartsInPlace patches datasets without remount', () => {
  const hist = [
    { recordedAt: '2026-05-26T06:00:00.000Z', vitals: { fc: 70 } },
    { recordedAt: '2026-05-26T12:00:00.000Z', vitals: { fc: 88 } },
  ];
  const monitoreo = { historial: hist };
  const layoutKey = buildEaChartsLayoutKey(monitoreo);
  const updates = [];
  const chart = {
    data: {
      labels: ['a', 'b'],
      datasets: [{ data: [70, 80], borderColor: '#000' }],
    },
    update(mode) {
      updates.push(mode);
    },
  };
  const mountEl = {
    _eaChartInstance: chart,
    _eaChartSlotIds: ['vital:hemo'],
    _eaActiveChartTab: 'vitals',
    _eaChartsLayoutKey: layoutKey,
    _eaChartsSig: 'stale',
  };
  hist[1].vitals.fc = 95;
  const ok = updateEstadoActualChartsInPlace(mountEl, monitoreo);
  assert.equal(ok, true);
  assert.equal(chart.data.datasets[0].data[1], 95);
  assert.deepEqual(updates, ['none']);
  assert.notEqual(buildEaChartsSignature(monitoreo), 'stale');
});
