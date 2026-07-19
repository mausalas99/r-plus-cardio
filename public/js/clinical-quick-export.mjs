import { isModeSala } from './mode-features.mjs';
import { resolveQuickOutputAction } from './quick-output.mjs';
import { guardMobileDocExport } from './document-export-client.mjs';
import { normalizeQuickOutputFormat } from './features/profile.mjs';
import { generateWord, generateIndicaciones } from './features/notes-indicaciones.mjs';
import { generateListado } from './features/expediente.mjs';
import { incrementPendingJobs, decrementPendingJobs } from './features/platform/offline.mjs';
import { formatDateSlug, downloadTextPayload } from './features/platform/shared.mjs';
import { patients, notes, indicaciones, listadoProblemas } from './app-state.mjs';
import {
  escHtml,
  toLines,
  buildClinicalTextExport,
  buildClinicalHtmlExport,
} from './clinical-quick-export-helpers.mjs';

export { escHtml, toLines, buildClinicalTextExport, buildClinicalHtmlExport };

const quickExportRt = {
  getActiveId() {
    return null;
  },
  getActiveInner() {
    return 'todo';
  },
  getSettings() {
    return {};
  },
  showToast() {},
};

export function registerClinicalQuickExportRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(quickExportRt, ctx);
}

export function slugFilePart(value, fallback) {
  var base = String(value || '').trim().toLowerCase();
  var slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || fallback;
}

export function getCurrentPatientClinicalData() {
  var patient = patients.find(function (p) {
    return p.id === quickExportRt.getActiveId();
  });
  if (!patient) return null;
  return {
    patient: patient,
    note: notes[quickExportRt.getActiveId()] || {},
    indicacion: indicaciones[quickExportRt.getActiveId()] || {},
  };
}

export function exportCurrentPatientAsText() {
  var bundle = getCurrentPatientClinicalData();
  if (!bundle) return;
  bundle.mode = quickExportRt.getActiveInner() === 'indica' ? 'indica' : 'note';
  var fileName =
    'R-plus-' +
    slugFilePart(bundle.patient.nombre, 'paciente') +
    '-clinico-' +
    formatDateSlug(new Date()) +
    '.txt';
  incrementPendingJobs();
  try {
    downloadTextPayload(buildClinicalTextExport(bundle), fileName, 'text/plain');
    quickExportRt.showToast('Salida .txt descargada', 'success');
  } catch (e) {
    quickExportRt.showToast(
      'No se pudo exportar: ' + (e && e.message ? e.message : 'error'),
      'error'
    );
  } finally {
    decrementPendingJobs();
  }
}

export function exportCurrentPatientAsHtml() {
  var bundle = getCurrentPatientClinicalData();
  if (!bundle) return;
  bundle.mode = quickExportRt.getActiveInner() === 'indica' ? 'indica' : 'note';
  var fileName =
    'R-plus-' +
    slugFilePart(bundle.patient.nombre, 'paciente') +
    '-clinico-' +
    formatDateSlug(new Date()) +
    '.html';
  incrementPendingJobs();
  try {
    downloadTextPayload(buildClinicalHtmlExport(bundle), fileName, 'text/html');
    quickExportRt.showToast('Salida .html descargada', 'success');
  } catch (e) {
    quickExportRt.showToast(
      'No se pudo exportar: ' + (e && e.message ? e.message : 'error'),
      'error'
    );
  } finally {
    decrementPendingJobs();
  }
}

export function quickExportCurrentPatient() {
  if (guardMobileDocExport()) return;
  if (!quickExportRt.getActiveId()) {
    quickExportRt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var format = normalizeQuickOutputFormat(quickExportRt.getSettings().quickOutputFormat);
  var action = resolveQuickOutputAction({
    format: format,
    appMode: isModeSala(quickExportRt.getSettings()) ? 'sala' : 'interconsulta',
    activeInner: quickExportRt.getActiveInner(),
    listado: listadoProblemas[quickExportRt.getActiveId()] || null,
  });
  switch (action.kind) {
    case 'html':
      exportCurrentPatientAsHtml();
      return;
    case 'txt':
      exportCurrentPatientAsText();
      return;
    case 'listado':
      generateListado();
      return;
    case 'listado_empty':
      quickExportRt.showToast(action.message, 'error');
      return;
    case 'indicaciones':
      generateIndicaciones();
      return;
    case 'nota':
    default:
      generateWord();
      return;
  }
}
