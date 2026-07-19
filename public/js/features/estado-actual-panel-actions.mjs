/** EA panel actions — registro submit, guardar/copiar, propuestas. */
import { saveState, medRecetaByPatient } from '../app-state.mjs';
import { scheduleLiveSyncPush } from './lan-sync.mjs';
import {
  ensureMonitoreo,
  appendMedicion,
  removeMedicion,
  resolveDietWeightKg,
  syncDietKcalFromWeight,
} from './estado-actual-data.mjs';
import {
  parseIoEgresoLine,
  parseIoEvacField,
  parseIoIngresoField,
  diuresisValueFromParts,
} from './estado-actual-io.mjs';
import {
  datetimeLocalToIso,
  isoToHHmm,
  parseNumOrNull,
  formatEaSavedLabel,
} from './estado-actual-panel-format.mjs';
import {
  parseVitalsFromForm,
  parseGlucometriasFromForm,
  parseBombaFromForm,
} from './estado-actual-panel-parse-form.mjs';
import { validateVitalSeriesTurnLimits } from './estado-actual-panel-vitals.mjs';
import { MAX_VITAL_READINGS_PER_DAY } from './estado-actual-vital-series.mjs';
import {
  confirmMedField,
  discardMedProposal,
  confirmAllMedProposals,
  confirmDietProposal,
  discardDietProposal,
} from './estado-actual-meds.mjs';
import { backfillDietPendingMacrosFromReceta } from './estado-actual-meds-diet.mjs';
import { renderEstadoActualBar } from './soap-estado.mjs';
import { migrateGranularInner } from '../expediente-tabs.mjs';
import { getEaPanelRuntime } from './estado-actual-panel-runtime.mjs';
import { findActivePatient } from './estado-actual-panel-core.mjs';
import { eaPanelBridge } from './estado-actual-panel-bridge.mjs';
import { syncEaRegistroInsulinRescateFlag } from './estado-actual-panel-registro-io.mjs';
import {
  flushEaEstadoClinicoFieldsFromDom,
  persistEstadoClinicoAndRefresh,
  getEstadoActualTextForPatient,
} from './estado-actual-panel-clinico.mjs';
import {
  buildRegistroFormMarkup,
  wireEaRegistroForm,
  resetEaRegistroForm,
  applyEstadoActualParsedToForm,
} from './estado-actual-panel-registro.mjs';

function parseFormMedicion() {
  var form = document.getElementById('ea-form');
  if (!form) return null;

  var recordedLocal = /** @type {HTMLInputElement | null} */ (document.getElementById('ea-recorded-at'));
  var recordedAt = datetimeLocalToIso(recordedLocal ? recordedLocal.value : '');
  var defaultTime = isoToHHmm(recordedAt);

  var vitalBlock = parseVitalsFromForm(form, defaultTime);
  var bombaToggle = /** @type {HTMLInputElement | null} */ (document.getElementById('ea-bomba-enabled'));
  var bombaOn = !!(bombaToggle && bombaToggle.checked);
  var glucometrias = bombaOn ? [] : parseGlucometriasFromForm(form, defaultTime);
  var bombaInsulina = bombaOn ? parseBombaFromForm(form, defaultTime) : [];

  var ingEl = document.getElementById('ea-io-ing');
  var egrEl = document.getElementById('ea-io-egr');
  var evacEl = document.getElementById('ea-io-evac');
  var egrParts = parseIoEgresoLine(egrEl && 'value' in egrEl ? String(egrEl.value) : '');

  return {
    id: Date.now().toString() + '-ea',
    recordedAt: recordedAt,
    vitals: vitalBlock.vitals,
    vitalSeries: vitalBlock.vitalSeries,
    alteredAt: vitalBlock.alteredAt,
    glucometrias: glucometrias,
    bombaInsulina: bombaInsulina,
    io: {
      ing: parseIoIngresoField(ingEl && 'value' in ingEl ? ingEl.value : ''),
      egr: diuresisValueFromParts(egrParts),
      egrParts: egrParts,
      evac: parseIoEvacField(evacEl && 'value' in evacEl ? evacEl.value : ''),
    },
  };
}

