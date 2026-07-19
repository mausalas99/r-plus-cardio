#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public/js/features/platform');

function read(name) {
  return fs.readFileSync(path.join(dir, `_extract_${name}.txt`), 'utf8');
}

function write(name, content) {
  fs.writeFileSync(path.join(dir, name), content);
}

write(
  'runtime.mjs',
  `/** Platform runtime context injected from app-runtimes. */
let rt = {
  getActiveId() {
    return null;
  },
  setActiveId() {},
  getSettings() {
    return /** @type {any} */ ({});
  },
  showToast() {},
  syncTeamSyncHeaderButton() {},
  pushUndoSnapshot() {},
};

export function registerPlatformRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(rt, ctx);
}

export function getPlatformRuntime() {
  return rt;
}
`
);

write(
  'shared.mjs',
  `/** Shared keys and download helpers for platform submodules. */
export const AUDIT_LOG_KEY = 'rpc-audit-log';
export const AUTO_BACKUP_SETTINGS_KEY = 'rpc-auto-backup-settings';
export const AUTO_BACKUP_INDEX_KEY = 'rpc-auto-backup-index';
export const AUTO_BACKUP_MAX = 14;
export const PREIMPORT_BACKUP_KEY = 'rpc-preimport-backup';
export const IDLE_LOCK_LS_KEY = 'rpc-idle-lock';
export const IDLE_LOCK_HASH_LS_KEY = 'rpc-idle-lock-hash';
export const IDLE_LOCK_DEBOUNCE_MS = 500;
export const IDLE_LOCK_VALID_MINUTES = [0, 5, 10, 30];

export function formatDateSlug(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function downloadBlob(blob, fileName) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function downloadJsonPayload(payload, fileName) {
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, fileName);
}

export function downloadTextPayload(content, fileName, mimeType) {
  var blob = new Blob([content], { type: (mimeType || 'text/plain') + ';charset=utf-8' });
  downloadBlob(blob, fileName);
}
`
);

const offlineBody = read('offline');
write(
  'offline.mjs',
  `/** Pending jobs, RPC offline/health, idle lock, privacy wipe. */
import { closeSettingsDropdown } from '../settings-help.mjs';
import { AUDIT_LOG_KEY, IDLE_LOCK_DEBOUNCE_MS, IDLE_LOCK_HASH_LS_KEY, IDLE_LOCK_LS_KEY, IDLE_LOCK_VALID_MINUTES } from './shared.mjs';
import { addAuditEntry } from './audit.mjs';
import { getPlatformRuntime } from './runtime.mjs';

const rt = getPlatformRuntime();

var idleLockTimerId = null;
var idleLockDebounceId = null;
var idleLockIsActive = false;
var idleLockEnabledMinutes = 0;

${offlineBody}
export {
  incrementPendingJobs,
  decrementPendingJobs,
  syncOfflineButtonStates,
  isRpcOffline,
  setRpcOffline,
  checkRpcServerHealth,
  initRpcServerHealthWatch,
  syncIdleLockSelectUi,
  onIdleLockSelectChange,
  changeIdleLockPin,
  submitIdleLockPin,
  initIdleLockFeature,
  openWipeDataModal,
  closeWipeDataModal,
  wipeCacheConfirmed,
  wipeAllConfirmed,
  openUserDataFolderFromSettings,
  safeExportSlug,
};
`
);

const auditBody = read('audit');
write(
  'audit.mjs',
  `/** Forensic audit, DB backup export, medication catalog merge/import. */
import { storage } from '../../storage.js';
import { isDbMode } from '../../db-storage-bridge.mjs';
import { applyMedCatalogOverlay } from '../../med-receta-core.mjs';
import { applySomePharmCatalogOverlay } from '../../med-pharm-some-catalog.mjs';
import { AUDIT_LOG_KEY } from './shared.mjs';
import { formatDateSlug, downloadJsonPayload } from './shared.mjs';
import { getPlatformRuntime } from './runtime.mjs';

const rt = getPlatformRuntime();

${auditBody}
export {
  getAuditLog,
  refreshDbAuditCache,
  addAuditEntry,
  exportAuditLog,
  lockClinicalDatabaseNow,
  verifyForensicAuditChain,
  exportClinicalDbBackupJson,
  exportClinicalDbBackupDb,
  mergeMedCatalogStored,
  exportMedCatalogBundle,
  triggerImportMedCatalog,
  onMedCatalogFileChosen,
};
`
);

