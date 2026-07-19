/** Guided tours — barrel re-exports (implementation split under tour-flow-*.mjs). */
export {
  MOBILE_SCOPE_COPY,
  LIVESYNC_BTN_COPY,
  getGuardiaV7StepHtml,
  escapeTourHtml,
} from './tour-flow-guardia-copy.mjs';
export { renderTourStep } from './tour-flow-render.mjs';
export {
  clearGuidedTourModuleScope,
  maybeMarkFundamentosChapterComplete,
  maybeMarkGuardiaV7ChapterComplete,
} from './tour-flow-chapter.mjs';
export {
  guidedTourClickPrev,
  guidedTourPause,
  guidedTourClickNext,
  getGuidedTourContext,
  guidedTourAdvanceAfter,
  guidedTourAdvanceAfterNotaGenerated,
  guidedTourAdvanceAfterIndicaGenerated,
} from './tour-flow-navigation.mjs';
export {
  finishGuidedTour,
  skipGuidedTour,
  handlePostGuidedTourOnboardingResume,
} from './tour-flow-lifecycle.mjs';
export { destroyDemoAndClose } from './tour-flow-demo-cleanup.mjs';
export {
  startOnboarding,
  onboardingAdvanceAfterParse,
  onboardingAdvanceAfterSend,
  tourAfterBulkLabParse,
  tourOnBulkPreviewPatientSaved,
  scheduleTourDemoPatientRegistrationFromLab,
  resetAndStartOnboarding,
} from './tour-flow-onboarding.mjs';
export { resumeGuidedTourFromProgress } from './tour-flow-resume.mjs';