export function registrarEstadoActualMedicion() {
  var patient = findActivePatient();
  if (!patient) {
    getEaPanelRuntime().showToast('Selecciona un paciente primero', 'error');
    return;
  }
  ensureMonitoreo(patient);
  var medicion = parseFormMedicion();
  if (!medicion) {
    getEaPanelRuntime().showToast('Formulario no disponible', 'error');
    return;
  }
  var vitalLimit = validateVitalSeriesTurnLimits(patient.monitoreo.historial, medicion.vitalSeries || {});
  if (!vitalLimit.ok) {
    getEaPanelRuntime().showToast(
      'Máximo ' + MAX_VITAL_READINGS_PER_DAY + ' lecturas de ' + vitalLimit.label + ' en el turno',
      'error'
    );
    return;
  }
  var result = appendMedicion(patient.monitoreo, medicion);
  if (!result.ok) {
    getEaPanelRuntime().showToast('No se pudo registrar la medición', 'error');
    return;
  }
  syncDietKcalFromWeight(
    patient.monitoreo.estadoClinico,
    resolveDietWeightKg({
      patientPeso: patient.peso,
      pesoRef: patient.monitoreo.estadoClinico && patient.monitoreo.estadoClinico.pesoRef,
    })
  );
  saveState();
  resetEaRegistroForm(null);
  if (getEaPanelRuntime().invalidateInnerTabRenderCache) getEaPanelRuntime().invalidateInnerTabRenderCache('estadoActual');
  if (typeof window.closeEstadoActualRegistroModal === 'function') window.closeEstadoActualRegistroModal();
  eaPanelBridge.renderEstadoActualPanel({ syncHeavy: true, dataOnly: true });
  getEaPanelRuntime().showToast('Medición registrada ✓', 'success');
  if (typeof getEaPanelRuntime().onMedicionRegistered === 'function') getEaPanelRuntime().onMedicionRegistered();
}

export function ensureEaRegistroModalForm() {
  var body = document.getElementById('ea-registro-modal-body');
  if (!body) return;
  if (
    !body.querySelector('#ea-form') ||
    !body.querySelector('.ea-registro-shell') ||
    !body.querySelector('[data-ea-vital-stack="tas"]')
  ) {
    body.innerHTML = buildRegistroFormMarkup();
  }
  var patient = findActivePatient();
  wireEaRegistroForm(patient && patient.monitoreo ? patient.monitoreo : null);
}

/**
 * @param {string} id
 */
export function eliminarEstadoActualMedicion(id) {
  var patient = findActivePatient();
  if (!patient || !id) return;
  ensureMonitoreo(patient);
  removeMedicion(patient.monitoreo, id);
  saveState();
  scheduleLiveSyncPush();
  eaPanelBridge.renderEstadoActualPanel({ syncHeavy: true });
  getEaPanelRuntime().showToast('Medición eliminada', 'success');
}

/**
 * @param {ReturnType<typeof findActivePatient>} patient
 * @param {string} text
 */
function persistEstadoActualTexto(patient, text) {
  if (!patient || !patient.monitoreo) return;
  patient.monitoreo.textoGuardado = {
    text: text,
    savedAt: new Date().toISOString(),
  };
  saveState();
  scheduleLiveSyncPush();
  renderEstadoActualBar();
  var meta = document.getElementById('ea-meta-guardado');
  if (meta && patient.monitoreo.textoGuardado.savedAt) {
    meta.textContent = formatEaSavedLabel(patient.monitoreo.textoGuardado.savedAt);
  }
}

export function estadoActualGuardar() {
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  flushEaEstadoClinicoFieldsFromDom(patient);
  var text = getEstadoActualTextForPatient(patient);
  if (!text.trim()) {
    getEaPanelRuntime().showToast('No hay texto para guardar', 'error');
    return;
  }
  persistEstadoActualTexto(patient, text);
  getEaPanelRuntime().showToast('Estado Actual guardado ✓', 'success');
}

export async function estadoActualGuardarCopiar() {
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  flushEaEstadoClinicoFieldsFromDom(patient);
  var text = getEstadoActualTextForPatient(patient);
  if (!text.trim()) {
    getEaPanelRuntime().showToast('No hay texto para guardar', 'error');
    return;
  }
  persistEstadoActualTexto(patient, text);
  var ok = await getEaPanelRuntime().copyToClipboardSafe(text);
  getEaPanelRuntime().showToast(
    ok ? 'Estado Actual guardado y copiado ✓' : 'Guardado, pero no se pudo copiar',
    ok ? 'success' : 'error'
  );
}

var eaCopyFabBound = false;

function eaCopyFabContextActive() {
  var runtime = getEaPanelRuntime();
  if (typeof runtime.getActiveAppTab === 'function' && runtime.getActiveAppTab() !== 'nota') return false;
  if (typeof runtime.getActiveInner !== 'function' || typeof runtime.getSettings !== 'function') return true;
  var inner = migrateGranularInner(runtime.getActiveInner() || 'todo', runtime.getSettings());
  return inner === 'estadoActual';
}

