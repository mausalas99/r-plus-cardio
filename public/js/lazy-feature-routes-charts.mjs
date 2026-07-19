/**
 * Lazy charts + tendencias routes (BN-10).
 */

import { buildLazyWindowHandlers, patchWindowHandlers } from './lazy-feature-routes-core.mjs';

let chartsPromise = null;
/** @type {{ tendencias: typeof import('./features/tendencias.mjs'), eaChartsModal: typeof import('./features/estado-actual-charts-modal.mjs') } | null} */
let chartsModules = null;
/** @type {Record<string, unknown>|null} */
let chartsRuntimeCtx = null;

/**
 * @returns {Promise<{ tendencias: typeof import('./features/tendencias.mjs'), eaChartsModal: typeof import('./features/estado-actual-charts-modal.mjs') }>}
 */
export function ensureChartsLoaded() {
  if (chartsModules) return Promise.resolve(chartsModules);
  if (!chartsPromise) {
    chartsPromise = Promise.all([
      import('./features/tendencias.mjs'),
      import('./features/estado-actual-charts-modal.mjs'),
    ]).then(function (pair) {
      chartsModules = { tendencias: pair[0], eaChartsModal: pair[1] };
      registerLazyChartsRuntimes(chartsModules);
      return chartsModules;
    });
  }
  return chartsPromise;
}

/** @param {Record<string, unknown>} ctx */
export function bindLazyChartsRuntimeCtx(ctx) {
  chartsRuntimeCtx = ctx;
}

