/** EA panel shell render + incremental patch. */
import { ensureMonitoreo, migratePatientMonitoreo } from './estado-actual-data.mjs';
import { formatEaSavedLabel } from './estado-actual-panel-format.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';
import { _eaPanelCache, findActivePatient } from './estado-actual-panel-core.mjs';
import { syncEaCopyFab } from './estado-actual-panel-actions.mjs';
import {
  buildEaShellKey,
  buildEaDataKey,
  renderEaEmptyPanel,
  syncEaRecetaProposals,
  renderEaFullPanelShell,
} from './estado-actual-panel-render-paths.mjs';
import { shouldSkipEaPanelRender, tryPatchEaPanel } from './estado-actual-panel-render-decisions.mjs';

export function renderEstadoActualPanel(opts) {
  opts = opts || {};
  var onReady = typeof opts.onReady === 'function' ? opts.onReady : null;
  var mount = document.getElementById('exp-pane-estado-actual');
  if (!mount) {
    if (onReady) onReady();
    return;
  }

  var patient = findActivePatient();
  if (!patient) {
    renderEaEmptyPanel(mount, onReady);
    return;
  }

  migratePatientMonitoreo(patient);
  ensureMonitoreo(patient);
  var monitoreo = patient.monitoreo;
  var activeId = getEaPanelRuntime().getActiveId();
  syncEaRecetaProposals(patient, activeId, monitoreo);

  var savedLabel = formatEaSavedLabel(monitoreo.textoGuardado && monitoreo.textoGuardado.savedAt);
  var shellKey = buildEaShellKey(activeId, monitoreo);
  var dataKey = buildEaDataKey(monitoreo, activeId);

  if (tryPatchEaPanel(mount, patient, monitoreo, shellKey, dataKey, opts, onReady)) return;
  if (shouldSkipEaPanelRender(mount, shellKey, dataKey, opts)) {
    syncEaCopyFab(true);
    if (onReady) onReady();
    return;
  }

  renderEaFullPanelShell(mount, patient, monitoreo, activeId, savedLabel);
  _eaPanelCache.shellKey = shellKey;
  _eaPanelCache.dataKey = dataKey;
  syncEaCopyFab(true);
  if (onReady) onReady();
}

export function navigateToEstadoActualPanel() {
  if (typeof getEaPanelRuntime().switchInnerTab === 'function') {
    getEaPanelRuntime().switchInnerTab('estadoActual');
    return;
  }
  getEaPanelRuntime().switchConsolidatedTab('clinico');
}
