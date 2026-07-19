import { resetDriveImportSession, getDriveImportRuntime } from './drive-import-state.mjs';
import { driveImportState } from './drive-import-state.mjs';
import { getBackdrop, getTextarea } from './drive-import-dom.mjs';
import { setModalStep, syncConfirmLabel } from './drive-import-modal-step.mjs';
import { refreshPreview, updateDocSummary } from './drive-import-preview.mjs';
import { syncCurrentReviewStepFromUi } from './drive-import-review-render.mjs';

const modalStepHooks = { updateDocSummary };

export function openDriveImportModal() {
  const rt = getDriveImportRuntime();
  const bd = getBackdrop();
  if (!bd) {
    rt.showToast('Importación desde Drive no disponible', 'error');
    return;
  }
  const ta = getTextarea();
  if (ta) ta.value = '';
  resetDriveImportSession();
  setModalStep('paste', modalStepHooks);
  syncConfirmLabel();
  refreshPreview();
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  if (ta) ta.focus();
}

export function closeDriveImportModal() {
  const bd = getBackdrop();
  if (!bd) return;
  if (driveImportState.modalStep === 'review') syncCurrentReviewStepFromUi();
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  setModalStep('paste', modalStepHooks);
  resetDriveImportSession();
}