function inferFechaLabSetFromIdFallback(set) {
  if (!set || set.fecha === 'Anterior') return '';
  var id = String(set.id || '');
  if (!/^\d{10,}$/.test(id)) return '';
  var ms = parseInt(id, 10);
  if (id.length === 10) ms *= 1000;
  var d = new Date(ms);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function getLabOutputPrefsFallback() {
  return {
    showBhExtendedLine: false,
    hideGasoAdvInterp: true,
    quickLabOutput: false,
  };
}

/**
 * @param {typeof import('./features/tendencias.mjs')} tendMod
 */
function wireChartsRuntimeExports(tendMod) {
  if (!chartsRuntimeCtx) return;
  Object.assign(chartsRuntimeCtx, {
    renderTendencias: tendMod.renderTendencias,
    inferFechaLabSetFromId: tendMod.inferFechaLabSetFromId,
    getLabOutputPrefs: tendMod.getLabOutputPrefs,
    isGasoInterpretacionResLabChunk: tendMod.isGasoInterpretacionResLabChunk,
    isCitoquimInterpretacionResLabChunk: tendMod.isCitoquimInterpretacionResLabChunk,
    isAscitisInterpretacionResLabChunk: tendMod.isAscitisInterpretacionResLabChunk,
    citoquimInterpretacionBody_: tendMod.citoquimInterpretacionBody_,
    ascitisInterpretacionBody_: tendMod.ascitisInterpretacionBody_,
    formatBhExtendedTabLine: tendMod.formatBhExtendedTabLine,
    isBhMainResLabChunk: tendMod.isBhMainResLabChunk,
  });
}

/**
 * @param {{ tendencias: typeof import('./features/tendencias.mjs'), eaChartsModal: typeof import('./features/estado-actual-charts-modal.mjs') }} mods
 */
function registerLazyChartsRuntimes(mods) {
  var tendMod = mods.tendencias;
  var eaMod = mods.eaChartsModal;
  if (chartsRuntimeCtx) {
    tendMod.registerTendenciasRuntime(chartsRuntimeCtx);
    eaMod.registerEstadoActualChartsModalRuntime({
      getActiveId: function () {
        return typeof chartsRuntimeCtx.getActiveId === 'function' ? chartsRuntimeCtx.getActiveId() : null;
      },
      getPatient: function () {
        if (typeof chartsRuntimeCtx.getActivePatient === 'function') {
          return chartsRuntimeCtx.getActivePatient();
        }
        return null;
      },
      showToast: function (msg, type) {
        if (typeof chartsRuntimeCtx.showToast === 'function') {
          chartsRuntimeCtx.showToast(msg, type);
        }
      },
    });
    wireChartsRuntimeExports(tendMod);
  }
  tendMod.seedTendHiddenDefaults();
  eaMod.wireEaChartsModalDismiss();
  patchWindowHandlers(tendMod.tendenciasWindowHandlers);
  patchWindowHandlers(eaMod.windowHandlers);
}

/**
 * @param {string} exportName
 * @param {Function} [fallback]
 */
function chartsAsyncFn(exportName, fallback) {
  return function chartsAsyncProxy() {
    var args = arguments;
    if (chartsModules) {
      var fn = chartsModules.tendencias[exportName];
      if (typeof fn === 'function') return fn.apply(null, args);
      return;
    }
    void ensureChartsLoaded().then(function (mods) {
      var loadedFn = mods.tendencias[exportName];
      if (typeof loadedFn === 'function') loadedFn.apply(null, args);
      else if (typeof fallback === 'function') fallback.apply(null, args);
    });
  };
}

/**
 * @param {string} exportName
 * @param {Function} fallback
 */
function chartsSyncFn(exportName, fallback) {
  return function chartsSyncProxy() {
    var args = arguments;
    if (chartsModules) {
      var fn = chartsModules.tendencias[exportName];
      if (typeof fn === 'function') return fn.apply(null, args);
    }
    return fallback.apply(null, args);
  };
}

/** Proxies until ensureChartsLoaded wires real exports onto runtime ctx. */
export const chartsRuntimeProxies = {
  renderTendencias: chartsAsyncFn('renderTendencias'),
  inferFechaLabSetFromId: chartsSyncFn('inferFechaLabSetFromId', inferFechaLabSetFromIdFallback),
  getLabOutputPrefs: chartsSyncFn('getLabOutputPrefs', getLabOutputPrefsFallback),
  isGasoInterpretacionResLabChunk: chartsSyncFn('isGasoInterpretacionResLabChunk', function () {
    return false;
  }),
  isCitoquimInterpretacionResLabChunk: chartsSyncFn('isCitoquimInterpretacionResLabChunk', function () {
    return false;
  }),
  isAscitisInterpretacionResLabChunk: chartsSyncFn('isAscitisInterpretacionResLabChunk', function () {
    return false;
  }),
  citoquimInterpretacionBody_: chartsSyncFn('citoquimInterpretacionBody_', function () {
    return '';
  }),
  ascitisInterpretacionBody_: chartsSyncFn('ascitisInterpretacionBody_', function () {
    return '';
  }),
  formatBhExtendedTabLine: chartsSyncFn('formatBhExtendedTabLine', function () {
    return '';
  }),
  isBhMainResLabChunk: chartsSyncFn('isBhMainResLabChunk', function () {
    return false;
  }),
};

/**
 * @param {string} exportName
 */
function lazyChartsClose(exportName) {
  return function lazyClose() {
    void ensureChartsLoaded().then(function (mods) {
      var fn = mods.tendencias[exportName];
      if (typeof fn === 'function') fn();
    });
  };
}

/** Modal dismiss hooks in app-shell until charts bundle loads. */
export const chartsShellCloseProxies = {
  closeTendDetail: lazyChartsClose('closeTendDetail'),
  closeTendGroupModal: lazyChartsClose('closeTendGroupModal'),
  closeTendHiddenModal: lazyChartsClose('closeTendHiddenModal'),
  closeLabDisplayPrefsModal: lazyChartsClose('closeLabDisplayPrefsModal'),
  isTendGroupModalOpen: function () {
    if (chartsModules) return chartsModules.tendencias.isTendGroupModalOpen();
    return false;
  },
};

/** @type {Record<string, string>} */
var tendenciasHandlerNames = {
  closeTendDetail: 'closeTendDetail',
  openTendGroupModal: 'openTendGroupModal',
  openTendGasoExtendedModal: 'openTendGasoExtendedModal',
  closeTendGroupModal: 'closeTendGroupModal',
  setTendGroupTab: 'setTendGroupTab',
  copyTendGroupTablePng: 'copyTendGroupTablePng',
  copyTendGroupTableText: 'copyTendGroupTableText',
  toggleTendSection: 'toggleTendSection',
  toggleTendAbnormalOnlyFilter: 'toggleTendAbnormalOnlyFilter',
  tendHideSeriesFromCard: 'tendHideSeriesFromCard',
  tendUnhideSeries: 'tendUnhideSeries',
  tendResetAllHiddenSeries: 'tendResetAllHiddenSeries',
  openTendHiddenModal: 'openTendHiddenModal',
  closeTendHiddenModal: 'closeTendHiddenModal',
  openTendDetail: 'openTendDetail',
  tendCardActivate: 'tendCardActivate',
  openLabDisplayPrefsModal: 'openLabDisplayPrefsModal',
  closeLabDisplayPrefsModal: 'closeLabDisplayPrefsModal',
  onLabDisplayPrefsChanged: 'onLabDisplayPrefsChanged',
};

/** @type {Record<string, string>} */
var eaChartsModalHandlerNames = {
  openEstadoActualChartsModal: 'openEstadoActualChartsModal',
  closeEstadoActualChartsModal: 'closeEstadoActualChartsModal',
};

export const chartsWindowHandlersLazy = Object.assign(
  {},
  buildLazyWindowHandlers(tendenciasHandlerNames, function () {
    return ensureChartsLoaded().then(function (mods) {
      return mods.tendencias;
    });
  }),
  buildLazyWindowHandlers(eaChartsModalHandlerNames, function () {
    return ensureChartsLoaded().then(function (mods) {
      return mods.eaChartsModal;
    });
  })
);
