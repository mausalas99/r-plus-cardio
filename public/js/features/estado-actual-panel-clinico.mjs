/** Estado clínico general section + DOM sync. */
import { patients, medRecetaByPatient, saveState } from '../app-state.mjs';
import { scheduleLiveSyncPush } from './lan-sync.mjs';
import {
  ensureMonitoreo,
  deriveSnapshot,
  balanceTurno,
  resolveDietWeightKg,
  syncDietKcalFromWeight,
  computeDietKcalTotal,
  isDietaSuplemento,
} from './estado-actual-data.mjs';
import {
  hasPendingEaProposals,
  estadoClinicoForDisplay,
  estadoClinicoForText,
  resolveManejoFechaActualizacion,
} from './estado-actual-meds.mjs';
import { renderMedCategoryGrid, wireMedCategoryGrid } from './estado-actual-med-ui.mjs';
import { buildEstadoActualText } from './estado-actual-text.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';
import { eaPanelBridge } from './estado-actual-panel-bridge.mjs';
import { renderEstadoClinicoBodyHtml } from './estado-actual-panel-clinico-html.mjs';
import {
  hasDietProposal,
  applyEstadoClinicoFieldChange,
} from './estado-actual-panel-clinico-fields.mjs';
import { DIET_PENDING_KEYS } from './estado-actual-meds.mjs';

/**
 * @param {string | null} activeId
 */
function eaManejoFechaOpts(activeId) {
  var fechaActualizacion = resolveManejoFechaActualizacion(activeId, medRecetaByPatient);
  return fechaActualizacion ? { fechaActualizacion: fechaActualizacion } : {};
}

function renderEstadoClinicoSection(monitoreo, activeId, patient) {
  var pend = monitoreo.pendienteReceta || {};
  var dietPending = hasDietProposal(pend);
  var ec = estadoClinicoForDisplay(monitoreo, eaManejoFechaOpts(activeId));
  var dietaSuplemento = isDietaSuplemento(ec.dieta);
  var dietWeight = resolveDietWeightKg({ patientPeso: patient && patient.peso, pesoRef: ec.pesoRef });
  var kcalDisplay = ec.kcal;
  if ((!dietPending || !String(pend.kcal || '').trim()) && dietWeight != null) {
    var kcalComputed = computeDietKcalTotal(ec.kcalKg, dietWeight);
    if (kcalComputed != null) kcalDisplay = String(kcalComputed);
  }
  var dietWeightHint =
    dietWeight != null
      ? 'Peso para cálculo: ' + dietWeight + ' kg (datos del paciente)'
      : 'Peso para cálculo: — (captura peso en Datos del paciente)';
  var medFieldsHtml = renderMedCategoryGrid(monitoreo, activeId, medRecetaByPatient);
  var anyPending = hasPendingEaProposals(pend);

  return (
    '<details class="ea-estado-clinico ea-card"' +
    (anyPending ? ' open' : '') +
    '>' +
    '<summary>Estado clínico general</summary>' +
    renderEstadoClinicoBodyHtml(ec, dietPending, dietaSuplemento, kcalDisplay, dietWeightHint, medFieldsHtml, anyPending) +
    '</details>'
  );
}

function getEstadoActualTextForPatient(patient) {
  if (!patient || !patient.monitoreo) return '';
  return generateEstadoActualText(patient.monitoreo, patient);
}

