import { CLINICAL_LS_KEYS } from '../db-storage-bridge.mjs';

export function needsPassphraseConfirm(status, probe) {
  if (!status || typeof status !== 'object') return true;
  if (status.dbFileExists && status.hasKdfSalt) return false;
  if (status.migrationPending && !status.dbFileExists) return true;
  if (probe && probe.needed && !status.dbFileExists) return true;
  if (status.dbFileExists === false) return true;
  return false;
}

export function collectClinicalLsSnapshot() {
  var snapshot = {};
  if (typeof localStorage === 'undefined') return snapshot;
  for (var i = 0; i < CLINICAL_LS_KEYS.length; i++) {
    var key = CLINICAL_LS_KEYS[i];
    if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
    var raw = localStorage.getItem(key);
    if (raw != null) snapshot[key] = raw;
  }
  return snapshot;
}

export function clearMigratedLocalStorageKeys(keys) {
  if (!keys || !keys.length || typeof localStorage === 'undefined') return;
  for (var i = 0; i < keys.length; i++) {
    try {
      localStorage.removeItem(keys[i]);
    } catch (_e) { void _e; }
  }
}

export async function runMigrationProbe(electron) {
  if (!electron || typeof electron.dbMigrationProbe !== 'function') {
    return { needed: false, hasHostJson: false };
  }
  var lsSnapshot = collectClinicalLsSnapshot();
  try {
    var res = await electron.dbMigrationProbe({ lsSnapshot: lsSnapshot });
    if (res && res.ok !== false) {
      return { needed: !!res.needed, hasHostJson: !!res.hasHostJson };
    }
  } catch (_e) { void _e; }
  return { needed: false, hasHostJson: false };
}

export function migrationUiPending(status, probe) {
  return !!(status && status.migrationPending) || !!(probe && probe.needed);
}