let importBody = read('import-backup');
importBody = importBody.replace(/^var PREIMPORT_BACKUP_KEY[^\n]+\n\n/, '');
importBody = importBody.replace(
  /function formatDateSlug\(d\) \{[\s\S]*?function defaultAutoBackupSettings/,
  'function defaultAutoBackupSettings'
);

write(
  'import-backup.mjs',
  `/** Auto-backup scheduler, JSON export/import, sync bundle encrypt/decrypt. */
import { storage } from '../../storage.js';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  listadoProblemas,
  replaceAppStateFromBackupData,
  setMedPharmProfileByPatient,
  saveState,
  setPatients,
  setNotes,
  setIndicaciones,
  setLabHistory,
  setMedRecetaByPatient,
} from '../../app-state.mjs';
import { mergePatientMonitoreoFromImported } from '../estado-actual-data.mjs';
import { mergeCensoPatientFields } from '../../patient-diagnosticos.mjs';
import {
  describePatientImportRejection,
  parsePatientImportJsonText,
} from '../../patient-export-format.mjs';
import {
  renderPatientList,
  selectPatient,
  findPatientByRegistro,
  generatePatientId,
  ensureUniquePatientName,
  buildPatientEntry,
} from '../patients.mjs';
import { GUIDED_TOUR_LS_KEY, isTourDemoPatientId } from '../settings-help.mjs';
import {
  AUTO_BACKUP_INDEX_KEY,
  AUTO_BACKUP_MAX,
  AUTO_BACKUP_SETTINGS_KEY,
  PREIMPORT_BACKUP_KEY,
  formatDateSlug,
  downloadJsonPayload,
  downloadBlob,
  downloadTextPayload,
} from './shared.mjs';
import { addAuditEntry } from './audit.mjs';
import { safeExportSlug } from './offline.mjs';
import { getPlatformRuntime } from './runtime.mjs';
import { initUpdateChannelAndGate } from './updater.mjs';

const rt = getPlatformRuntime();
var autoBackupSchedulerId = null;

${importBody}
export {
  syncPreimportBackupUi,
  restorePreimportBackupPrompt,
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
  initGoalGFeatures,
  buildFullBackupPayload,
  parseDateDMY,
  parseDateRangePrompt,
  patientInDateRange,
  askConflictAction,
  applyImportEntry,
  importEntriesWithConflicts,
  exportDataBackup,
  exportActivePatientBackup,
  exportRangeBackupPrompt,
  triggerImportRangeBackup,
  onRangeBackupFileChosen,
  triggerImportBackup,
  triggerImportActivePatientBackup,
  onPatientBackupFileChosen,
  importBundledDemoPerez,
  onBackupFileChosen,
  bytesToBase64,
  base64ToBytes,
  encryptSyncPayload,
  decryptSyncPayload,
  collectSyncEntries,
  exportSyncBundlePrompt,
  triggerImportSyncBundle,
  onSyncBundleFileChosen,
};
`
);

const updaterEarly = read('updater-early.mjs').replace(/^function /gm, 'function ');
const updaterBody = read('updater');
write(
  'updater.mjs',
  `/** Auto-updater modal UI, channels, telemetry, min-version gate. */
import { formatProgressLine } from '../../update-helpers.mjs';
import {
  initStableDowngradeSettings,
  openSettingsDowngradeSection,
} from '../../stable-downgrade-ui.mjs';
import { fetchMinVersionPayload } from '../../min-version-fetch.mjs';
import { setAsyncButtonLoading } from '../../ui-motion.mjs';
import { formatCuratedReleaseNotesPlain } from '../settings-help.mjs';
import { getPlatformRuntime } from './runtime.mjs';

const rt = getPlatformRuntime();

${updaterEarly}

${updaterBody}
export {
  getUpdateChannel,
  setUpdateChannel,
  syncUpdateChannelUI,
  syncUpdateTelemetryUI,
  syncHardwareAccelerationUI,
  onHardwareAccelerationChange,
  initUpdateChannelAndGate,
  getUpdateTelemetryEnabled,
  setUpdateTelemetryEnabled,
  installUpdate,
  checkForAppUpdates,
  checkForRepairUpdate,
  compareSemver,
  checkMinVersionGate,
  migrateUpdateChannelToStableDefault,
  hideUpdateModal,
};
`
);

console.log('Assembled platform modules');
