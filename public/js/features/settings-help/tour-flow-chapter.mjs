/** Fundamentos / guardia-v7 chapter completion during tours. */
import { getChapterProgressLabel, getChapterForStep } from '../../onboarding-curriculum.mjs';
import { syncLearnHubContinueVisibility } from './tour-engine.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { tourState } from './tour-state.mjs';

const rt = getSettingsHelpRuntime();

function clearGuidedTourModuleScope() {
  tourState.guidedTourChapterScope = null;
  tourState.guidedTourModuleOnly = false;
}

function maybeMarkFundamentosChapterComplete(stepId) {
  const branch = tourState.guidedTourBranch;
  if (branch !== 'sala' && branch !== 'interconsulta') return;
  const tourBranch = branch === 'interconsulta' ? 'interconsulta' : 'sala';
  const chapter = getChapterForStep(stepId, tourBranch);
  if (!chapter?.id || chapter.id === 'unknown') return;
  const stepsInChapter = getChapterProgressLabel(stepId, tourBranch);
  if (stepsInChapter.stepInChapter !== stepsInChapter.chapterSteps) return;
  void import('../../fundamentos-progress.mjs').then((m) => {
    if (!m.isFundamentosChapterId(chapter.id)) return;
    const result = m.markFundamentosChapterComplete(chapter.id);
    if (!result.wasNew) return;
    if (chapter.id === 'ch-patient-lab') {
      rt.showToast('Listo: DEMO PÉREZ ya tiene laboratorio en R+.', 'success');
    } else {
      rt.showToast(`Módulo completado: ${chapter.title}`, 'success');
    }
  });
}

function maybeMarkGuardiaV7ChapterComplete(stepId) {
  if (tourState.guidedTourBranch !== 'guardia-v7') return;
  const branch = 'guardia-v7';
  const chapter = getChapterForStep(stepId, branch);
  if (!chapter || !chapter.id || chapter.id === 'unknown') return;
  const stepsInChapter = getChapterProgressLabel(stepId, branch);
  if (stepsInChapter.stepInChapter !== stepsInChapter.chapterSteps) return;
  void import('../../guardia-v7-progress.mjs').then((m) => {
    const result = m.markGuardiaV7ChapterComplete(chapter.id);
    if (!result.wasNew) return;
    rt.launchConfetti();
    rt.showToast(`Módulo completado: ${chapter.title}`, 'success');
    syncLearnHubContinueVisibility();
    if (m.isGuardiaV7TrackComplete()) {
      window.setTimeout(() => {
        rt.showToast('¡Guía de guardia 7.x completada!', 'success');
      }, 500);
    }
  });
}

export { clearGuidedTourModuleScope, maybeMarkFundamentosChapterComplete, maybeMarkGuardiaV7ChapterComplete };
