/** EA panel render decision helpers — extracted from estado-actual-panel-render.mjs */
import { _eaPanelCache } from './estado-actual-panel-core.mjs';
import { syncEaCopyFab } from './estado-actual-panel-actions.mjs';
import { patchEaPanelDynamicSections } from './estado-actual-panel-render-paths.mjs';

/**
 * @param {HTMLElement} mount
 * @param {string} shellKey
 * @param {string} dataKey
 * @param {{ dataOnly?: boolean, force?: boolean }} opts
 */
export function shouldSkipEaPanelRender(mount, shellKey, dataKey, opts) {
  opts = opts || {};
  return !!(
    mount.querySelector('.estado-actual-panel') &&
    _eaPanelCache.shellKey === shellKey &&
    _eaPanelCache.dataKey === dataKey &&
    !opts.force
  );
}

/**
 * @param {HTMLElement} mount
 * @param {ReturnType<typeof import('./estado-actual-panel-core.mjs').findActivePatient>} patient
 * @param {Record<string, unknown>} monitoreo
 * @param {string} shellKey
 * @param {string} dataKey
 * @param {{ dataOnly?: boolean, refreshClinico?: boolean, skipChartsSummary?: boolean }} opts
 * @param {(() => void) | null} onReady
 * @returns {boolean} true when incremental patch handled the render
 */
export function tryPatchEaPanel(mount, patient, monitoreo, shellKey, dataKey, opts, onReady) {
  opts = opts || {};
  if (
    !mount.querySelector('.estado-actual-panel') ||
    _eaPanelCache.shellKey !== shellKey ||
    !(opts.dataOnly || _eaPanelCache.dataKey !== dataKey)
  ) {
    return false;
  }
  if (_eaPanelCache.dataKey === dataKey && !opts.dataOnly) {
    syncEaCopyFab(true);
    if (onReady) onReady();
    return true;
  }
  patchEaPanelDynamicSections(mount, patient, monitoreo, {
    refreshClinico: !!opts.refreshClinico,
    skipChartsSummary: !!opts.skipChartsSummary,
  });
  _eaPanelCache.dataKey = dataKey;
  syncEaCopyFab(true);
  if (onReady) onReady();
  return true;
}
