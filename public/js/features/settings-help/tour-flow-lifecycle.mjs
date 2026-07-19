/** Tour finish, skip, and post-completion hooks. */
import { clearTourProgress } from '../../onboarding-progress.mjs';
import {
  isClinicalSyncModeChosen,
  readRpcSettings,
  setClinicalSyncModeLocalOnly,
} from '../../clinical-settings.mjs';
import { hideMainClinicalOnboarding } from '../clinical-onboarding-main.mjs';
import {
  clearTourSoapButtonHighlight,
  markGuidedTourVersionDone,
  hideTourDock,
  syncLearnHubContinueVisibility,
} from './tour-engine.mjs';
import {
  clearGuidedTourModuleScope,
  maybeMarkFundamentosChapterComplete,
  maybeMarkGuardiaV7ChapterComplete,
} from './tour-flow-chapter.mjs';
import { destroyDemoAndClose } from './tour-flow-demo-cleanup.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { tourState, publishTourGuardContext } from './tour-state.mjs';
import { tourBridge } from './tour-bridge.mjs';

const rt = getSettingsHelpRuntime();

/** Set when guided tour ends; consumed by handlePostGuidedTourOnboardingResume. */
let postTourResumeBranch = null;

/** Sala tour implies LAN; dismiss sync-mode overlay before guided-tour-running is cleared. */
function prepareSalaGuidedTourExitSync() {
  if (!isClinicalSyncModeChosen(readRpcSettings())) {
    setClinicalSyncModeLocalOnly(false);
  }
  hideMainClinicalOnboarding();
}

async function handlePostGuidedTourOnboardingResume() {
  const branch = postTourResumeBranch;
  postTourResumeBranch = null;

  if (branch === 'sala') {
    prepareSalaGuidedTourExitSync();
    await promptMiRotacionAfterSalaTourIfNeeded('sala');
    return;
  }

  const main = await import('../clinical-onboarding-main.mjs');
  if (main && typeof main.refreshMainClinicalOnboardingIfNeeded === 'function') {
    await main.refreshMainClinicalOnboardingIfNeeded();
  }
}

async function promptMiRotacionAfterSalaTourIfNeeded(branch) {
  if (branch !== 'sala') return;
  const { isClinicalLocalOnlyMode, readRpcSettings } = await import('../../clinical-settings.mjs');
  if (isClinicalLocalOnlyMode(readRpcSettings())) return;
  const { needsTeamOnboarding } = await import('../clinical-onboarding.mjs');
  if (!needsTeamOnboarding()) return;

  rt.showToast(
    'Únete a un equipo en Mi rotación. El nombre del equipo es el nombre completo de tu R2 (ej. Dr. Gutiérrez).',
    'info'
  );

  const { ensureClinicalPanelSession } = await import('../clinical-panel-host.mjs');
  const sessionOk = await ensureClinicalPanelSession();
  if (!sessionOk) {
    rt.showToast('Cuando la sesión esté lista, abre Mi rotación en la barra superior.', 'warning');
    return;
  }

  try {
    const { wireClinicalTeamsModalChrome } = await import(
      '../clinical-teams/teams-roster-modal-chrome.mjs'
    );
    wireClinicalTeamsModalChrome();
    const { openClinicalTeamsPanel } = await import('../clinical-teams/teams-roster.mjs');
    await openClinicalTeamsPanel({ skipProfileGate: true });
  } catch (err) {
    console.warn('[R+] Mi rotación tras tutorial Sala:', err && err.message);
    const { openMiRotacion } = await import('../clinical-rotation-entry.mjs');
    await openMiRotacion();
  }
}

function completeGuidedTourWithCelebration() {
  const completedBranch = tourState.guidedTourBranch;
  if (tourState.tourStepId) {
    if (completedBranch === 'guardia-v7') maybeMarkGuardiaV7ChapterComplete(tourState.tourStepId);
    if (completedBranch === 'sala' || completedBranch === 'interconsulta') {
      maybeMarkFundamentosChapterComplete(tourState.tourStepId);
    }
  }
  clearTourSoapButtonHighlight();
  clearTourProgress();
  markGuidedTourVersionDone();
  tourState.guidedTourActive = false;
  tourState.tourStepId = null;
  postTourResumeBranch = completedBranch;
  tourState.guidedTourBranch = null;
  tourState.guidedTourMode = 'base';
  clearGuidedTourModuleScope();
  if (completedBranch === 'sala') prepareSalaGuidedTourExitSync();
  publishTourGuardContext();
  hideTourDock();
  if (completedBranch !== 'guardia-v7') {
    rt.launchConfetti();
    rt.showToast('Tutorial completado', 'success');
  }
  if (completedBranch !== 'guardia-v7') safeDestroyDemoAndClose();
  syncLearnHubContinueVisibility();
}

function safeDestroyDemoAndClose() {
  try {
    destroyDemoAndClose();
  } catch (err) {
    console.error('[R+] destroyDemoAndClose:', err && err.message);
    tourState.guidedTourActive = false;
    tourState.tourStepId = null;
    tourState.guidedTourBranch = null;
    publishTourGuardContext();
    hideTourDock();
  }
}

function finishGuidedTour() {
  if (tourState.miniTourActive) {
    tourBridge.endMiniTour();
    return;
  }
  if (!tourState.guidedTourActive) return;
  try {
    completeGuidedTourWithCelebration();
  } catch (err) {
    console.error('[R+] finishGuidedTour:', err && err.message);
    clearTourProgress();
    markGuidedTourVersionDone();
    tourState.guidedTourActive = false;
    tourState.tourStepId = null;
    tourState.guidedTourBranch = null;
    tourState.guidedTourMode = 'base';
    clearGuidedTourModuleScope();
    publishTourGuardContext();
    hideTourDock();
    safeDestroyDemoAndClose();
    rt.showToast('Tutorial finalizado', 'success');
    syncLearnHubContinueVisibility();
  }
}

function skipGuidedTour() {
  if (tourState.miniTourActive) { tourBridge.endMiniTour(); return; }
  clearTourSoapButtonHighlight();
  clearTourProgress();
  markGuidedTourVersionDone();
  tourState.guidedTourActive = false;
  tourState.tourStepId = null;
  tourState.guidedTourBranch = null;
  tourState.guidedTourMode = 'base';
  clearGuidedTourModuleScope();
  publishTourGuardContext();
  hideTourDock();
  safeDestroyDemoAndClose();
  syncLearnHubContinueVisibility();
}

export { finishGuidedTour, skipGuidedTour, handlePostGuidedTourOnboardingResume };
