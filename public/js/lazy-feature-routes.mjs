/**
 * Lazy feature routes (BN-10) — boot hubs must not statically import index shells.
 */

import { isMobileWeb } from './mobile-web.mjs';
import { buildLabPanelSkeletonHtml } from './ui-skeleton.mjs';
import { buildLazyWindowHandlers, patchWindowHandlers } from './lazy-feature-routes-core.mjs';
import {
  buildPlatformWindowHandlersLazy,
  buildSettingsHelpWindowHandlersLazy,
  clinicalSyncModeSettingsHandlersLazy,
  commandPaletteWindowHandlersLazy,
} from './lazy-feature-routes-handlers.mjs';
export {
  bindLazyChartsRuntimeCtx,
  chartsRuntimeProxies,
  chartsShellCloseProxies,
  chartsWindowHandlersLazy,
  ensureChartsLoaded,
} from './lazy-feature-routes-charts.mjs';
export { patchWindowHandlers, buildLazyWindowHandlers } from './lazy-feature-routes-core.mjs';

let settingsHelpPromise = null;
let platformPromise = null;
let labsPromise = null;
let settingsHelpModule = null;
let platformModule = null;
let labsModule = null;
/** @type {Record<string, unknown>|null} */
let labsRuntimeCtx = null;

export const BOOT_LAZY_ONLY_SUFFIXES = [
  'features/settings-help/index.mjs',
  'features/platform/index.mjs',
  'features/settings-help.mjs',
  'features/platform.mjs',
  'features/lab-panel.mjs',
  'features/tendencias.mjs',
  'features/estado-actual-charts-modal.mjs',
  'features/estado-actual-vital-history-modal.mjs',
  'features/clinical-entrega.mjs',
  'features/settings-help/tour-flow.mjs',
  'features/settings-help/tour-engine.mjs',
  'features/settings-help/settings-dropdown.mjs',
  'features/platform/audit.mjs',
  'features/platform/import-backup.mjs',
  'features/platform/offline.mjs',
];

let entregaPromise = null;
/** @type {typeof import('./features/clinical-entrega.mjs') | null} */
let entregaModule = null;

let eaVitalHistoryPromise = null;
/** @type {typeof import('./features/estado-actual-vital-history-modal.mjs') | null} */
let eaVitalHistoryModule = null;
/** @type {Record<string, unknown> | null} */
let eaVitalHistoryRuntimeCtx = null;

/** @type {Record<string, unknown> | null} */
let platformRuntimeCtx = null;

/** @type {Record<string, unknown> | null} */
let settingsRuntimeCtx = null;

/**
 * @returns {Promise<typeof import('./features/settings-help/index.mjs')>}
 */
export function ensureSettingsHelpLoaded() {
  if (settingsHelpModule) return Promise.resolve(settingsHelpModule);
  if (!settingsHelpPromise) {
    settingsHelpPromise = import('./features/settings-help/index.mjs').then(function (mod) {
      settingsHelpModule = mod;
      wireSettingsRuntimeExports(mod);
      return mod;
    });
  }
  return settingsHelpPromise;
}

/**
 * @returns {Promise<typeof import('./features/platform/index.mjs')>}
 */
export function ensurePlatformLoaded() {
  if (platformModule) return Promise.resolve(platformModule);
  if (!platformPromise) {
    platformPromise = import('./features/platform/index.mjs').then(function (mod) {
      platformModule = mod;
      wirePlatformRuntimeExports(mod);
      return mod;
    });
  }
  return platformPromise;
}

/**
 * @returns {Promise<typeof import('./features/clinical-entrega.mjs')>}
 */
export function ensureEntregaLoaded() {
  if (entregaModule) return Promise.resolve(entregaModule);
  if (!entregaPromise) {
    entregaPromise = import('./features/clinical-entrega.mjs').then(function (mod) {
      entregaModule = mod;
      return mod;
    });
  }
  return entregaPromise;
}

