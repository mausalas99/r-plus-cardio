import { isModeSala } from './mode-features.mjs';
import { isMobileWeb } from './mobile-web.mjs';
import {
  patients,
  labHistory,
  medRecetaByPatient,
  vpoByPatient,
  saveState,
} from './app-state.mjs';
import { storage } from './storage.js';
import { buildCensusPayload } from './censo-build.mjs';
import { openCensoPreviewInApp } from './censo-preview-html.mjs';
import { migratePatientDiagnosticosFromVpo } from './patient-diagnosticos.mjs';
import { setAsyncButtonLoading } from './ui-motion.mjs';
import {
  exportWithOutputDirFallback,
  guardDocExportBlocked,
  saveOutputDirSelection,
} from './document-export-client.mjs';

var rt = {
  getSettings() {
    return {};
  },
  showToast() {},
  requestDocumentJson() {
    return Promise.resolve(null);
  },
  handleDocumentGenerateResponse() {
    return Promise.resolve(null);
  },
  incrementPendingJobs() {},
  decrementPendingJobs() {},
  syncOfflineButtonStates() {},
  guardMobileDocExport() {
    return false;
  },
  isRpcOffline() {
    return false;
  },
};

export function registerCensoRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

var CENSO_EXPORT_BUTTON_IDS = [
  'btn-export-censo-header',
  'btn-export-censo-sidebar',
  'btn-export-censo-settings',
  'btn-export-censo',
];

export function syncCensoExportButtonVisibility() {
  var show = isModeSala(rt.getSettings()) && !isMobileWeb();
  CENSO_EXPORT_BUTTON_IDS.forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    if (id === 'btn-export-censo-settings') return;
    if (!show) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = id === 'btn-export-censo-header' ? 'inline-flex' : '';
  });
  var settingsRow = document.getElementById('btn-export-censo-settings-row');
  if (settingsRow) settingsRow.style.display = show ? '' : 'none';
  var wrap = document.getElementById('sidebar-censo-export-wrap');
  if (wrap) wrap.style.display = show ? '' : 'none';
}


/** Loading state only on the modal confirm control (export always runs from the dialog). */
function censoExportLoadingButtons() {
  ensureCensoModal();
  var confirm = document.getElementById('censo-export-confirm');
  return confirm ? [confirm] : [];
}

function buildTodosMap() {
  var map = Object.create(null);
  patients.forEach(function (p) {
    if (!p || !p.id) return;
    map[p.id] = storage.getTodos(p.id);
  });
  return map;
}

function preparePatientsForCensus() {
  patients.forEach(function (p) {
    if (!p) return;
    migratePatientDiagnosticosFromVpo(p, vpoByPatient[p.id]);
  });
  saveState();
}

function patientsForCensoExport() {
  if (typeof rt.getCensusPatients === 'function') {
    return rt.getCensusPatients();
  }
  return patients;
}

function ensureCensoModal() {
  var existing = document.getElementById('censo-export-modal');
  if (existing) return existing;
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'censo-export-modal';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="censo-export-title">' +
    '<h3 id="censo-export-title" class="modal-title">Exportar censo (PDF)</h3>' +
    '<p class="profile-hint" id="censo-export-fecha-label"></p>' +
    '<p class="profile-hint" id="censo-export-mes-label"></p>' +
    '<p class="profile-hint">Diagnósticos: máx. 3 primeros · filas según contenido (labs largos → más altura).</p>' +
    '<label class="profile-radio" style="display:flex;gap:8px;margin:12px 0;">' +
    '<input type="checkbox" id="censo-export-archived"> Incluir pacientes archivados</label>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn-med-secondary" id="censo-export-cancel">Cancelar</button>' +
    '<button type="button" class="btn-med-secondary" id="censo-export-preview">Vista previa</button>' +
    '<button type="button" class="btn-generate" id="censo-export-confirm">Generar PDF</button>' +
    '</div></div>';
  document.body.appendChild(backdrop);
  return backdrop;
}

