/** Tufte data-ink defaults for Chart.js (Estado actual + Tendencias). Tokens: public/tokens.css */

/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
export function readChartCssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteScaleTicks(extra) {
  return Object.assign(
    {
      font: {
        family: readChartCssVar('--font-mono', '"IBM Plex Mono", monospace'),
        size: parseFloat(readChartCssVar('--chart-tick-size', '10')) || 10,
      },
      color: readChartCssVar('--chart-axis-ink', '#5c6778'),
      maxTicksLimit: 6,
    },
    extra || {}
  );
}

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteGridY(extra) {
  return Object.assign(
    {
      color: readChartCssVar('--chart-grid-line', 'rgba(26, 35, 50, 0.08)'),
      lineWidth: 1,
      drawTicks: false,
    },
    extra || {}
  );
}

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteLineScales(extra) {
  return Object.assign(
    {
      y: {
        border: { display: false },
        grid: clinicalTufteGridY(),
        ticks: clinicalTufteScaleTicks(),
        grace: '5%',
      },
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: clinicalTufteScaleTicks({ maxTicksLimit: 10, maxRotation: 0, autoSkip: true }),
        offset: true,
      },
    },
    extra || {}
  );
}

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteLegend(extra) {
  return Object.assign(
    {
      position: 'bottom',
      labels: {
        boxWidth: 8,
        boxHeight: 2,
        usePointStyle: false,
        font: {
          family: readChartCssVar('--font-ui', '"IBM Plex Sans", sans-serif'),
          size: 10,
        },
        padding: 8,
        color: readChartCssVar('--chart-axis-ink', '#5c6778'),
      },
    },
    extra || {}
  );
}

/**
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteLineElements() {
  var lineWidth = parseFloat(readChartCssVar('--chart-line-width', '1.5')) || 1.5;
  var pointRadius = parseFloat(readChartCssVar('--chart-point-radius', '2')) || 2;
  return {
    point: { radius: pointRadius, hoverRadius: pointRadius + 2, hitRadius: 8 },
    line: { borderWidth: lineWidth, tension: 0 },
  };
}

/**
 * @param {Record<string, unknown>} [pluginExtra]
 * @param {Record<string, unknown>} [optionsExtra]
 * @returns {Record<string, unknown>}
 */
export function clinicalTufteLineChartOptions(pluginExtra, optionsExtra) {
  return Object.assign(
    {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      transitions: {
        active: { animation: { duration: 0 } },
      },
      layout: { padding: { right: 16, left: 2, top: 6, bottom: 2 } },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      elements: clinicalTufteLineElements(),
      scales: clinicalTufteLineScales(),
      plugins: Object.assign({ legend: clinicalTufteLegend() }, pluginExtra || {}),
    },
    optionsExtra || {}
  );
}
