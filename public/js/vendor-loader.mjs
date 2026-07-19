/** Chart.js — UMD in index.src.html (sync); this module only lazy-injects if missing. */

let chartPromise = null;

/**
 * @param {string} pathname — e.g. `vendor/chart.umd.min.js`
 * @returns {string}
 */
function publicAssetUrl(pathname) {
  var clean = String(pathname || '').replace(/^\/+/, '');
  try {
    return new URL(clean, window.location.href).href;
  } catch {
    return '/' + clean;
  }
}

/**
 * @returns {Promise<typeof Chart>}
 */
function injectChartVendorScript() {
  return new Promise(function (resolve, reject) {
    var existing = getChartJsIfLoaded();
    if (existing) {
      resolve(existing);
      return;
    }
    var script = document.createElement('script');
    script.src = publicAssetUrl('vendor/chart.umd.min.js');
    script.async = false;
    script.onload = function () {
      var Chart = getChartJsIfLoaded();
      if (Chart) resolve(Chart);
      else reject(new Error('Chart.js script loaded but Chart global missing'));
    };
    script.onerror = function () {
      reject(new Error('Chart.js script failed: ' + script.src));
    };
    document.head.appendChild(script);
  });
}

/**
 * @returns {Promise<typeof Chart>}
 */
export function loadChartJs() {
  var existing = getChartJsIfLoaded();
  if (existing) return Promise.resolve(existing);

  if (!chartPromise) {
    chartPromise = injectChartVendorScript().catch(function (err) {
      chartPromise = null;
      throw err;
    });
  }
  return chartPromise;
}

/** @returns {typeof Chart | undefined} */
export function getChartJsIfLoaded() {
  return (
    (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).Chart) ||
    (typeof window !== 'undefined' && /** @type {any} */ (window).Chart) ||
    undefined
  );
}
