#!/usr/bin/env node
/** Split tour-runtime.mjs into files ≤1000 lines with tour-bridge for mini↔flow. */
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public/js/features/settings-help');
const lines = fs.readFileSync(path.join(dir, 'tour-runtime.mjs'), 'utf8').split('\n');

const headerEnd = lines.findIndex((l) => l.startsWith('const rt ='));
const header = lines.slice(0, headerEnd).join('\n');
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const stateBody = slice(98, 119);
const demoBody = slice(121, 368);
const engineBody = slice(370, 931);
const flowBody = slice(932, 1511);
const miniBody = slice(1512, 1695);
const hooksBody = slice(1696, 1711);

const stateFile = `/** Shared guided-tour / mini-tour mutable state. */
import { syncGuidedTourContext } from '../../tour-guards.mjs';

${stateBody}
`;

const bridgeFile = `/** Breaks tour-engine ↔ tour-mini circular imports. */
export const tourBridge = {
  miniTourNext() {},
  endMiniTour() {},
};
`;

const subImports = `import {
  guidedTourActive,
  guidedTourBranch,
  guidedTourMode,
  tourStepId,
  persistTourProgressTimer,
  tourDemoLabSessionProcessed,
  miniTourActive,
  miniTourSteps,
  miniTourIdx,
  publishTourGuardContext,
  GUIDED_TOUR_LS_KEY,
} from './tour-state.mjs';
import { tourBridge } from './tour-bridge.mjs';

const rt = getSettingsHelpRuntime();
`;

function wrap(body, note, extraImports = '') {
  return `${header}
${extraImports}
${subImports}

/** ${note} */
${body}
`;
}

// engine: export helpers used by flow/mini/demo
const engineExports = `
export {
  parseSemverCoreParts,
  compareSemverNumericArrays,
  resolveAppVersionForTour,
  initGuidedTourGate,
  markGuidedTourVersionDone,
  guidedTourIntroSkip,
  guidedTourIntroChooseSala,
  guidedTourIntroChooseInterconsulta,
  persistTourProgressDebounced,
  resetTourUiBeforeResume,
  showTourDock,
  hideTourDock,
  toggleTourDockCollapsed,
  onTourDockClick,
  insertLabTourSecondPatientExample,
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
  guidedTourStepIndex,
  clearAllTourSpotlights,
  syncTourDockPlacement,
  tourApplySpotlightForStep,
  applyTourTargetForStep,
  openLabBulkTourHintModal,
};
`;

const engineImports = `import {
  ensureTourPrimaryDemoPatientActive,
  findTourDemoPerezPatient,
} from './tour-demo-seed.mjs';
`;

fs.writeFileSync(path.join(dir, 'tour-state.mjs'), stateFile);
fs.writeFileSync(path.join(dir, 'tour-bridge.mjs'), bridgeFile);
fs.writeFileSync(
  path.join(dir, 'tour-demo-seed.mjs'),
  wrap(demoBody, 'Tour demo patient seeding') +
    '\nexport {\n  purgeTourDemoPatientsFromState,\n  applyTourDemoPatientBundle,\n  ensureTourPrimaryDemoPatientActive,\n  findTourDemoPerezPatient,\n  scheduleTourDemoPatientRegistrationFromLab,\n};\n'
);

const flowImports = `import {
  getGuidedTourSteps,
  applyTourTargetForStep,
  clearAllTourSpotlights,
  syncTourDockPlacement,
  syncTourSoapButtonHighlight,
  syncTourActionNextButton,
  guidedTourStepIndex,
  persistTourProgressDebounced,
  showTourDock,
  hideTourDock,
  resetTourUiBeforeResume,
  hideTourIntroModal,
  markGuidedTourVersionDone,
  closeLabBulkTourHintModal,
  openLabBulkTourHintModal,
} from './tour-engine.mjs';
import {
  purgeTourDemoPatientsFromState,
  applyTourDemoPatientBundle,
  ensureTourPrimaryDemoPatientActive,
  scheduleTourDemoPatientRegistrationFromLab,
} from './tour-demo-seed.mjs';
`;

const flowPatched = flowBody
  .replace(
    'if (miniTourActive) { miniTourNext(); return; }',
    'if (miniTourActive) { tourBridge.miniTourNext(); return; }'
  )
  .replace(
    'if (miniTourActive) { endMiniTour(); return; }',
    'if (miniTourActive) { tourBridge.endMiniTour(); return; }'
  );

fs.writeFileSync(
  path.join(dir, 'tour-engine.mjs'),
  wrap(engineBody, 'Tour intro, dock, step targets', engineImports) + engineExports
);

fs.writeFileSync(
  path.join(dir, 'tour-flow.mjs'),
  wrap(flowPatched, 'Tour step render and onboarding flow', flowImports) +
    `
export {
  resumeGuidedTourFromProgress,
  startNeoCompanionTour,
  getGuidedTourContext,
  guidedTourAdvanceAfter,
  tourAfterBulkLabParse,
  tourOnBulkPreviewPatientSaved,
  guidedTourAdvanceAfterNotaGenerated,
  guidedTourAdvanceAfterIndicaGenerated,
  onboardingAdvanceAfterParse,
  onboardingAdvanceAfterSend,
  guidedTourClickNext,
  guidedTourClickPrev,
  guidedTourPause,
  skipGuidedTour,
  destroyDemoAndClose,
  resetAndStartOnboarding,
  startOnboarding,
};
`
);

const miniImports = `import {
  showTourDock,
  hideTourDock,
  syncTourDockPlacement,
  resetTourUiBeforeResume,
  hideTourIntroModal,
} from './tour-engine.mjs';
import { startOnboarding, resetAndStartOnboarding } from './tour-flow.mjs';
`;

fs.writeFileSync(
  path.join(dir, 'tour-mini.mjs'),
  wrap(miniBody, 'Mini tours and help entrypoints', miniImports) +
    `
export {
  startMiniTour,
  startHelpTourMain,
  startTourModule,
  startHelpTourInterconsulta,
  togglePresentationModeFromHelp,
  miniTourNext,
  endMiniTour,
};
` + hooksBody
);

const barrel = `/** Guided tours facade (BN-05). */
export { GUIDED_TOUR_LS_KEY } from './tour-state.mjs';
export {
  shouldShowGuidedTourIntro,
  normalizeTourVersionLabel,
  syncLearnHubContinueVisibility,
  closeLabBulkTourHintModal,
} from './tour-engine.mjs';
export { DEMO_PATIENT_ID, isTourDemoPatientId } from '../../tour-demo-patient.mjs';
export * from './tour-flow.mjs';
export * from './tour-mini.mjs';

import { tourBridge } from './tour-bridge.mjs';
import { miniTourNext, endMiniTour } from './tour-mini.mjs';
tourBridge.miniTourNext = miniTourNext;
tourBridge.endMiniTour = endMiniTour;

import './tour-demo-seed.mjs';
import './tour-engine.mjs';
import './tour-flow.mjs';
import './tour-mini.mjs';
`;

fs.writeFileSync(path.join(dir, 'tour-runtime.mjs'), barrel);
console.log('v2 split done');
