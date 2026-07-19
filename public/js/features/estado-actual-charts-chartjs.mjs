/** Chart height is set in CSS (.ea-charts-canvas-cell); Chart.js fills that box. */

/** @type {any} */
var eaChartInstance = null;

/**
 * @param {unknown} ChartCtor
 * @returns {unknown}
 */
export function resolveChartCtor(ChartCtor) {
  if (ChartCtor) return ChartCtor;
  if (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).Chart) {
    return /** @type {any} */ (globalThis).Chart;
  }
  if (typeof window !== 'undefined' && /** @type {any} */ (window).Chart) {
    return /** @type {any} */ (window).Chart;
  }
  return null;
}

export function destroyEaChartInstance() {
  if (eaChartInstance) {
    try {
      eaChartInstance.destroy();
    } catch (_e) { void _e; }
    eaChartInstance = null;
  }
}

export function eaChartTooltipPlugin() {
  return {
    tooltip: {
      animation: false,
      mode: 'index',
      intersect: false,
      position: 'nearest',
      callbacks: {
        title: function (items) {
          if (!items || !items.length) return '';
          var ds = items[0].dataset;
          var idx = items[0].dataIndex;
          var src =
            ds._eaSourceIndices && ds._eaSourceIndices[idx] != null ? ds._eaSourceIndices[idx] : idx;
          if (ds._eaFullLabels && ds._eaFullLabels[src] != null) return String(ds._eaFullLabels[src]);
          return String(items[0].label || '');
        },
        label: function (ctx) {
          var ds = ctx.dataset;
          var idx = ctx.dataIndex;
          var src =
            ds._eaSourceIndices && ds._eaSourceIndices[idx] != null ? ds._eaSourceIndices[idx] : idx;
          var val =
            ds._eaFullValues && ds._eaFullValues[src] != null ? ds._eaFullValues[src] : ctx.parsed.y;
          var label = ds.label || '';
          return label ? label + ': ' + val : String(val);
        },
      },
    },
  };
}

/** Same shape as tendDetailChartOptions (Tendencias detail modal). */
export function eaLineChartOptions(extra) {
  return Object.assign(
    {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      transitions: {
        active: { animation: { duration: 0 } },
      },
      layout: { padding: { right: 12, left: 4, top: 8, bottom: 4 } },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: Object.assign(
        {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 11 }, padding: 10 },
          },
        },
        eaChartTooltipPlugin()
      ),
      elements: {
        point: { radius: 3, hoverRadius: 5 },
        line: { borderWidth: 2, tension: 0.25 },
      },
      scales: {
        y: { grace: '5%', ticks: { font: { size: 11 }, maxTicksLimit: 6 } },
        x: {
          ticks: { maxRotation: 0, font: { size: 10 }, autoSkip: true, maxTicksLimit: 10 },
          offset: true,
        },
      },
    },
    extra || {}
  );
}

export function eaIoChartOptions() {
  return eaLineChartOptions({
    plugins: Object.assign(
      { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      eaChartTooltipPlugin()
    ),
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'cc', font: { size: 11 } },
        ticks: { font: { size: 11 }, maxTicksLimit: 6 },
      },
      y1: {
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Balance acum.', font: { size: 11 } },
        ticks: { font: { size: 11 }, maxTicksLimit: 6 },
      },
      x: { ticks: { maxRotation: 0, font: { size: 10 }, autoSkip: true, maxTicksLimit: 10 } },
    },
  });
}

/**
 * @param {unknown} ChartCtor
 * @param {HTMLCanvasElement} canvas
 * @param {{ type: string, data: object, options: object, slotId?: string }} spec
 */
export function paintEaChart(ChartCtor, canvas, spec) {
  var Chart = resolveChartCtor(ChartCtor);
  if (!Chart || !canvas) return null;
  var sameCanvas = eaChartInstance && eaChartInstance.canvas === canvas;
  var sameType = sameCanvas && eaChartInstance.config && eaChartInstance.config.type === spec.type;

  if (sameCanvas && sameType) {
    eaChartInstance.data.labels = spec.data.labels;
    eaChartInstance.data.datasets = spec.data.datasets;
    eaChartInstance.options = spec.options;
    eaChartInstance._eaSlotId = spec.slotId || '';
    eaChartInstance.update('none');
    return eaChartInstance;
  }

  destroyEaChartInstance();
  eaChartInstance = new /** @type {any} */ (Chart)(canvas, {
    type: spec.type,
    data: spec.data,
    options: spec.options,
  });
  eaChartInstance._eaSlotId = spec.slotId || '';
  return eaChartInstance;
}

export function getEaChartInstance() {
  return eaChartInstance;
}