/** @param {Record<string, unknown>} ctx */
export function bindLazyEaVitalHistoryRuntimeCtx(ctx) {
  eaVitalHistoryRuntimeCtx = ctx;
}

/**
 * @returns {Promise<typeof import('./features/estado-actual-vital-history-modal.mjs')>}
 */
export function ensureEaVitalHistoryLoaded() {
  if (eaVitalHistoryModule) return Promise.resolve(eaVitalHistoryModule);
  if (!eaVitalHistoryPromise) {
    eaVitalHistoryPromise = import('./features/estado-actual-vital-history-modal.mjs').then(function (mod) {
      eaVitalHistoryModule = mod;
      if (eaVitalHistoryRuntimeCtx) {
        mod.registerEaVitalHistoryModalRuntime(eaVitalHistoryRuntimeCtx);
      }
      mod.wireEaVitalHistoryModalDismiss();
      return mod;
    });
  }
  return eaVitalHistoryPromise;
}

export const eaVitalHistoryWindowHandlersLazy = buildLazyWindowHandlers(
  {
    openEaVitalHistoryModal: 'openEaVitalHistoryModal',
    closeEaVitalHistoryModal: 'closeEaVitalHistoryModal',
  },
  ensureEaVitalHistoryLoaded
);

/** @param {Record<string, unknown>} ctx */
export function bindLazyPlatformRuntimeCtx(ctx) {
  platformRuntimeCtx = ctx;
}

/** @param {Record<string, unknown>} ctx */
export function bindLazySettingsRuntimeCtx(ctx) {
  settingsRuntimeCtx = ctx;
}

/**
 * @param {typeof import('./features/platform/index.mjs')} mod
 */
function wirePlatformRuntimeExports(mod) {
  if (!platformRuntimeCtx) return;
  Object.assign(platformRuntimeCtx, {
    addAuditEntry: mod.addAuditEntry,
    syncPreimportBackupUi: mod.syncPreimportBackupUi,
    applyImportEntry: mod.applyImportEntry,
    incrementPendingJobs: mod.incrementPendingJobs,
    decrementPendingJobs: mod.decrementPendingJobs,
    syncOfflineButtonStates: mod.syncOfflineButtonStates,
    isRpcOffline: mod.isRpcOffline,
  });
}

/**
 * @param {typeof import('./features/settings-help/index.mjs')} mod
 */
function wireSettingsRuntimeExports(mod) {
  if (!settingsRuntimeCtx) return;
  Object.assign(settingsRuntimeCtx, {
    guidedTourAdvanceAfterNotaGenerated: mod.guidedTourAdvanceAfterNotaGenerated,
    guidedTourAdvanceAfterIndicaGenerated: mod.guidedTourAdvanceAfterIndicaGenerated,
    guidedTourAdvanceAfter: mod.guidedTourAdvanceAfter,
    onboardingAdvanceAfterParse: mod.onboardingAdvanceAfterParse,
    onboardingAdvanceAfterSend: mod.onboardingAdvanceAfterSend,
    tourAfterBulkLabParse: mod.tourAfterBulkLabParse,
    tourOnBulkPreviewPatientSaved: mod.tourOnBulkPreviewPatientSaved,
    closeSettingsDropdown: mod.closeSettingsDropdown,
    syncTeamSyncHeaderButton: mod.syncTeamSyncHeaderButton,
  });
}

/**
 * @param {string} exportName
 * @param {() => Promise<Record<string, unknown>>} loader
 * @param {Function} [fallback]
 */
function lazyRuntimeFn(exportName, loader, fallback) {
  return function lazyRuntimeProxy() {
    var args = arguments;
    void loader().then(function (mod) {
      var fn = mod[exportName];
      if (typeof fn === 'function') fn.apply(null, args);
      else if (typeof fallback === 'function') fallback.apply(null, args);
    });
  };
}

/**
 * @param {string} exportName
 * @param {() => Promise<Record<string, unknown>>} loader
 * @param {Function} fallback
 */
