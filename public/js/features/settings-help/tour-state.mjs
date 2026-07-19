/** Shared guided-tour / mini-tour mutable state (mutate via tourState.*). */
import { syncGuidedTourContext } from '../../tour-guards.mjs';

export const GUIDED_TOUR_LS_KEY = 'rpc-guided-tour-done-for-version';
/** On the document root while guided or mini tour is running — unblocks tour targets under clinical onboarding. */
export const GUIDED_TOUR_RUNNING_CLASS = 'guided-tour-running';

let tourWasRunning = false;

export const tourState = {
  tendSectionExpandedLs: 'rpc-tend-sections-expanded',
  tendHiddenSeriesLs: 'rpc-tend-hidden-series',
  tendAbnormalOnlyLs: 'rpc-tend-abnormal-only',
  guidedTourActive: false,
  /** @type {'sala'|'interconsulta'|null} */
  guidedTourBranch: null,
  /** @type {'base'} */
  guidedTourMode: 'base',
  /** @type {string|null} */
  tourStepId: null,
  /** @type {string|null} single chapter from Learn Hub (module-only replay) */
  guidedTourChapterScope: null,
  /** when true, tour ends after the scoped chapter */
  guidedTourModuleOnly: false,
  persistTourProgressTimer: null,
  tourActionPollTimer: null,
  tourActionClickHandler: null,
  tourDemoLabSessionProcessed: false,
  miniTourActive: false,
  miniTourSteps: null,
  miniTourIdx: 0,
};

export function syncTourDocumentClass() {
  if (typeof document === 'undefined') return;
  const running = tourState.guidedTourActive || tourState.miniTourActive;
  document.documentElement.classList.toggle(GUIDED_TOUR_RUNNING_CLASS, running);
}

function resumeClinicalOnboardingAfterTourIfNeeded() {
  void import('./tour-flow.mjs').then((mod) => {
    if (mod && typeof mod.handlePostGuidedTourOnboardingResume === 'function') {
      void mod.handlePostGuidedTourOnboardingResume();
      return;
    }
    void import('../clinical-onboarding-main.mjs').then((main) => {
      if (main && typeof main.refreshMainClinicalOnboardingIfNeeded === 'function') {
        void main.refreshMainClinicalOnboardingIfNeeded();
      }
    });
  });
}

export function publishTourGuardContext() {
  const running = tourState.guidedTourActive || tourState.miniTourActive;
  syncGuidedTourContext({
    active: tourState.guidedTourActive,
    stepId: tourState.tourStepId,
  });
  syncTourDocumentClass();
  if (tourWasRunning && !running) resumeClinicalOnboardingAfterTourIfNeeded();
  tourWasRunning = running;
}

publishTourGuardContext();
