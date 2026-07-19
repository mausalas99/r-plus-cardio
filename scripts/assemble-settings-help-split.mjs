#!/usr/bin/env node
/** One-off assembler for BN-05 settings-help split. */
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'public/js/features/settings-help');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const TOUR_HEADER = `/** Guided tours, mini tours, demo patient hooks. */
import {
  getTourSteps,
  getTourTarget,
  stepRequiresUserAction,
} from '../../tour-targets.mjs';
import {
  getChapterProgressLabel,
  getChapterForStep,
  getFirstStepIdForChapter,
} from '../../onboarding-curriculum.mjs';
import {
  loadTourProgress,
  saveTourProgress,
  clearTourProgress,
} from '../../onboarding-progress.mjs';
import { syncGuidedTourContext } from '../../tour-guards.mjs';
import {
  isPresentationModeActive,
  startPresentationMode,
  stopPresentationMode,
  registerPresentationRuntime,
} from '../../presentation-mode.mjs';
import { applyAppModeSwitchEffects } from '../profile.mjs';
import { LAB_BULK_PATIENT_SEPARATOR } from '../../lab-bulk-paste.mjs';
import { buildTourDemoListadoProblemas } from '../../tour-demo-listado-problemas.mjs';
import {
  buildTourMonitoreoHistorial,
  getTourRegistroFormSample,
} from '../../tour-demo-monitoreo.mjs';
import { buildTourDemoDates, buildTourDemoLabPasteBoth } from '../../tour-demo-dates.mjs';
import { seedTourDemoTodos, clearTourDemoTodos } from '../../tour-demo-todos.mjs';
import { buildTourDemoEventualidades } from '../../tour-demo-eventualidades.mjs';
import { buildBulkLabPreview, extractLabPatientFromBulkBlock } from '../../lab-bulk-paste.mjs';
import {
  DEMO_PATIENT_ID,
  DEMO_PATIENT_ID_2,
  DEMO_REGISTRO,
  DEMO_REGISTRO_2,
  findTourDemoPatientByRegistro,
  isTourDemoPatientId,
  registerTourDemoPatientHooks,
  resolveTourDemoPatientId,
  tourDemoLabCompleteForTour,
  tourDemoPatientsBothInCensus,
} from '../../tour-demo-patient.mjs';
import {
  renderEstadoActualPanel,
  applyEstadoActualParsedToForm,
  toDatetimeLocalValue,
  invalidateEaPanelCache,
} from '../estado-actual-panel.mjs';
import {
  closeEstadoActualRegistroModal,
  openEstadoActualRegistroModal,
} from '../estado-actual-registro-modal.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { getUiDensity, setUiDensity } from '../chrome.mjs';
import {
  openConnectionDropdown,
  closeConnectionDropdown,
} from '../lan-sync.mjs';
import { renderPatientList, selectPatient } from '../patients.mjs';
import { renderNoteForm, renderIndicaForm } from '../notes-indicaciones.mjs';
import { renderPaseBoard } from '../pase-board.mjs';
import { setRoundOverviewMode } from '../patients.mjs';
import { renderRoundOverviewPanels } from '../patients.mjs';
import { renderLabHistoryPanel } from '../lab-panel.mjs';
import { limpiarReporte } from '../lab-panel.mjs';
import { closeLabSomeTablesModal } from '../lab-some-tables-modal.mjs';
import { closeTendGroupModal } from '../tendencias.mjs';
import { closeSOAPModal } from '../soap-estado.mjs';
import { procesarLabs } from '../../labs.js';
import { extractParsedValues } from '../diagrams-parse.mjs';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  listadoProblemas,
  medRecetaByPatient,
  medNotaSelectionByPatient,
  saveState,
  setPatients,
} from '../../app-state.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import {
  closeSettingsDropdown,
  toggleSettingsDropdown,
  ensureSettingsDropdownOpen,
  expandSettingsAccordionBackupSync,
} from './settings-dropdown.mjs';

const rt = getSettingsHelpRuntime();

`;

const TOUR_FOOTER = `
export {
  DEMO_PATIENT_ID,
  isTourDemoPatientId,
  resolveAppVersionForTour,
  markGuidedTourVersionDone,
  initGuidedTourGate,
  guidedTourAdvanceAfterNotaGenerated,
  guidedTourAdvanceAfterIndicaGenerated,
  onboardingAdvanceAfterParse,
  onboardingAdvanceAfterSend,
  closeLabBulkTourHintModal,
  toggleSettingsDropdown,
  startMiniTour,
  startHelpTourMain,
  startTourModule,
  startHelpTourInterconsulta,
  togglePresentationModeFromHelp,
  guidedTourIntroChooseSala,
  guidedTourIntroChooseInterconsulta,
  guidedTourIntroSkip,
  skipGuidedTour,
  toggleTourDockCollapsed,
  onTourDockClick,
  guidedTourClickNext,
  guidedTourClickPrev,
  guidedTourPause,
  resetAndStartOnboarding,
  insertLabTourSecondPatientExample,
  toggleSettingsSection,
};
`;

let tourBody = read('tour-key.txt') + '\n' + read('tour-part1.txt') + read('tour-part2.txt') + read('tour-part3.txt');

tourBody = tourBody.replace(
  /try \{\s*closeReleaseNotes\(\);\s*\} catch \(_e\) \{\}/,
  'try { settingsHelpBridge.closeReleaseNotes(); } catch (_e) {}'
);
tourBody = tourBody.replace(/\bcloseQuickHelp\(\)/g, 'settingsHelpBridge.closeQuickHelp()');
tourBody = tourBody.replace(
  /export \{\s*DEMO_PATIENT_ID,[\s\S]*?toggleSettingsDropdown,\s*\};\s*/,
  ''
);
tourBody = tourBody.replace(
  /export function maybeShowReleaseNotesFor/g,
  'function maybeShowReleaseNotesFor'
);

fs.writeFileSync(
  path.join(root, 'tour-runtime.mjs'),
  TOUR_HEADER + tourBody + TOUR_FOOTER
);

const HELP_HEADER = `/** Help center articles, quick help, release notes. */
import { settingsHelpBridge } from './bridges.mjs';
import { closeSettingsDropdown } from './settings-dropdown.mjs';

`;

const orig = fs.readFileSync(path.join(process.cwd(), 'public/js/features/settings-help.mjs'), 'utf8');
const escFn = orig.split('\n').slice(90, 97).join('\n').replace(/^function esc/, 'export function esc');

let helpBody = escFn + '\n\n' + read('help-body.txt');

helpBody = helpBody.replace(
  /function maybeShowReleaseNotesFor/,
  'export function maybeShowReleaseNotesFor'
);
helpBody = helpBody.replace(/\bsyncLearnHubContinueVisibility\(\)/g, 'settingsHelpBridge.syncLearnHubContinueVisibility()');

fs.writeFileSync(path.join(root, 'help-content.mjs'), HELP_HEADER + helpBody);

console.log('assembled tour-runtime.mjs and help-content.mjs');