export function openCensoExportDialog() {
  if (!isModeSala(rt.getSettings())) return;
  if (rt.guardMobileDocExport()) return;
  var modal = ensureCensoModal();
  var now = new Date();
  var fechaEl = document.getElementById('censo-export-fecha-label');
  var mesEl = document.getElementById('censo-export-mes-label');
  if (fechaEl) {
    fechaEl.textContent =
      'Fecha: ' +
      String(now.getDate()).padStart(2, '0') +
      '/' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '/' +
      now.getFullYear();
  }
  if (mesEl) {
    mesEl.textContent =
      'Mes: ' + now.toLocaleString('es-MX', { month: 'long' }).toUpperCase() + ' ' + now.getFullYear();
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCensoModal() {
  var modal = document.getElementById('censo-export-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

export function exportCensoPdf(includeArchived) {
  if (!isModeSala(rt.getSettings())) return;
  if (rt.guardMobileDocExport()) return;
  if (guardDocExportBlocked({ isRpcOffline: rt.isRpcOffline, showToast: rt.showToast })) return;
  preparePatientsForCensus();
  var censusPatients = patientsForCensoExport();
  var payload = buildCensusPayload({
    settings: rt.getSettings(),
    patients: censusPatients,
    includeArchived: !!includeArchived,
    labHistoryByPatient: labHistory,
    medRecetaByPatient: medRecetaByPatient,
    todosByPatient: buildTodosMap(),
  });
  if (!payload.rows.length) {
    rt.showToast('Sin pacientes para el censo', 'error');
    return;
  }
  var exportBtns = censoExportLoadingButtons();
  exportBtns.forEach(function (btn) {
    setAsyncButtonLoading(btn, true, { loadingText: 'Exportando…' });
  });
  rt.incrementPendingJobs();

  function buildBody() {
    return {
      header: payload.header,
      rows: payload.rows,
      servicio: payload.servicio,
    };
  }

  function selectOutputDir() {
    if (!window.electronAPI || !window.electronAPI.selectOutputDir) {
      return Promise.resolve(undefined);
    }
    return window.electronAPI.selectOutputDir();
  }

  return exportWithOutputDirFallback({
    url: '/generate-censo',
    buildPayload: buildBody,
    defaultFileName: 'Censo.pdf',
    selectOutputDir: selectOutputDir,
    saveOutputDir: function (dir) {
      saveOutputDirSelection(dir, {
        getSettings: rt.getSettings,
        loadSettings: rt.loadSettings,
      });
    },
    onSuccess: function (data) {
      var name =
        data && (data.fileName || data.path)
          ? data.fileName || String(data.path).split(/[/\\]/).pop()
          : 'PDF';
      rt.showToast('Censo guardado: ' + name, 'success');
    },
    onPrompt: function () {
      rt.showToast('Selecciona una carpeta para guardar el PDF.', 'error');
    },
    onCancel: function () {
      rt.showToast('No se guardó el PDF: no se eligió carpeta.', 'error');
    },
    onError: function (message) {
      rt.showToast('Error: ' + message, 'error');
    },
  })
    .catch(function () {
      rt.showToast('Error de conexión al generar el censo', 'error');
    })
    .finally(function () {
      exportBtns.forEach(function (btn) {
        setAsyncButtonLoading(btn, false);
      });
      rt.decrementPendingJobs();
      if (typeof rt.syncOfflineButtonStates === 'function') rt.syncOfflineButtonStates();
    });
}

export function exportCensoPdfFromHelp() {
  openCensoExportDialog();
}

function previewCenso(includeArchived) {
  if (!isModeSala(rt.getSettings())) return;
  preparePatientsForCensus();
  var censusPatients = patientsForCensoExport();
  var payload = buildCensusPayload({
    settings: rt.getSettings(),
    patients: censusPatients,
    includeArchived: !!includeArchived,
    labHistoryByPatient: labHistory,
    medRecetaByPatient: medRecetaByPatient,
    todosByPatient: buildTodosMap(),
  });
  if (!payload.rows.length) {
    rt.showToast('Sin pacientes para el censo', 'error');
    return;
  }
  openCensoPreviewInApp(payload);
}

function wireCensoModalOnce() {
  if (wireCensoModalOnce._done) return;
  wireCensoModalOnce._done = true;
  document.addEventListener('click', function (e) {
    if (e.target.id === 'censo-export-cancel') {
      closeCensoModal();
      return;
    }
    if (e.target.id === 'censo-export-preview') {
      var archivedPreview = !!document.getElementById('censo-export-archived')?.checked;
      previewCenso(archivedPreview);
      return;
    }
    if (e.target.id === 'censo-export-confirm') {
      var archived = !!document.getElementById('censo-export-archived')?.checked;
      closeCensoModal();
      exportCensoPdf(archived);
      return;
    }
    var modal = document.getElementById('censo-export-modal');
    if (modal && e.target === modal) closeCensoModal();
  });
}

if (typeof document !== 'undefined') {
  wireCensoModalOnce();
}
