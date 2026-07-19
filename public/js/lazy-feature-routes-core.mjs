/**
 * Shared lazy-route window patching (BN-10).
 */

/**
 * @param {Record<string, Function>} handlers
 */
export function patchWindowHandlers(handlers) {
  try {
    Object.assign(window, handlers);
  } catch (err) {
    console.error('[lazy-feature-routes] patchWindowHandlers', err);
  }
}

/**
 * @param {string} exportName
 * @param {() => Promise<Record<string, unknown>>} loader
 */
function lazyWindowHandler(exportName, loader) {
  return function lazyHandler() {
    var args = arguments;
    void loader().then(function (mod) {
      var fn = mod[exportName];
      if (typeof fn !== 'function') {
        console.error('[lazy-feature-routes] missing handler', exportName);
        return;
      }
      fn.apply(null, args);
    });
  };
}

/**
 * @param {Record<string, string>} nameToExport — window handler name → module export name
 * @param {() => Promise<Record<string, unknown>>} loader
 */
export function buildLazyWindowHandlers(nameToExport, loader) {
  /** @type {Record<string, Function>} */
  var out = {};
  for (var handlerName of Object.keys(nameToExport)) {
    out[handlerName] = lazyWindowHandler(nameToExport[handlerName], loader);
  }
  return out;
}