export function flushEaEstadoClinicoFieldsFromDom(patient, root) {
  var p = patient;
  if (!p) {
    var activeId = getEaPanelRuntime().getActiveId();
    if (!activeId) return false;
    p = patients.find(function (x) { return x && x.id === activeId; }) || null;
  }
  if (!p) return false;
  ensureMonitoreo(p);
  /** @type {any} */
  var mon = p.monitoreo;
  if (!mon || !mon.estadoClinico) return false;
  var mount =
    root && typeof root.querySelector === 'function'
      ? root
      : typeof document !== 'undefined'
        ? document.getElementById('exp-pane-estado-actual')
        : null;
  if (!mount) return false;
  var conf =
    mon.confirmado && typeof mon.confirmado === 'object' ? mon.confirmado : {};
  var dietProposalActive = hasDietProposal(mon.pendienteReceta) && !conf.dieta;
  var changed = false;
  mount.querySelectorAll('[data-ea-ec]').forEach(function (el) {
    var key = el.getAttribute('data-ea-ec');
    if (!key) return;
    var val = 'value' in el ? String(el.value) : '';
    if (String(mon.estadoClinico[key] || '') !== val) {
      mon.estadoClinico[key] = val;
      changed = true;
    }
    if (dietProposalActive && DIET_PENDING_KEYS.indexOf(key) >= 0) {
      if (!mon.pendienteReceta || typeof mon.pendienteReceta !== 'object') mon.pendienteReceta = {};
      if (String(mon.pendienteReceta[key] || '') !== val) {
        mon.pendienteReceta[key] = val;
        changed = true;
      }
    }
  });
  return changed;
}

function persistEstadoClinicoAndRefresh(monitoreo, toastMsg, patient) {
  flushEaEstadoClinicoFieldsFromDom(patient);
  saveState();
  scheduleLiveSyncPush();
  eaPanelBridge.renderEstadoActualPanel({ dataOnly: true, refreshClinico: true, skipChartsSummary: true });
  if (toastMsg) getEaPanelRuntime().showToast(toastMsg, 'success');
}

function persistEstadoClinicoLight(_monitoreo, patient) {
  flushEaEstadoClinicoFieldsFromDom(patient);
  saveState();
  scheduleLiveSyncPush();
}

function captureEaPanelUiState(mount) {
  if (!mount) return { clinicoOpen: false, historialOpen: false };
  var det = mount.querySelector('.ea-estado-clinico');
  var hist = mount.querySelector('.ea-historial');
  return { clinicoOpen: !!(det && det.open), historialOpen: !!(hist && hist.open) };
}

function restoreEaPanelUiState(mount, state) {
  if (!mount || !state) return;
  if (state.clinicoOpen) {
    var det = mount.querySelector('.ea-estado-clinico');
    if (det) det.open = true;
  }
  if (state.historialOpen) {
    var hist = mount.querySelector('.ea-historial');
    if (hist) hist.open = true;
  }
}

function wireEstadoClinicoInteractions(mount, patient) {
  if (!mount || !patient) return;
  mount.querySelectorAll('[data-ea-ec]').forEach(function (el) {
    var tag = (el.tagName || '').toUpperCase();
    var handler = function () { applyEstadoClinicoFieldChange(el, patient); };
    if (tag === 'SELECT') el.addEventListener('change', handler);
    else el.addEventListener('input', handler);
  });
  wireMedCategoryGrid(mount, {
    patient: patient,
    medRecetaByPatient: medRecetaByPatient,
    getActiveId: function () { return getEaPanelRuntime().getActiveId(); },
    saveState: saveState,
    syncTextarea: function () {},
  });
}

function generateEstadoActualText(monitoreo, patient, activeId) {
  var snapshot = deriveSnapshot(monitoreo);
  var weightKg = resolveDietWeightKg({
    patientPeso: patient && patient.peso,
    pesoRef: monitoreo.estadoClinico && monitoreo.estadoClinico.pesoRef,
  });
  if (monitoreo.estadoClinico) syncDietKcalFromWeight(monitoreo.estadoClinico, weightKg);
  var id = activeId != null ? activeId : getEaPanelRuntime().getActiveId();
  var recetaBlock = id && medRecetaByPatient ? medRecetaByPatient[id] : null;
  return buildEstadoActualText(
    estadoClinicoForText(monitoreo, eaManejoFechaOpts(id)),
    snapshot,
    { balanceTurno: balanceTurno(monitoreo) },
    { patientPeso: patient && patient.peso, recetaBlock: recetaBlock, bombaAlgoritmo: monitoreo.bombaInsulinaAlgoritmo ?? null }
  );
}

export {
  persistEstadoClinicoAndRefresh,
  persistEstadoClinicoLight,
  captureEaPanelUiState,
  restoreEaPanelUiState,
  getEstadoActualTextForPatient,
  renderEstadoClinicoSection,
  wireEstadoClinicoInteractions,
  generateEstadoActualText,
};