function lazyRuntimeSyncFn(exportName, loader, fallback) {
  return function lazyRuntimeSyncProxy() {
    var args = arguments;
    if (loader === ensurePlatformLoaded && platformModule) {
      var live = platformModule[exportName];
      if (typeof live === 'function') return live.apply(null, args);
    }
    if (loader === ensureSettingsHelpLoaded && settingsHelpModule) {
      var liveSettings = settingsHelpModule[exportName];
      if (typeof liveSettings === 'function') return liveSettings.apply(null, args);
    }
    return fallback.apply(null, args);
  };
}

/** Proxies until ensurePlatformLoaded wires real exports onto runtime ctx. */
export const platformRuntimeProxies = {
  addAuditEntry: lazyRuntimeFn('addAuditEntry', ensurePlatformLoaded),
  syncPreimportBackupUi: lazyRuntimeFn('syncPreimportBackupUi', ensurePlatformLoaded),
  applyImportEntry: lazyRuntimeFn('applyImportEntry', ensurePlatformLoaded),
  incrementPendingJobs: lazyRuntimeFn('incrementPendingJobs', ensurePlatformLoaded),
  decrementPendingJobs: lazyRuntimeFn('decrementPendingJobs', ensurePlatformLoaded),
  syncOfflineButtonStates: lazyRuntimeFn('syncOfflineButtonStates', ensurePlatformLoaded),
  isRpcOffline: lazyRuntimeSyncFn('isRpcOffline', ensurePlatformLoaded, function () {
    return false;
  }),
};

/** Proxies until ensureSettingsHelpLoaded wires tour/settings helpers onto runtime ctx. */
export const settingsHelpRuntimeProxies = {
  guidedTourAdvanceAfterNotaGenerated: lazyRuntimeFn(
    'guidedTourAdvanceAfterNotaGenerated',
    ensureSettingsHelpLoaded
  ),
  guidedTourAdvanceAfterIndicaGenerated: lazyRuntimeFn(
    'guidedTourAdvanceAfterIndicaGenerated',
    ensureSettingsHelpLoaded
  ),
  guidedTourAdvanceAfter: lazyRuntimeFn('guidedTourAdvanceAfter', ensureSettingsHelpLoaded),
  onboardingAdvanceAfterParse: lazyRuntimeFn('onboardingAdvanceAfterParse', ensureSettingsHelpLoaded),
  onboardingAdvanceAfterSend: lazyRuntimeFn('onboardingAdvanceAfterSend', ensureSettingsHelpLoaded),
  tourAfterBulkLabParse: lazyRuntimeFn('tourAfterBulkLabParse', ensureSettingsHelpLoaded),
  tourOnBulkPreviewPatientSaved: lazyRuntimeFn(
    'tourOnBulkPreviewPatientSaved',
    ensureSettingsHelpLoaded
  ),
  closeSettingsDropdown: lazyRuntimeFn('closeSettingsDropdown', ensureSettingsHelpLoaded),
  syncTeamSyncHeaderButton: lazyRuntimeFn('syncTeamSyncHeaderButton', ensureSettingsHelpLoaded),
};

export function shellToggleSettingsDropdown() {
  void ensureSettingsHelpLoaded().then(function (mod) {
    mod.toggleSettingsDropdown();
  });
}

export function shellCloseSettingsDropdown() {
  void ensureSettingsHelpLoaded().then(function (mod) {
    mod.closeSettingsDropdown();
  });
}

export function shellSyncTeamSyncHeaderButton() {
  void ensureSettingsHelpLoaded().then(function (mod) {
    mod.syncTeamSyncHeaderButton();
  });
}

/**
 * @returns {Promise<typeof import('./features/lab-panel.mjs')>}
 */
export function ensureLabsLoaded() {
  if (labsModule) return Promise.resolve(labsModule);
  if (!labsPromise) {
    labsPromise = import('./features/lab-panel.mjs').then(function (mod) {
      labsModule = mod;
      registerLazyLabsRuntimes(mod);
      return mod;
    });
  }
  return labsPromise;
}

