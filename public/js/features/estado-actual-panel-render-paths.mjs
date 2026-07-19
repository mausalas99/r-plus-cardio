/** EA panel render paths — extracted from estado-actual-panel-render.mjs */
import { saveState } from '../app-state.mjs';
import { medRecetaByPatient, medNotaSelectionByPatient } from '../app-state.mjs';
import {
  deriveSnapshot,
  balanceTurno,
  balanceGlobalHistorico,
  buildEaMonitoreoRevision,
} from './estado-actual-data.mjs';
import {
  applyDietProposalFromRecetaBlock,
  syncRecetaProposalsFromSoapSelection,
} from './estado-actual-meds.mjs';
import { syncMonitoreoInsulinPumpFromReceta } from './estado-actual-insulin-pump.mjs';
import { classifyMedicationSoapCategory } from '../med-receta-core.mjs';
import {
  buildEaHistorialChartsRevision,
  renderEaChartsSummarySection,
} from './estado-actual-charts.mjs';
import { renderSnapshotSection, renderHistorialSection } from './estado-actual-panel-snapshot.mjs';
import { formatEaSavedLabel } from './estado-actual-panel-format.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';
import { invalidateEaPanelCache } from './estado-actual-panel-core.mjs';
import {
  renderEstadoClinicoSection,
  wireEstadoClinicoInteractions,
  captureEaPanelUiState,
  restoreEaPanelUiState,
} from './estado-actual-panel-clinico.mjs';
import { syncEaCopyFab } from './estado-actual-panel-actions.mjs';
import { mountDescongestionPanel } from './cardio/descongestion-panel.mjs';
import { mountCongestionPanel } from './cardio/congestion-panel.mjs';

/** Slot above vitals for IC descongestión + congestión/POCUS. */
var EA_CARDIO_IC_SLOT_HTML = '<div id="ea-cardio-ic" class="ea-cardio-ic"></div>';

/**
 * @param {HTMLElement} mount
 * @param {ReturnType<typeof import('./estado-actual-panel-core.mjs').findActivePatient>} patient
 */
export function mountEaCardioIcBlocks(mount, patient) {
  var host = mount && mount.querySelector('#ea-cardio-ic');
  if (!host || !patient) return;
  var dayEl = host.querySelector('[data-ea-cardio-pocus-day]');
  var keepDay = dayEl && dayEl.value ? String(dayEl.value) : '';
  host.innerHTML =
    '<div data-ea-cardio-descongestion-host></div>' +
    '<div data-ea-cardio-congestion-host></div>';
  mountDescongestionPanel(host.querySelector('[data-ea-cardio-descongestion-host]'), patient);
  mountCongestionPanel(host.querySelector('[data-ea-cardio-congestion-host]'), patient, {
    day: keepDay || undefined,
  });
}

export function buildEaShellKey(activeId, monitoreo) {
  return String(activeId || '') + '|' + buildEaMonitoreoRevision(monitoreo, activeId, medRecetaByPatient);
}

export function buildEaDataKey(monitoreo, activeId) {
  return buildEaMonitoreoRevision(monitoreo, activeId, medRecetaByPatient);
}

export function renderEaEmptyPanel(mount, onReady) {
  syncEaCopyFab(false);
  invalidateEaPanelCache();
  mount.innerHTML =
    '<div class="estado-actual-panel ea-empty">' +
    '<div class="empty-state empty-state--compact" role="status">' +
    '<h3 class="empty-state-title">Selecciona un paciente para monitoreo</h3>' +
    '<p class="empty-state-lead">Elige uno en el censo de la izquierda. Ahí podrás registrar signos, balance hídrico y dieta.</p>' +
    '</div>' +
    '</div>';
  if (onReady) onReady();
}

/**
 * @param {ReturnType<typeof import('./estado-actual-panel-core.mjs').findActivePatient>} patient
 * @param {string | null} activeId
 * @param {Record<string, unknown>} monitoreo
 */
export function syncEaRecetaProposals(patient, activeId, monitoreo) {
  var changed = false;
  if (
    applyDietProposalFromRecetaBlock(
      monitoreo,
      activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null
    )
  ) {
    changed = true;
  }
  if (
    syncRecetaProposalsFromSoapSelection(
      activeId,
      monitoreo,
      medRecetaByPatient,
      medNotaSelectionByPatient,
      classifyMedicationSoapCategory
    )
  ) {
    changed = true;
  }
  if (
    syncMonitoreoInsulinPumpFromReceta(
      monitoreo,
      activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null
    )
  ) {
    changed = true;
  }
  if (changed) saveState();
}

