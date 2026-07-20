/** Auto-backup scheduler, JSON export/import, sync bundle encrypt/decrypt — barrel. */
export {
  defaultAutoBackupSettings,
  getAutoBackupSettings,
  saveAutoBackupSettings,
  getAutoBackupIndex,
  saveAutoBackupIndex,
  syncAutoBackupUi,
  updateAutoBackupSettingsFromUi,
  shouldRunScheduledBackup,
  maybeRunScheduledAutoBackup,
  restartAutoBackupScheduler,
  runAutoBackupNow,
} from './import-backup/auto-backup.mjs';

export { syncPreimportBackupUi, restorePreimportBackupPrompt } from './import-backup/preimport.mjs';

export { buildFullBackupPayload } from './import-backup/backup-payload.mjs';

export { parseDateDMY, parseDateRangePrompt, patientInDateRange } from './import-backup/date-utils.mjs';

export {
  askConflictAction,
  applyImportEntry,
  importEntriesWithConflicts,
} from './import-backup/import-core.mjs';

export {
  exportDataBackup,
  exportActivePatientBackup,
  exportRangeBackupPrompt,
} from './import-backup/export-backup.mjs';

export { openExportPatientsModal } from './import-backup/export-patients-modal.mjs';

export {
  triggerImportRangeBackup,
  onRangeBackupFileChosen,
  triggerImportBackup,
  triggerImportActivePatientBackup,
  onPatientBackupFileChosen,
  importBundledDemoPerez,
  importBundledDemoIc,
  onBackupFileChosen,
} from './import-backup/import-handlers.mjs';

export {
  bytesToBase64,
  base64ToBytes,
  encryptSyncPayload,
  decryptSyncPayload,
  collectSyncEntries,
  exportSyncBundlePrompt,
  triggerImportSyncBundle,
  onSyncBundleFileChosen,
} from './import-backup/sync-crypto.mjs';

export { initGoalGFeatures } from './import-backup/init.mjs';
