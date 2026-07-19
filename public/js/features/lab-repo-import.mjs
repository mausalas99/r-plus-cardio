import { refreshRpcDateFields } from '../rpc-date-picker.mjs';
import { registerLabPanelRuntime, rt } from './lab-panel-runtime-state.mjs';
import {
  buildLabRepoPreviewBlocks,
  buildLabRepoBulkText,
  shouldSilentImportLabRepo,
  resolveLabRepoFetchUserMessage,
} from './lab-repo-import-gate.mjs';
import { openLabBulkPreviewModal } from './lab-bulk-preview-modal.mjs';
import { finalizeBulkLabPaste } from './lab-panel-workbench.mjs';

function defaultDateRange() {
  var hasta = new Date();
  hasta.setHours(0, 0, 0, 0);
  var desde = new Date(hasta);
  desde.setDate(desde.getDate() - 2);
  return { desde: desde, hasta: hasta };
}

function toDateInputValue(d) {
  var pad = function (n) {
    return String(n).padStart(2, '0');
  };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseDateInputDay(isoDay) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  if (!m) return null;
  var y = Number(m[1]);
  var mo = Number(m[2]) - 1;
  var day = Number(m[3]);
  var dt = new Date(y, mo, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return dt;
}

/** Inclusive calendar-day range for portal Fecha Solicitud filter. */
export function labRepoFetchRangeFromDateInputs(desdeDay, hastaDay) {
  var desde = parseDateInputDay(desdeDay);
  var hasta = parseDateInputDay(hastaDay);
  if (!desde || !hasta) return null;
  desde.setHours(0, 0, 0, 0);
  hasta.setHours(23, 59, 59, 999);
  if (desde.getTime() > hasta.getTime()) return null;
  return { desde: desde, hasta: hasta };
}

function syncLabRepoDateField(input) {
  if (!input) return;
  input.dispatchEvent(new Event('rpc-date-refresh'));
}

function getActivePatient() {
  return typeof rt.getActivePatient === 'function' ? rt.getActivePatient() : null;
}

function getRegistroInitial() {
  var p = getActivePatient();
  return p && p.registro ? String(p.registro).trim() : '';
}

function registroReadOnly() {
  return !!getRegistroInitial();
}

function readLabRepoImportFields() {
  var registroEl = document.getElementById('lab-repo-registro');
  var desdeEl = document.getElementById('lab-repo-desde');
  var hastaEl = document.getElementById('lab-repo-hasta');
  if (!registroEl || !desdeEl || !hastaEl) return null;
  return {
    registro: String(registroEl.value || '').trim(),
    desde: String(desdeEl.value || '').trim(),
    hasta: String(hastaEl.value || '').trim(),
  };
}

function validateLabRepoImportFields(fields) {
  if (!fields) return false;
  if (!fields.registro) {
    rt.showToast('Indica el registro', 'error');
    return false;
  }
  if (!fields.desde || !fields.hasta) {
    rt.showToast('Indica el rango de fechas', 'error');
    return false;
  }
  if (!window.electronAPI || typeof window.electronAPI.labRepoFetch !== 'function') {
    rt.showToast('Importación del repositorio solo en la app de escritorio', 'warn');
    return false;
  }
  return true;
}

function setLabRepoImportBusy(busy) {
  var btnImport = document.getElementById('lab-repo-import-confirm');
  if (!btnImport) return;
  btnImport.disabled = busy;
  btnImport.setAttribute('aria-disabled', busy ? 'true' : 'false');
}

function toastLabRepoFetchOutcome(studies, errors) {
  var msg = resolveLabRepoFetchUserMessage(studies, errors);
  if (!msg) return true;
  rt.showToast(msg.toast, msg.type);
  return false;
}

function finishLabRepoImport(studies, registro, errors) {
  var blocks = buildLabRepoPreviewBlocks(studies, rt.findPatientByRegistro);
  var active = getActivePatient();
  var gate = shouldSilentImportLabRepo({
    blocks: blocks,
    fetchErrors: errors || [],
    requestedRegistro: registro,
    activePatientRegistro: active && active.registro ? String(active.registro) : '',
    activePatientId: rt.getActiveId ? rt.getActiveId() : null,
  });
  var text = buildLabRepoBulkText(studies);
  var totalOk = blocks.reduce(function (n, b) {
    return n + (b.okReportCount || 0);
  }, 0);

  closeLabRepoImportModal();
  if (gate.silent) {
    finalizeBulkLabPaste(text, blocks, totalOk);
    return;
  }

  openLabBulkPreviewModal({
    blocks: blocks,
    sourceText: text,
    onConfirm: function () {
      finalizeBulkLabPaste(text, blocks, totalOk);
    },
  });
}

export function registerLabRepoImportRuntime(ctx) {
  registerLabPanelRuntime(ctx);
}

export function openLabRepoImportModal() {
  var modal = document.getElementById('lab-repo-import-modal');
  if (!modal) return;
  var registroEl = document.getElementById('lab-repo-registro');
  var desdeEl = document.getElementById('lab-repo-desde');
  var hastaEl = document.getElementById('lab-repo-hasta');
  if (!registroEl || !desdeEl || !hastaEl) return;

  var range = defaultDateRange();
  refreshRpcDateFields(modal);
  desdeEl.value = toDateInputValue(range.desde);
  hastaEl.value = toDateInputValue(range.hasta);
  syncLabRepoDateField(desdeEl);
  syncLabRepoDateField(hastaEl);

  var registro = getRegistroInitial();
  registroEl.value = registro;
  registroEl.readOnly = registroReadOnly();
  if (registroReadOnly()) {
    registroEl.setAttribute('aria-readonly', 'true');
  } else {
    registroEl.removeAttribute('aria-readonly');
  }

  modal.hidden = false;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  registroEl.focus();
}

export function closeLabRepoImportModal() {
  var modal = document.getElementById('lab-repo-import-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;
}

export async function confirmLabRepoImport() {
  var fields = readLabRepoImportFields();
  if (!validateLabRepoImportFields(fields)) return;

  var range = labRepoFetchRangeFromDateInputs(fields.desde, fields.hasta);
  if (!range) {
    rt.showToast('Revisa el rango de fechas (Desde no puede ser posterior a Hasta)', 'error');
    return;
  }

  setLabRepoImportBusy(true);
  rt.showToast('Consultando repositorio…', 'info');
  try {
    var res = await window.electronAPI.labRepoFetch({
      registro: fields.registro,
      desde: range.desde.toISOString(),
      hasta: range.hasta.toISOString(),
    });
    var studies = (res && res.studies) || [];
    var errors = (res && res.errors) || [];
    if (!toastLabRepoFetchOutcome(studies, errors)) return;
    finishLabRepoImport(studies, fields.registro, errors);
  } catch (_unused) {
    void _unused;
    rt.showToast('Error al consultar el repositorio', 'error');
  } finally {
    setLabRepoImportBusy(false);
  }
}