/**
 * @param {HTMLElement} mount
 * @param {ReturnType<typeof import('./estado-actual-panel-core.mjs').findActivePatient>} patient
 * @param {Record<string, unknown>} monitoreo
 * @param {{ refreshClinico?: boolean, skipChartsSummary?: boolean }} patchOpts
 */
export function patchEaPanelDynamicSections(mount, patient, monitoreo, patchOpts) {
  patchOpts = patchOpts || {};
  var snapshot = deriveSnapshot(monitoreo);
  var balTurno = balanceTurno(monitoreo);
  var balGlobal = balanceGlobalHistorico(monitoreo);
  var savedLabel = formatEaSavedLabel(monitoreo.textoGuardado && monitoreo.textoGuardado.savedAt);

  if (patchOpts.refreshClinico) {
    var clinicoDet = mount.querySelector('.ea-estado-clinico');
    if (clinicoDet) {
      clinicoDet.outerHTML = renderEstadoClinicoSection(monitoreo, getEaPanelRuntime().getActiveId(), patient);
      wireEstadoClinicoInteractions(mount, patient);
    }
  }

  var snapEl = mount.querySelector('#ea-snapshot');
  if (snapEl) snapEl.outerHTML = renderSnapshotSection(snapshot, balTurno, balGlobal);

  var histEl = mount.querySelector('#ea-historial');
  if (histEl) {
    var histWasOpen = histEl.open;
    histEl.outerHTML = renderHistorialSection(Array.isArray(monitoreo.historial) ? monitoreo.historial : []);
    if (histWasOpen) {
      var newHist = mount.querySelector('#ea-historial');
      if (newHist) newHist.open = true;
    }
  }

  var meta = mount.querySelector('#ea-meta-guardado');
  if (meta) meta.textContent = savedLabel;

  if (!patchOpts.skipChartsSummary) {
    var chartsSummary = mount.querySelector('#ea-charts-summary');
    if (chartsSummary) {
      var chartsRev = buildEaHistorialChartsRevision(monitoreo);
      if (mount._eaChartsSummaryRev !== chartsRev) {
        mount._eaChartsSummaryRev = chartsRev;
        chartsSummary.outerHTML = renderEaChartsSummarySection(monitoreo);
      }
    }
  }

  mountEaCardioIcBlocks(mount, patient);
}

/**
 * @param {HTMLElement} mount
 * @param {ReturnType<typeof import('./estado-actual-panel-core.mjs').findActivePatient>} patient
 * @param {Record<string, unknown>} monitoreo
 * @param {string | null} activeId
 * @param {string} savedLabel
 */
export function renderEaFullPanelShell(mount, patient, monitoreo, activeId, savedLabel) {
  var eaUiState = captureEaPanelUiState(mount);
  var snapshot = deriveSnapshot(monitoreo);
  var balTurno = balanceTurno(monitoreo);
  var balGlobal = balanceGlobalHistorico(monitoreo);

  mount.innerHTML =
    '<div class="estado-actual-panel">' +
    '<div class="ea-action-bar">' +
    '<div class="ea-action-bar__cluster" role="group" aria-label="Acciones de monitoreo">' +
    '<button type="button" class="ea-btn" onclick="openEstadoActualRegistroModal()">Registro manual</button>' +
    '<button type="button" class="ea-btn ea-btn--success" onclick="estadoActualGuardar()">Guardar</button>' +
    '</div>' +
    '<span id="ea-meta-guardado" class="ea-meta-guardado">' +
    savedLabel +
    '</span>' +
    '</div>' +
    EA_CARDIO_IC_SLOT_HTML +
    renderSnapshotSection(snapshot, balTurno, balGlobal) +
    renderEstadoClinicoSection(monitoreo, activeId, patient) +
    renderHistorialSection(Array.isArray(monitoreo.historial) ? monitoreo.historial : []) +
    renderEaChartsSummarySection(monitoreo) +
    '</div>';

  restoreEaPanelUiState(mount, eaUiState);
  wireEstadoClinicoInteractions(mount, patient);
  mountEaCardioIcBlocks(mount, patient);
}
