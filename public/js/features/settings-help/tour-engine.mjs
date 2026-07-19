/** Guided tours barrel — re-exports intro, education, step actions, and lab hint. */
export {
  parseSemverCoreParts,
  compareSemverNumericArrays,
  shouldShowGuidedTourIntro,
  normalizeTourVersionLabel,
  resolveAppVersionForTour,
  tryShowGuidedTourIntroIfNeeded,
  initGuidedTourGate,
  showTourIntroModal,
  openTutorialIntroFromSettings,
  hideTourIntroModal,
  markGuidedTourVersionDone,
  guidedTourIntroSkip,
  guidedTourIntroChooseSala,
  guidedTourIntroChooseInterconsulta,
  syncLearnHubContinueVisibility,
} from './tour-intro.mjs';

export { tryShowPostRegistrationEducationIfNeeded } from './tour-intro-education.mjs';

export {
  closeLabBulkTourHintModal,
  openLabBulkTourHintModal,
  insertLabTourSecondPatientExample,
} from './tour-lab-hint.mjs';

export {
  resolveTourBranch,
  persistTourProgressDebounced,
  resetTourUiBeforeResume,
  showTourDock,
  hideTourDock,
  toggleTourDockCollapsed,
  onTourDockClick,
  seedDemoTrendHistory,
  applyTourDemoIngresoDates,
  seedDemoMonitoreoOnActivePatient,
  seedDemoListadoProblemas,
  ensureProfileExpandedForTour,
  ensureSettingsExpandedForTour,
  ensureConnectionExpandedForTour,
  clearTourSoapButtonHighlight,
  syncTourSoapButtonHighlight,
  getGuidedTourSteps,
  demoLabAlreadyProcessedForTour,
  seedDemoEventualidadesOnActivePatient,
  openTourEstadoActualRegistroDemo,
  isEstadoActualPostRegistroTourStep,
  prepareEstadoActualPanelForTour,
  syncTourActionNextButton,
  armTourActionPoll,
  clearTourActionPoll,
  guidedTourStepIndex,
  clearAllTourSpotlights,
  syncTourDockPlacement,
  tourApplySpotlightForStep,
  applyTourTargetForStep,
} from './tour-step-actions.mjs';
