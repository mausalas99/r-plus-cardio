/**
 * Lazy window-handler maps for settings-help and platform (BN-10).
 */

import { buildLazyWindowHandlers } from './lazy-feature-routes-core.mjs';

/** @type {Record<string, string>} */
const platformHandlerNames = {
  lockClinicalDatabaseNow: 'lockClinicalDatabaseNow',
  verifyForensicAuditChain: 'verifyForensicAuditChain',
  exportClinicalDbBackupJson: 'exportClinicalDbBackupJson',
  exportRecoverCensusRangeJson: 'exportRecoverCensusRangeJson',
  exportClinicalDbBackupDb: 'exportClinicalDbBackupDb',
  exportAuditLog: 'exportAuditLog',
  exportMedCatalogBundle: 'exportMedCatalogBundle',
  triggerImportMedCatalog: 'triggerImportMedCatalog',
  onMedCatalogFileChosen: 'onMedCatalogFileChosen',
  openUserDataFolderFromSettings: 'openUserDataFolderFromSettings',
  onIdleLockSelectChange: 'onIdleLockSelectChange',
  changeIdleLockPin: 'changeIdleLockPin',
  submitIdleLockPin: 'submitIdleLockPin',
  openWipeDataModal: 'openWipeDataModal',
  closeWipeDataModal: 'closeWipeDataModal',
  wipeCacheConfirmed: 'wipeCacheConfirmed',
  wipeAllConfirmed: 'wipeAllConfirmed',
  updateAutoBackupSettingsFromUi: 'updateAutoBackupSettingsFromUi',
  runAutoBackupNow: 'runAutoBackupNow',
  exportDataBackup: 'exportDataBackup',
  exportActivePatientBackup: 'exportActivePatientBackup',
  exportRangeBackupPrompt: 'exportRangeBackupPrompt',
  triggerImportRangeBackup: 'triggerImportRangeBackup',
  onRangeBackupFileChosen: 'onRangeBackupFileChosen',
  exportSyncBundlePrompt: 'exportSyncBundlePrompt',
  triggerImportSyncBundle: 'triggerImportSyncBundle',
  onSyncBundleFileChosen: 'onSyncBundleFileChosen',
  triggerImportActivePatientBackup: 'triggerImportActivePatientBackup',
  triggerImportBackup: 'triggerImportBackup',
  onPatientBackupFileChosen: 'onPatientBackupFileChosen',
  importBundledDemoPerez: 'importBundledDemoPerez',
  importBundledDemoIc: 'importBundledDemoIc',
  onBackupFileChosen: 'onBackupFileChosen',
  restorePreimportBackupPrompt: 'restorePreimportBackupPrompt',
  checkForAppUpdates: 'checkForAppUpdates',
  checkForRepairUpdate: 'checkForRepairUpdate',
  setUpdateChannel: 'setUpdateChannel',
  setUpdateTelemetryEnabled: 'setUpdateTelemetryEnabled',
  onHardwareAccelerationChange: 'onHardwareAccelerationChange',
  installUpdate: 'installUpdate',
  hideUpdateModal: 'hideUpdateModal',
};

/** @param {() => Promise<Record<string, unknown>>} ensureSettingsHelpLoaded */
export function buildSettingsHelpWindowHandlersLazy(ensureSettingsHelpLoaded) {
  return buildLazyWindowHandlers(
    {
      toggleSettingsSection: 'toggleSettingsSection',
      toggleSettingsDropdown: 'toggleSettingsDropdown',
      closeSettingsDropdown: 'closeSettingsDropdown',
      expandSettingsAccordionBackupSync: 'expandSettingsAccordionBackupSync',
      syncTeamSyncHeaderButton: 'syncTeamSyncHeaderButton',
      openQuickHelp: 'openQuickHelp',
      closeQuickHelp: 'closeQuickHelp',
      onHelpSearchInput: 'onHelpSearchInput',
      onHelpSearchKeydown: 'onHelpSearchKeydown',
      onHelpListKeydown: 'onHelpListKeydown',
      closeReleaseNotes: 'closeReleaseNotes',
      startMiniTour: 'startMiniTour',
      startHelpTourMain: 'startHelpTourMain',
      togglePresentationModeFromHelp: 'togglePresentationModeFromHelp',
      exportCensoPdfFromHelp: 'exportCensoPdfFromHelp',
      guidedTourIntroChooseSala: 'guidedTourIntroChooseSala',
      guidedTourIntroChooseInterconsulta: 'guidedTourIntroChooseInterconsulta',
      guidedTourIntroSkip: 'guidedTourIntroSkip',
      skipGuidedTour: 'skipGuidedTour',
      toggleTourDockCollapsed: 'toggleTourDockCollapsed',
      onTourDockClick: 'onTourDockClick',
      guidedTourClickNext: 'guidedTourClickNext',
      guidedTourClickPrev: 'guidedTourClickPrev',
      guidedTourPause: 'guidedTourPause',
      guidedTourFinish: 'finishGuidedTour',
      startTourModule: 'startTourModule',
      startHelpTourInterconsulta: 'startHelpTourInterconsulta',
      resetAndStartOnboarding: 'resetAndStartOnboarding',
      insertLabTourSecondPatientExample: 'insertLabTourSecondPatientExample',
      closeLabBulkTourHintModal: 'closeLabBulkTourHintModal',
      resumeGuidedTourFromProgress: 'resumeGuidedTourFromProgress',
      openLearnHub: 'openLearnHub',
      closeLearnHub: 'closeLearnHub',
      dismissGuardiaV7UpgradeCard: 'dismissGuardiaV7UpgradeCard',
    },
    ensureSettingsHelpLoaded
  );
}

/** @param {() => Promise<Record<string, unknown>>} ensurePlatformLoaded */
export function buildPlatformWindowHandlersLazy(ensurePlatformLoaded) {
  return buildLazyWindowHandlers(platformHandlerNames, ensurePlatformLoaded);
}

export const commandPaletteWindowHandlersLazy = buildLazyWindowHandlers(
  {
    openCommandPalette: 'openCommandPalette',
    closeCommandPalette: 'closeCommandPalette',
  },
  function () {
    return import('./features/command-palette.mjs');
  }
);

export const clinicalSyncModeSettingsHandlersLazy = buildLazyWindowHandlers(
  {
    enableClinicalLanFromSettings: 'enableClinicalLanFromSettings',
    syncClinicalSyncModeSettingsUi: 'syncClinicalSyncModeSettingsUi',
  },
  function () {
    return import('./features/clinical-sync-mode-settings.mjs');
  }
);
