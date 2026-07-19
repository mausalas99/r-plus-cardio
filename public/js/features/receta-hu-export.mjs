import { setAsyncButtonLoading } from '../ui-motion.mjs';
import { buildRecetaHuGeneratePayload } from '../receta-hu-core.mjs';
import {
  exportWithOutputDirFallback,
  guardDocExportBlocked,
  saveOutputDirSelection,
} from '../document-export-client.mjs';
import { rt, aid, persistDraft, activePatient, recetaHuPanelVisible, ensureRecetaHuPanelVisible } from './receta-hu-shared.mjs';
import { readDraftFromDom } from './receta-hu-shared.mjs';
import { resetExportButtonState } from './receta-hu-button-state.mjs';

function validateRecetaHuExport() {
  if (rt.guardMobileDocExport()) return null;
  if (!recetaHuPanelVisible()) ensureRecetaHuPanelVisible();
  if (guardDocExportBlocked({ isRpcOffline: rt.isRpcOffline, showToast: rt.showToast })) return null;
  var pid = aid();
  if (!pid) {
    rt.showToast('Selecciona un paciente', 'error');
    return null;
  }
  var patient = activePatient();
  if (!patient) {
    rt.showToast('Paciente no encontrado', 'error');
    return null;
  }
  var st = rt.getSettings();
  if (!String(st.doctorName || '').trim()) {
    rt.showToast('Configura el médico tratante en Mi Perfil', 'error');
    return null;
  }
  if (!String(st.cedulaProfesional || '').trim()) {
    rt.showToast('Configura la cédula profesional en Mi Perfil', 'error');
    return null;
  }
  var draft = readDraftFromDom();
  persistDraft(pid, draft);
  return {
    patient: patient,
    draft: draft,
    doctorName: st.doctorName,
    cedulaProfesional: st.cedulaProfesional,
  };
}

function buildRecetaHuExportPayload(body) {
  return {
    patient: body.patient,
    receta: {
      fecha: body.fecha,
      meds: body.meds,
      labs: body.labs,
      cuidados: body.cuidados,
      proximaCita: body.proximaCita,
      proximaCitaFecha: body.proximaCitaFecha,
    },
    doctorName: body.doctorName,
    cedulaProfesional: body.cedulaProfesional,
  };
}

function selectRecetaHuOutputDir() {
  if (!window.electronAPI || !window.electronAPI.selectOutputDir) {
    return Promise.resolve(undefined);
  }
  return window.electronAPI.selectOutputDir();
}

function runRecetaHuPdfExport(body) {
  var btn = document.getElementById('btn-receta-hu-export');
  setAsyncButtonLoading(btn, true, { loadingText: 'Exportando…' });
  rt.incrementPendingJobs();

  exportWithOutputDirFallback({
    url: '/generate-receta-hu',
    buildPayload: function () {
      return buildRecetaHuExportPayload(body);
    },
    defaultFileName: 'receta-hu.pdf',
    selectOutputDir: selectRecetaHuOutputDir,
    saveOutputDir: function (dir) {
      saveOutputDirSelection(dir, {
        getSettings: rt.getSettings,
      });
    },
    onSuccess: function (data) {
      var name =
        data && (data.fileName || data.path)
          ? data.fileName || String(data.path).split(/[/\\]/).pop()
          : 'PDF';
      rt.showToast('Receta HU guardada: ' + name, 'success');
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
      rt.showToast('Error de conexión al generar el PDF', 'error');
    })
    .finally(function () {
      if (btn && !btn.dataset.uiMotionDefaultLabel) {
        btn.dataset.uiMotionDefaultLabel = 'Exportar PDF';
      }
      setAsyncButtonLoading(btn, false);
      rt.decrementPendingJobs();
      if (typeof rt.syncOfflineButtonStates === 'function') rt.syncOfflineButtonStates();
    });
}

export function exportRecetaHuPdf() {
  try {
    var ctx = validateRecetaHuExport();
    if (!ctx) return;
    var body = buildRecetaHuGeneratePayload({
      patient: ctx.patient,
      draft: ctx.draft,
      doctorName: ctx.doctorName,
      cedulaProfesional: ctx.cedulaProfesional,
    });
    runRecetaHuPdfExport(body);
  } catch (err) {
    console.error('[R+] exportRecetaHuPdf:', err && err.message ? err.message : err);
    resetExportButtonState();
    rt.showToast('No se pudo exportar la receta HU', 'error');
  }
}