/** @param {Record<string, unknown>} ctx */
export function bindLazyLabsRuntimeCtx(ctx) {
  labsRuntimeCtx = ctx;
}

/**
 * @param {typeof import('./features/lab-panel.mjs')} mod
 */
function wireLabsRuntimeExports(mod) {
  if (!labsRuntimeCtx) return;
  Object.assign(labsRuntimeCtx, {
    renderLabHistoryPanel: mod.renderLabHistoryPanel,
    syncLabOutputChrome: mod.syncLabOutputChrome,
    setLabHistoryPanelCollapsed: mod.setLabHistoryPanelCollapsed,
    syncLabHistoryCollapseUI: mod.syncLabHistoryCollapseUI,
    limpiarReporte: mod.limpiarReporte,
    enviarLabsANota: mod.enviarLabsANota,
    rerenderParsedLabOutputAfterPrefsChange: mod.rerenderParsedLabOutputAfterPrefsChange,
    clearLabOutputUi: mod.clearLabWorkbenchMinimalDom,
    getActiveLab: function () {
      return mod.getActiveLab();
    },
    consumeActiveLab: function () {
      var x = mod.getActiveLab();
      mod.setActiveLab(null);
      return x;
    },
    restoreActiveLab: function (x) {
      mod.setActiveLab(x);
    },
  });
}

/**
 * @param {typeof import('./features/lab-panel.mjs')} mod
 */
function registerLazyLabsRuntimes(mod) {
  if (labsRuntimeCtx) {
    mod.registerLabPanelRuntime(labsRuntimeCtx);
    wireLabsRuntimeExports(mod);
  }
  patchWindowHandlers(mod.windowHandlers);
}

export function showLabPanelLoadingSkeleton() {
  if (labsModule || typeof document === 'undefined') return;
  var root = document.getElementById('appcontent-lab');
  if (!root || root.classList.contains('is-lab-chunk-loading')) return;
  root.classList.add('is-lab-chunk-loading');
  root.setAttribute('aria-busy', 'true');
  var scroll = root.querySelector('.lab-work-scroll');
  var el = document.getElementById('lab-panel-loading');
  if (!el) {
    var wrap = document.createElement('div');
    wrap.innerHTML = buildLabPanelSkeletonHtml();
    el = wrap.firstElementChild;
    if (el && scroll) scroll.prepend(el);
    else if (el) root.prepend(el);
  }
  if (el) el.hidden = false;
}

export function hideLabPanelLoadingSkeleton() {
  if (typeof document === 'undefined') return;
  var root = document.getElementById('appcontent-lab');
  if (root) {
    root.classList.remove('is-lab-chunk-loading');
    root.removeAttribute('aria-busy');
  }
  var el = document.getElementById('lab-panel-loading');
  if (el) el.remove();
}

/**
 * @param {string} exportName
 */
function labsAsyncFn(exportName) {
  return function labsAsyncProxy() {
    var args = arguments;
    if (labsModule) {
      var fn = labsModule[exportName];
      if (typeof fn === 'function') return fn.apply(null, args);
      return;
    }
    void ensureLabsLoaded().then(function (mod) {
      var loadedFn = mod[exportName];
      if (typeof loadedFn === 'function') loadedFn.apply(null, args);
    });
  };
}

/** Proxies until ensureLabsLoaded wires real exports onto runtime ctx. */
export const labsRuntimeProxies = {
  renderLabHistoryPanel: labsAsyncFn('renderLabHistoryPanel'),
  syncLabOutputChrome: labsAsyncFn('syncLabOutputChrome'),
  setLabHistoryPanelCollapsed: labsAsyncFn('setLabHistoryPanelCollapsed'),
  syncLabHistoryCollapseUI: labsAsyncFn('syncLabHistoryCollapseUI'),
  limpiarReporte: labsAsyncFn('limpiarReporte'),
  enviarLabsANota: labsAsyncFn('enviarLabsANota'),
  rerenderParsedLabOutputAfterPrefsChange: labsAsyncFn('rerenderParsedLabOutputAfterPrefsChange'),
  clearLabOutputUi: labsAsyncFn('clearLabWorkbenchMinimalDom'),
  getActiveLab: function () {
    if (labsModule) return labsModule.getActiveLab();
    return null;
  },
  consumeActiveLab: function () {
    if (!labsModule) return null;
    var x = labsModule.getActiveLab();
    labsModule.setActiveLab(null);
    return x;
  },
  restoreActiveLab: function (x) {
    if (labsModule) labsModule.setActiveLab(x);
  },
};

