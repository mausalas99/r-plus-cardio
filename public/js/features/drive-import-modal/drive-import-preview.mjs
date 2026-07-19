import { getDriveImportRuntime } from './drive-import-state.mjs';
import { driveImportState } from './drive-import-state.mjs';
import {
  getParseHintEl,
  getTextarea,
  getWarningEl,
  getApplyMode,
} from './drive-import-dom.mjs';
import { getParsed, hasImportableContent } from './drive-import-parse.mjs';
import { renderReviewStep } from './drive-import-review-render.mjs';

export function updateDocSummary() {
  const ta = getTextarea();
  const el = document.getElementById('drive-import-doc-summary');
  if (!el || !ta) return;
  const text = String(ta.value || '');
  if (!text.trim()) {
    el.textContent = '';
    return;
  }
  const lines = text.split(/\r?\n/).length;
  el.textContent =
    'Documento pegado · ' + lines + ' línea' + (lines === 1 ? '' : 's') + ' · ' + text.length + ' caracteres';
}

function setPreviewButtonsDisabled(disabled) {
  const confirmBtn = document.getElementById('drive-import-confirm');
  const fastBtn = document.getElementById('drive-import-apply-fast');
  if (confirmBtn) confirmBtn.disabled = disabled;
  if (fastBtn) fastBtn.disabled = disabled;
}

function clearPreviewHints() {
  const parseHint = getParseHintEl();
  const warn = getWarningEl();
  if (parseHint) {
    parseHint.hidden = true;
    parseHint.textContent = '';
  }
  if (warn) warn.hidden = true;
}

function showParseError(err) {
  const parseHint = getParseHintEl();
  if (parseHint) {
    parseHint.hidden = false;
    parseHint.textContent = 'Error al analizar: ' + (err && err.message ? err.message : String(err));
  }
  setPreviewButtonsDisabled(true);
}

function updateParseHint(canImport) {
  const parseHint = getParseHintEl();
  if (!parseHint) return;
  if (canImport) {
    parseHint.hidden = true;
    parseHint.textContent = '';
    return;
  }
  parseHint.hidden = false;
  parseHint.textContent = 'No se detectó contenido importable con el modo seleccionado.';
}

function updateRegistroWarning(parsed) {
  const warn = getWarningEl();
  if (!warn) return;
  const rt = getDriveImportRuntime();
  const patient = rt.getActivePatient();
  if (!patient || !parsed.header || !parsed.header.registro) {
    warn.hidden = true;
    return;
  }
  const mismatch =
    String(parsed.header.registro).trim() &&
    String(patient.registro || '').trim() &&
    String(parsed.header.registro).trim() !== String(patient.registro).trim();
  warn.hidden = !mismatch;
  warn.textContent = mismatch
    ? 'El registro del documento (' +
      parsed.header.registro +
      ') no coincide con el paciente activo (' +
      patient.registro +
      ').'
    : '';
}

export function refreshPreview() {
  const ta = getTextarea();
  if (!ta || !String(ta.value || '').trim()) {
    clearPreviewHints();
    setPreviewButtonsDisabled(true);
    updateDocSummary();
    return;
  }

  let parsed;
  try {
    parsed = getParsed();
  } catch (err) {
    showParseError(err);
    updateDocSummary();
    return;
  }

  const mode = getApplyMode();
  const canImport = hasImportableContent(parsed, mode);
  updateParseHint(canImport);
  updateRegistroWarning(parsed);
  setPreviewButtonsDisabled(!canImport);
  updateDocSummary();
}

export function setReviewImportBusy(busy) {
  driveImportState.importBusy = busy;
  const nextBtn = document.getElementById('drive-import-review-next');
  const fastBtn = document.getElementById('drive-import-apply-fast');
  const confirmBtn = document.getElementById('drive-import-confirm');
  if (nextBtn) {
    nextBtn.disabled = busy;
    if (busy) nextBtn.textContent = 'Importando…';
    else if (driveImportState.modalStep === 'review') renderReviewStep();
  }
  if (fastBtn) fastBtn.disabled = busy;
  if (confirmBtn && busy) confirmBtn.disabled = true;
  if (!busy) refreshPreview();
}
