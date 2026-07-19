// Panel Estado Actual (Sala) — barrel: runtime + re-exports
import {
  registerEstadoActualPanelRuntime,
  getEaPanelRuntime,
} from './estado-actual-panel-runtime.mjs';
import { eaPanelBridge } from './estado-actual-panel-bridge.mjs';
import { invalidateEaPanelCache } from './estado-actual-panel-core.mjs';
import {
  formatEaSavedLabel,
  toDatetimeLocalValue,
  datetimeLocalToIso,
  isoToHHmm,
  parseNumOrNull,
} from './estado-actual-panel-format.mjs';
import { flushEaEstadoClinicoFieldsFromDom } from './estado-actual-panel-clinico.mjs';
import {
  applyEstadoActualParsedToForm,
  buildRegistroFormMarkup,
  wireEaRegistroForm,
  syncEaRegistroGluMode,
  resetEaRegistroForm,
} from './estado-actual-panel-registro.mjs';
import {
  registrarEstadoActualMedicion,
  ensureEaRegistroModalForm,
  eliminarEstadoActualMedicion,
  estadoActualGuardar,
  estadoActualGuardarCopiar,
  syncEaCopyFab,
  eaHasCopyableContent,
  copiarEstadoActualTexto,
  confirmEaMedField,
  discardEaMedProposal,
  confirmEaDietProposal,
  discardEaDietProposal,
  confirmAllEaMedProposals,
  toggleEaEstadoClinico,
  windowHandlers,
} from './estado-actual-panel-actions.mjs';
import { renderEstadoActualPanel, navigateToEstadoActualPanel } from './estado-actual-panel-render.mjs';

eaPanelBridge.renderEstadoActualPanel = renderEstadoActualPanel;
eaPanelBridge.registrarEstadoActualMedicion = registrarEstadoActualMedicion;

try {
  if (typeof window !== 'undefined') window.eaPanelBridge = eaPanelBridge;
} catch (_eaBridge) {
  void _eaBridge;
}

if (typeof document !== 'undefined' && !document._rpcInternoVitalsEaWired) {
  document._rpcInternoVitalsEaWired = true;
  document.addEventListener('rpc-interno-vitals-synced', function (ev) {
    var pid = String(ev.detail?.patientId || '').trim();
    var activeId = getEaPanelRuntime().getActiveId();
    if (!pid || !activeId || String(activeId) !== pid) return;
    invalidateEaPanelCache();
    renderEstadoActualPanel({ force: true, syncHeavy: true });
  });
}

export { registerEstadoActualPanelRuntime, invalidateEaPanelCache };
export {
  formatEaSavedLabel,
  toDatetimeLocalValue,
  datetimeLocalToIso,
  isoToHHmm,
  parseNumOrNull,
  flushEaEstadoClinicoFieldsFromDom,
  applyEstadoActualParsedToForm,
  buildRegistroFormMarkup,
  wireEaRegistroForm,
  syncEaRegistroGluMode,
  resetEaRegistroForm,
  renderEstadoActualPanel,
  navigateToEstadoActualPanel,
  registrarEstadoActualMedicion,
  ensureEaRegistroModalForm,
  eliminarEstadoActualMedicion,
  estadoActualGuardar,
  estadoActualGuardarCopiar,
  syncEaCopyFab,
  eaHasCopyableContent,
  copiarEstadoActualTexto,
  confirmEaMedField,
  discardEaMedProposal,
  confirmEaDietProposal,
  discardEaDietProposal,
  confirmAllEaMedProposals,
  toggleEaEstadoClinico,
  windowHandlers,
};
