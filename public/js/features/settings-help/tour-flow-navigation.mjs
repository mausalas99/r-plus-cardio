/** Tour prev/next/advance navigation. */
import { getChapterForStep } from '../../onboarding-curriculum.mjs';
import { saveTourProgress } from '../../onboarding-progress.mjs';
import { closeSOAPModal } from '../soap-estado.mjs';
import {
  getGuidedTourSteps,
  resolveTourBranch,
  applyTourTargetForStep,
  clearAllTourSpotlights,
  persistTourProgressDebounced,
  hideTourDock,
  closeLabBulkTourHintModal,
  syncTourActionNextButton,
  syncLearnHubContinueVisibility,
} from './tour-engine.mjs';
import {
  maybeMarkFundamentosChapterComplete,
  maybeMarkGuardiaV7ChapterComplete,
} from './tour-flow-chapter.mjs';
import { renderTourStep } from './tour-flow-render.mjs';
import { finishGuidedTour } from './tour-flow-lifecycle.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { tourState, publishTourGuardContext } from './tour-state.mjs';
import { tourBridge } from './tour-bridge.mjs';

const rt = getSettingsHelpRuntime();

function guidedTourClickPrev() {
  if (!tourState.guidedTourActive || tourState.miniTourActive) return;
  var steps = getGuidedTourSteps();
  var i = steps.indexOf(tourState.tourStepId);
  if (i <= 0) return;
  clearAllTourSpotlights();
  tourState.tourStepId = steps[i - 1];
  publishTourGuardContext();
  applyTourTargetForStep(tourState.tourStepId);
  renderTourStep();
  persistTourProgressDebounced();
}

function guidedTourPause() {
  if (!tourState.guidedTourActive) return;
  var branch = resolveTourBranch();
  var ch = getChapterForStep(tourState.tourStepId, branch);
  saveTourProgress({
    branch: branch,
    track: branch,
    stepId: tourState.tourStepId,
    chapterId: ch.id,
    moduleOnly: tourState.guidedTourModuleOnly,
    mode: tourState.guidedTourMode,
  });
  tourState.guidedTourActive = false;
  publishTourGuardContext();
  hideTourDock();
  rt.showToast('Tutorial pausado. Continúa desde Aprender R+ Cardio.', 'info');
  syncLearnHubContinueVisibility();
}

function guidedTourClickNext() {
  if (tourState.miniTourActive) { tourBridge.miniTourNext(); return; }
  if (!tourState.guidedTourActive) return;
  if (tourState.tourStepId === 'wrap' || tourState.tourStepId === 'quick_wrap') {
    finishGuidedTour();
    return;
  }
  var steps = getGuidedTourSteps();
  var i = steps.indexOf(tourState.tourStepId);
  if (i < 0) return;
  if (tourState.tourStepId === 'lab_bulk_separator') {
    closeLabBulkTourHintModal();
  }
  if (tourState.tourStepId === 'estado_actual' || tourState.tourStepId === 'estado_actual_registro') {
    closeSOAPModal();
  }
  maybeMarkFundamentosChapterComplete(tourState.tourStepId);
  maybeMarkGuardiaV7ChapterComplete(tourState.tourStepId);
  if (i + 1 >= steps.length) {
    finishGuidedTour();
    return;
  }
  clearAllTourSpotlights();
  tourState.tourStepId = steps[i + 1];
  publishTourGuardContext();
  applyTourTargetForStep(tourState.tourStepId);
  renderTourStep();
  persistTourProgressDebounced();
}

// Avance automático cuando el usuario ejecuta una acción real
// (Procesar, Copiar resultados, Generar Nota/Indicaciones, etc.).
function getGuidedTourContext() {
  return { active: tourState.guidedTourActive, stepId: tourState.tourStepId };
}

function guidedTourAdvanceAfter(actionStep) {
  if (!tourState.guidedTourActive || tourState.tourStepId !== actionStep) return;
  var steps = getGuidedTourSteps();
  var i = steps.indexOf(actionStep);
  if (i < 0 || i + 1 >= steps.length) return;
  clearAllTourSpotlights();
  tourState.tourStepId = steps[i + 1];
  publishTourGuardContext();
  applyTourTargetForStep(tourState.tourStepId);
  renderTourStep();
  publishTourGuardContext();
  persistTourProgressDebounced();
  if (actionStep === 'lab_parse') syncTourActionNextButton();
}
function guidedTourAdvanceAfterNotaGenerated() {
  guidedTourAdvanceAfter('ic_nota');
}
function guidedTourAdvanceAfterIndicaGenerated() {
  guidedTourAdvanceAfter('ic_indica');
}

export {
  guidedTourClickPrev,
  guidedTourPause,
  guidedTourClickNext,
  getGuidedTourContext,
  guidedTourAdvanceAfter,
  guidedTourAdvanceAfterNotaGenerated,
  guidedTourAdvanceAfterIndicaGenerated,
};
