import { patients, saveState } from '../app-state.mjs';
import { syncHeaderContext } from './header-context.mjs';
import { flushRecetaHuDraftIfMountedFor } from './receta-hu.mjs';
import { stashMedInputForPatient } from './medications.mjs';
import { stashMedPharmPasteForPatient } from './med-pharm-profile-panel.mjs';
import { stashVpoForPatient } from './vpo.mjs';
import { flushSaveState } from '../app-state.mjs';
import { isModeSala } from '../mode-features.mjs';
import { migrateGranularInner } from '../expediente-tabs.mjs';
import {
  clinicalSessionContext,
  getClinicalScopeContextForEvaluate,
} from '../clinical-access-runtime.mjs';
import { evaluateClinicalScope } from '../clinico-access.mjs';
import { getUiDensity, isPaseMode } from './chrome.mjs';
import {
  removePatientLocally,
  rememberPatientDeleteTombstone,
  getActiveLiveSyncRoomId,
  scheduleLiveSyncPush,
} from './lan-sync.mjs';
import { stagePatientDelete } from '../patient-delete-sync.mjs';
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { patchPatientListActiveHighlight } from './patients-list.mjs';
import {
  syncRoundExpedienteLayout,
  scrollActiveRondaCardIntoView,
  setRoundOverviewMode,
} from './patients-round.mjs';

/** @param {string} iso */
function formatIncomingEffectiveLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {string|number} id
 * @returns {boolean} true when chart open should be blocked
 */
function blockIncomingPreviewChartOpen(id) {
  if (!clinicalSessionContext.user) return false;
  const patient = patients.find((p) => p && String(p.id) === String(id));
  const mapped = patient
    ? {
        id: String(patient.id),
        service: String(patient.servicio || patient.area || ''),
        sub_area: String(patient.area || ''),
        interconsult_type: patient.interconsult_type,
      }
    : { id: String(id) };
  const guardia = clinicalSessionContext.guardiasMap.get(String(id)) || null;
  const scope = evaluateClinicalScope(
    clinicalSessionContext.user,
    mapped,
    guardia,
    getClinicalScopeContextForEvaluate()
  );
  if (!scope.writable && scope.incomingPreview) {
    const assignment = (getClinicalScopeContextForEvaluate().assignments || []).find(
      (a) => String(a.patient_id) === String(id)
    );
    const when = formatIncomingEffectiveLabel(
      String(assignment?.effective_at || '')
    );
    rt.showToast(`Disponible el ${when}`, 'info');
    return true;
  }
  return false;
}

/**
 * @param {string|number} id
 * @param {{ bypassIncomingBlock?: boolean }} [opts]
 */
export function selectPatient(id, opts) {
  if (id == null || id === '') return;
  opts = opts || {};
  try {
    if (!opts.bypassIncomingBlock && blockIncomingPreviewChartOpen(id)) return;
    selectPatientCore(id);
  } catch (err) {
    console.error('[R+] selectPatient:', err && err.message ? err.message : err);
  }
}

function stashPatientDraftsOnChange(prevId) {
  flushRecetaHuDraftIfMountedFor(prevId);
  stashMedInputForPatient(prevId);
  stashMedPharmPasteForPatient(prevId);
  stashVpoForPatient(prevId);
  flushSaveState();
}

function showPatientViewShell() {
  var emptyState = document.getElementById('empty-state');
  var patientView = document.getElementById('patient-view');
  if (emptyState) emptyState.style.display = 'none';
  if (patientView) patientView.style.display = 'flex';
}

function switchInnerToTodo() {
  if (getUiDensity() === 'normal') {
    rt.setActiveInner('todo');
    rt.syncInnerTabVisualOnly();
  } else {
    rt.switchInnerTab('todo');
  }
}

function applyInnerTabOnSamePatient(settings, inner) {
  if (isModeSala(settings) && (inner === 'notas' || inner === 'indica' || !inner)) {
    switchInnerToTodo();
  } else if (!isModeSala(settings) && inner === 'listado') {
    switchInnerToTodo();
  }
  if (isPaseMode() && rt.getActiveAppTab() === 'nota') {
    setRoundOverviewMode(inner === 'todo' || !inner);
  }
}