export const labPanelWindowHandlersLazy = buildLazyWindowHandlers(
  {
    procesarReporte: 'procesarReporte',
    clearLabInputAfterSuccessfulParse: 'clearLabInputAfterSuccessfulParse',
    limpiarReporte: 'limpiarReporte',
    replayLabHistorySet: 'replayLabHistorySet',
    reprocessLabHistorySet: 'reprocessLabHistorySet',
    deleteLabHistorySet: 'deleteLabHistorySet',
    toggleLabHistoryPanel: 'toggleLabHistoryPanel',
    syncLabHistoryCollapseUI: 'syncLabHistoryCollapseUI',
    setLabHistoryPanelCollapsed: 'setLabHistoryPanelCollapsed',
    labHistoryPanelIsCollapsed: 'labHistoryPanelIsCollapsed',
    copiarLabsAlPortapapeles: 'copiarLabsAlPortapapeles',
    openLabSomeTablesModal: 'openLabSomeTablesModal',
    closeLabSomeTablesModal: 'closeLabSomeTablesModal',
    closeLabHistoryMoreMenu: 'closeLabHistoryMoreMenu',
    openLabPatientPicker: 'openLabPatientPicker',
    openLabHistoryDedupeReview: 'openLabHistoryDedupeReview',
    expandLabHistoryList: 'expandLabHistoryList',
    consolidateLabHistoryByDayAndTipo: 'consolidateLabHistoryByDayAndTipo',
    insertLabPatientSeparator: 'insertLabPatientSeparator',
    onLabHistoryDateChange: 'onLabHistoryDateChange',
    reprocessSelectedLabHistorySet: 'reprocessSelectedLabHistorySet',
    deleteSelectedLabHistorySet: 'deleteSelectedLabHistorySet',
    deleteAllLabHistorySets: 'deleteAllLabHistorySets',
    openLabRepoImportModal: 'openLabRepoImportModal',
    closeLabRepoImportModal: 'closeLabRepoImportModal',
    confirmLabRepoImport: 'confirmLabRepoImport',
  },
  ensureLabsLoaded
);

export const settingsHelpWindowHandlersLazy = buildSettingsHelpWindowHandlersLazy(
  ensureSettingsHelpLoaded
);

export const platformWindowHandlersLazy = buildPlatformWindowHandlersLazy(ensurePlatformLoaded);

export { commandPaletteWindowHandlersLazy, clinicalSyncModeSettingsHandlersLazy };

/**
 * Register platform + settings-help runtimes and replace lazy window stubs with real handlers.
 * @param {object} ctx
 */
async function registerLazyFeatureRuntimesBody(ctx) {
  const [platformMod, settingsMod] = await Promise.all([
    ensurePlatformLoaded(),
    ensureSettingsHelpLoaded(),
    ensureEaVitalHistoryLoaded(),
  ]);
  platformMod.registerPlatformRuntime(ctx);
  settingsMod.registerSettingsHelpRuntime(ctx);
  patchWindowHandlers(settingsMod.settingsHelpWindowHandlers);
  patchWindowHandlers(platformMod.platformWindowHandlers);
}

export async function registerLazyFeatureRuntimes(ctx) {
  if (isMobileWeb()) {
    void registerLazyFeatureRuntimesBody(ctx);
    return;
  }
  return registerLazyFeatureRuntimesBody(ctx);
}