function hideLabCopyFabDom() {
  var fab = document.getElementById('lab-copy-fab');
  if (!fab) return;
  fab.setAttribute('hidden', '');
  fab.style.display = 'none';
  fab.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('lab-copy-fab-active');
}

function ensureEaCopyFabController() {
  var fab = document.getElementById('ea-copy-fab');
  if (!fab || eaCopyFabBound) return;
  eaCopyFabBound = true;
  if (fab.parentElement !== document.body) document.body.appendChild(fab);
  fab.removeAttribute('onclick');
  fab.addEventListener(
    'mousedown',
    function (e) {
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
  fab.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (fab.hidden) return;
    void copiarEstadoActualTexto();
  });
}

export function syncEaCopyFab(show) {
  ensureEaCopyFabController();
  var visible = !!show && eaCopyFabContextActive();
  if (visible) hideLabCopyFabDom();
  var fab = document.getElementById('ea-copy-fab');
  if (fab) {
    if (visible) {
      fab.removeAttribute('hidden');
      fab.style.display = 'flex';
      fab.setAttribute('aria-hidden', 'false');
    } else {
      fab.setAttribute('hidden', '');
      fab.style.display = 'none';
      fab.setAttribute('aria-hidden', 'true');
    }
  }
  document.documentElement.classList.toggle('ea-copy-fab-active', visible);
}

export function eaHasCopyableContent() {
  var patient = findActivePatient();
  if (!patient) return false;
  var text = getEstadoActualTextForPatient(patient);
  return !!String(text || '').trim();
}

export async function copiarEstadoActualTexto() {
  var patient = findActivePatient();
  if (!patient) {
    getEaPanelRuntime().showToast('Selecciona un paciente primero', 'error');
    return;
  }
  ensureMonitoreo(patient);
  var text = getEstadoActualTextForPatient(patient);
  if (!text.trim()) {
    getEaPanelRuntime().showToast('No hay texto para copiar', 'error');
    return;
  }
  var ok = await getEaPanelRuntime().copyToClipboardSafe(text);
  getEaPanelRuntime().showToast(ok ? 'Texto copiado al portapapeles ✓' : 'No se pudo copiar', ok ? 'success' : 'error');
}

/**
 * @param {string} key
 */
export function confirmEaMedField(key) {
  var patient = findActivePatient();
  if (!patient || !key) return;
  ensureMonitoreo(patient);
  confirmMedField(patient.monitoreo, key);
  persistEstadoClinicoAndRefresh(patient.monitoreo, 'Propuesta confirmada', patient);
}

/**
 * @param {string} key
 */
export function discardEaMedProposal(key) {
  var patient = findActivePatient();
  if (!patient || !key) return;
  ensureMonitoreo(patient);
  discardMedProposal(patient.monitoreo, key);
  persistEstadoClinicoAndRefresh(patient.monitoreo, 'Propuesta descartada', patient);
}

export function confirmEaDietProposal() {
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  var activeId = getEaPanelRuntime().getActiveId();
  var recetaBlock = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  backfillDietPendingMacrosFromReceta(patient.monitoreo, recetaBlock);
  confirmDietProposal(patient.monitoreo);
  persistEstadoClinicoAndRefresh(patient.monitoreo, 'Dieta confirmada', patient);
}

export function discardEaDietProposal() {
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  discardDietProposal(patient.monitoreo);
  persistEstadoClinicoAndRefresh(patient.monitoreo, 'Propuesta de dieta descartada', patient);
}

export function confirmAllEaMedProposals() {
  var patient = findActivePatient();
  if (!patient) return;
  ensureMonitoreo(patient);
  confirmAllMedProposals(patient.monitoreo);
  persistEstadoClinicoAndRefresh(patient.monitoreo, 'Propuestas confirmadas', patient);
}

export function toggleEaEstadoClinico() {
  var details = document.querySelector('.ea-estado-clinico');
  if (details && 'open' in details) details.open = !details.open;
}

export const windowHandlers = {
  registrarEstadoActualMedicion,
  eliminarEstadoActualMedicion,
  estadoActualGuardar,
  estadoActualGuardarCopiar,
  copiarEstadoActualTexto,
  confirmEaMedField,
  discardEaMedProposal,
  confirmEaDietProposal,
  discardEaDietProposal,
  confirmAllEaMedProposals,
  toggleEaEstadoClinico,
  applyEstadoActualParsedToForm,
};
