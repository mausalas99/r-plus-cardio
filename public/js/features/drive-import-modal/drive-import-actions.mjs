import { buildDriveImportReviewSteps } from '../../../../lib/drive-import/drive-import-review.mjs';
import {
  driveImportState,
  getDriveImportRuntime,
} from './drive-import-state.mjs';
import { getTextarea } from './drive-import-dom.mjs';
import { getParsed, getReviewBuildOpts, hasImportableContent } from './drive-import-parse.mjs';
import {
  focusPasteTextareaEnd,
  setModalStep,
} from './drive-import-modal-step.mjs';
import { refreshPreview, setReviewImportBusy, updateDocSummary } from './drive-import-preview.mjs';
import {
  renderReviewStep,
  syncCurrentReviewStepFromUi,
} from './drive-import-review-render.mjs';
import { finishReviewAndImport, runDriveImport } from './drive-import-run.mjs';
import { getApplyMode } from './drive-import-dom.mjs';

const modalStepHooks = { updateDocSummary };

function focusReviewEditorIfVisible() {
  const editor = document.getElementById('drive-import-review-editor');
  if (editor && !editor.hidden) editor.focus();
}

export function driveImportBackToPaste() {
  syncCurrentReviewStepFromUi();
  driveImportState.autoReviewPending = false;
  setModalStep('paste', modalStepHooks);
  focusPasteTextareaEnd();
}

export function driveImportReviewPrev() {
  if (driveImportState.reviewIndex <= 0) return;
  syncCurrentReviewStepFromUi();
  driveImportState.reviewIndex -= 1;
  renderReviewStep();
}

export async function driveImportReviewNext() {
  if (driveImportState.importBusy) return;
  try {
    syncCurrentReviewStepFromUi();
    if (driveImportState.reviewIndex >= driveImportState.reviewSteps.length - 1) {
      setReviewImportBusy(true);
      try {
        await finishReviewAndImport({
          syncCurrentReviewStepFromUi,
          reviewSteps: driveImportState.reviewSteps,
        });
      } catch (err) {
        console.error('[drive-import] import failed', err);
        const rt = getDriveImportRuntime();
        if (err && err.message === 'import-timeout') {
          rt.showToast('La importación tardó demasiado. Revisa si los datos se guardaron.', 'error');
        } else {
          rt.showToast('Error al importar desde Drive', 'error');
        }
      } finally {
        setReviewImportBusy(false);
      }
      return;
    }
    driveImportState.reviewIndex += 1;
    renderReviewStep();
  } catch (err) {
    console.error('[drive-import] review next failed', err);
    getDriveImportRuntime().showToast('No se pudo completar la revisión', 'error');
    setReviewImportBusy(false);
  }
}

export function startDriveImportReview() {
  const rt = getDriveImportRuntime();
  const ta = getTextarea();
  if (!ta || !String(ta.value || '').trim()) {
    rt.showToast('Pega el contenido del documento', 'error');
    return;
  }

  let parsed;
  try {
    parsed = getParsed();
  } catch {
    rt.showToast('No se pudo analizar el texto', 'error');
    return;
  }

  driveImportState.reviewSteps = buildDriveImportReviewSteps(parsed, getReviewBuildOpts(parsed));

  if (!driveImportState.reviewSteps.length) {
    rt.showToast('No hay secciones para revisar en este pegado', 'info');
    return;
  }

  driveImportState.reviewIndex = 0;
  driveImportState.autoReviewPending = false;
  setModalStep('review', modalStepHooks);
  renderReviewStep();
  focusReviewEditorIfVisible();
}

export async function confirmDriveImport() {
  if (driveImportState.importBusy) return;
  setReviewImportBusy(true);
  try {
    const rt = getDriveImportRuntime();
    const ta = getTextarea();
    if (!ta || !String(ta.value || '').trim()) {
      rt.showToast('Pega el contenido del documento', 'error');
      return;
    }
    let parsed;
    try {
      parsed = getParsed();
    } catch {
      rt.showToast('No se pudo analizar el texto', 'error');
      return;
    }
    await runDriveImport(parsed, { fromReview: false });
  } catch (err) {
    console.error('[drive-import] fast import failed', err);
    getDriveImportRuntime().showToast('Error al importar desde Drive', 'error');
  } finally {
    setReviewImportBusy(false);
  }
}

export function tryAutoStartReview() {
  if (driveImportState.modalStep !== 'paste' || !driveImportState.autoReviewPending) return;
  driveImportState.autoReviewPending = false;
  const ta = getTextarea();
  if (!ta || !String(ta.value || '').trim()) return;

  let parsed;
  try {
    parsed = getParsed();
  } catch {
    return;
  }

  const mode = getApplyMode();
  if (!hasImportableContent(parsed, mode)) return;

  const steps = buildDriveImportReviewSteps(parsed, getReviewBuildOpts(parsed));
  if (!steps.length) return;

  driveImportState.reviewSteps = steps;
  driveImportState.reviewIndex = 0;
  setModalStep('review', modalStepHooks);
  renderReviewStep();
  focusReviewEditorIfVisible();
}

export function onPasteInputChanged() {
  const ta = getTextarea();
  const hasText = !!(ta && String(ta.value || '').trim());
  if (!hasText) {
    driveImportState.autoReviewPending = false;
    refreshPreview();
    return;
  }
  driveImportState.autoReviewPending = true;
  refreshPreview();
  if (driveImportState.debounceId) clearTimeout(driveImportState.debounceId);
  driveImportState.debounceId = setTimeout(function () {
    driveImportState.debounceId = null;
    tryAutoStartReview();
  }, 320);
}

export function scheduleAutoReviewAfterModeChange() {
  if (driveImportState.modalStep !== 'paste' || !driveImportState.autoReviewPending) return;
  if (driveImportState.debounceId) clearTimeout(driveImportState.debounceId);
  driveImportState.debounceId = setTimeout(function () {
    driveImportState.debounceId = null;
    tryAutoStartReview();
  }, 320);
}