function migrateInnerOnPatientChange(inner, settings) {
  var migrated = migrateGranularInner(inner || 'todo', settings);
  if (migrated !== inner) {
    rt.setActiveInner(migrated);
    return migrated;
  }
  return inner;
}

function scrollLabOutputIntoView() {
  var labOutput = document.getElementById('lab-output-section');
  if (!labOutput || labOutput.style.display === 'none') return;
  window.setTimeout(function () {
    try {
      labOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {
      labOutput.scrollIntoView(true);
    }
  }, 0);
}

function handleLabTabAfterPatientChange(wasOnLab, patientChanged) {
  if (!wasOnLab || !patientChanged) return false;
  rt.limpiarReporte();
  rt.renderLabHistoryPanel();
  if (isPaseMode()) {
    rt.syncWorkContextChrome();
    return true;
  }
  rt.switchAppTab('lab');
  scrollLabOutputIntoView();
  return true;
}

function selectPatientCore(id) {
  var prevId = rt.getActiveId();
  var wasOnLab = rt.getActiveAppTab() === 'lab';
  var appTab = rt.getActiveAppTab();
  var patientChanged = String(prevId ?? '') !== String(id);
  if (patientChanged) {
    stashPatientDraftsOnChange(prevId);
    rt.invalidateInnerTabRenderCache();
  }
  rt.setActiveId(id);
  if (!patientChanged || !patchPatientListActiveHighlight(id)) {
    patientsBridge.renderPatientList();
  }
  showPatientViewShell();
  rt.renderEstadoActualButton();
  syncHeaderContext(rt);
  var settings = rt.getSettings();
  var inner = rt.getActiveInner();
  if (patientChanged) {
    inner = migrateInnerOnPatientChange(inner, settings);
    if (isPaseMode() && rt.getActiveAppTab() === 'nota') {
      setRoundOverviewMode(inner === 'todo' || !inner);
    }
  } else {
    applyInnerTabOnSamePatient(settings, inner);
  }
  rt.syncInnerTabVisualOnly();
  rt.refreshExpedienteAfterPatientSelect({ patientChanged: patientChanged });
  if (appTab === 'lab') rt.renderLabHistoryPanel();
  if (appTab === 'med') rt.renderMedRecetaPanel();
  if (!handleLabTabAfterPatientChange(wasOnLab, patientChanged)) {
    rt.syncWorkContextChrome();
  }
  syncRoundExpedienteLayout();
  rt.refreshTendenciasOrCultivosPanel();
  if (isPaseMode()) rt.renderPaseBoard();
  if (rt.getActiveId()) {
    requestAnimationFrame(function () {
      scrollActiveRondaCardIntoView();
    });
  }
}

function confirmPatientDelete(target) {
  if (target && target.archived) return true;
  return confirm('¿Eliminar este paciente y sus notas?');
}

function syncLiveSyncPatientDelete(id, snap) {
  rememberPatientDeleteTombstone(snap);
  scheduleLiveSyncPush();
  stagePatientDelete(id, snap, function () {
    import('../lan-mutation-registry.mjs').then(function (m) {
      m.lanMutationRegistry.dispatchLanMutation('patient-fields', id);
    });
  });
}

function showEmptyPatientShell() {
  var pv = document.getElementById('patient-view');
  var es = document.getElementById('empty-state');
  if (pv) pv.style.display = 'none';
  if (es) es.style.display = 'flex';
  rt.syncWorkContextChrome();
}

export function deletePatient(e, id) {
  e.stopPropagation();
  var target = patients.find(function (p) {
    return p.id === id;
  });
  if (!confirmPatientDelete(target)) return;
  var label = target ? 'Eliminar ' + (target.nombre || 'paciente') : 'Eliminar paciente';
  if (typeof rt.pushUndoSnapshot === 'function') rt.pushUndoSnapshot(label);
  if (!removePatientLocally(id)) return;
  var snap = target || { id: id, registro: '' };
  if (getActiveLiveSyncRoomId()) {
    syncLiveSyncPatientDelete(id, snap);
  }
  saveState({ immediate: true });
  rt.addAuditEntry('patient-delete', 'ok', 1, target ? target.registro || target.nombre || '' : '');
  patientsBridge.renderPatientList();
  if (rt.getActiveId()) patientsBridge.selectPatient(rt.getActiveId());
  else showEmptyPatientShell();
}
