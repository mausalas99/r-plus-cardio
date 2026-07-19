import { getDriveImportRuntime } from './drive-import-state.mjs';
import { getBackdrop, getTextarea } from './drive-import-dom.mjs';
import { refreshPreview, setReviewImportBusy } from './drive-import-preview.mjs';
import { syncConfirmLabel } from './drive-import-modal-step.mjs';
import { closeDriveImportModal } from './drive-import-lifecycle.mjs';
import {
  confirmDriveImport,
  driveImportBackToPaste,
  driveImportReviewNext,
  driveImportReviewPrev,
  onPasteInputChanged,
  scheduleAutoReviewAfterModeChange,
  startDriveImportReview,
} from './drive-import-actions.mjs';

function wireDriveImportActionButtons() {
  const actions = [
    ['drive-import-confirm', startDriveImportReview],
    ['drive-import-apply-fast', confirmDriveImport],
    ['drive-import-review-next', driveImportReviewNext],
    ['drive-import-review-prev', driveImportReviewPrev],
    ['drive-import-back-paste', driveImportBackToPaste],
  ];
  actions.forEach(function (pair) {
    const btn = document.getElementById(pair[0]);
    const fn = pair[1];
    if (!btn || btn.dataset.driveImportActionWired) return;
    btn.dataset.driveImportActionWired = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      void Promise.resolve(fn()).catch(function (err) {
        console.error('[drive-import] action failed', pair[0], err);
        getDriveImportRuntime().showToast('No se pudo completar la acción de importación', 'error');
        setReviewImportBusy(false);
      });
    });
  });
}

export function wireDriveImportModal() {
  const ta = getTextarea();
  const bd = getBackdrop();
  wireDriveImportActionButtons();
  if (ta && !ta.dataset.driveImportWired) {
    ta.dataset.driveImportWired = '1';
    ta.addEventListener('input', onPasteInputChanged);
    ta.addEventListener('paste', function () {
      setTimeout(onPasteInputChanged, 0);
    });
  }
  document.querySelectorAll('input[name="drive-import-mode"]').forEach(function (el) {
    if (el.dataset.driveImportWired) return;
    el.dataset.driveImportWired = '1';
    el.addEventListener('change', function () {
      syncConfirmLabel();
      refreshPreview();
      scheduleAutoReviewAfterModeChange();
    });
  });
  if (bd && !bd.dataset.driveImportWired) {
    bd.dataset.driveImportWired = '1';
    bd.addEventListener('click', function (e) {
      if (e.target === bd) closeDriveImportModal();
    });
  }
}
