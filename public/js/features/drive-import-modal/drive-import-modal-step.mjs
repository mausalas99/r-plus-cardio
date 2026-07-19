import { driveImportState, getDriveImportRuntime } from './drive-import-state.mjs';
import { getBackdrop, getModalEl, getTextarea } from './drive-import-dom.mjs';

export function syncConfirmLabel() {
  const btn = document.getElementById('drive-import-confirm');
  const modeFs = document.getElementById('drive-import-mode-fieldset');
  const rt = getDriveImportRuntime();
  const patient = rt.getActivePatient();
  if (modeFs) modeFs.style.display = patient ? '' : 'none';
  if (!btn || driveImportState.modalStep !== 'paste') return;
  btn.textContent = 'Revisar secciones…';
}

export function setModalStep(step, hooks) {
  driveImportState.modalStep = step;
  const modal = getModalEl();
  const pasteEl = document.getElementById('drive-import-step-paste');
  const reviewEl = document.getElementById('drive-import-step-review');
  const actionsPaste = document.getElementById('drive-import-actions-paste');
  const actionsReview = document.getElementById('drive-import-actions-review');
  const title = document.getElementById('drive-import-title');
  const hint = document.getElementById('drive-import-hint');
  const modeFs = document.getElementById('drive-import-mode-fieldset');

  if (modal) modal.setAttribute('data-drive-step', step);
  if (pasteEl) pasteEl.hidden = step !== 'paste';
  if (reviewEl) reviewEl.hidden = step !== 'review';
  if (actionsPaste) actionsPaste.hidden = step !== 'paste';
  if (actionsReview) actionsReview.hidden = step !== 'review';
  if (modeFs) modeFs.hidden = step === 'review';
  if (title) {
    title.textContent = step === 'review' ? 'Revisar importación' : 'Importar desde Drive';
  }
  if (hint) {
    hint.textContent =
      step === 'review'
        ? 'Confirma o edita cada sección antes de importar.'
        : 'Pega el documento copiado desde Google Docs. Revisarás cada sección antes de importar.';
  }
  if (step === 'review' && hooks && typeof hooks.updateDocSummary === 'function') {
    hooks.updateDocSummary();
  }
  syncConfirmLabel();
}

export function confirmDriveImportChoice(message) {
  const bd = getBackdrop();
  const wasOpen = !!(bd && bd.classList.contains('open'));
  if (bd && wasOpen) {
    bd.classList.remove('open');
    bd.setAttribute('aria-hidden', 'true');
  }
  let ok = false;
  try {
    ok = confirm(message);
  } finally {
    if (bd && wasOpen) {
      bd.classList.add('open');
      bd.setAttribute('aria-hidden', 'false');
    }
  }
  return ok;
}

export function focusPasteTextareaEnd() {
  const ta = getTextarea();
  if (!ta) return;
  ta.focus();
  try {
    ta.setSelectionRange(ta.value.length, ta.value.length);
  } catch {
    /* noop */
  }
}
