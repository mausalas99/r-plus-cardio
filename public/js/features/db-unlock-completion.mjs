import { isDbMode } from '../db-storage-bridge.mjs';
import { clearMigratedLocalStorageKeys, collectClinicalLsSnapshot } from './db-unlock-migration.mjs';
import { dbUnlockState } from './db-unlock-state.mjs';

async function hydrateAppStateFromDb() {
  try {
    var appState = await import('../app-state.mjs');
    if (appState && typeof appState.bootHydrateFromDb === 'function') {
      await appState.bootHydrateFromDb();
    }
  } catch (err) {
    console.warn('[R+] DB hydrate after unlock:', err && err.message);
  }
}

async function initClinicalRuntimeAfterUnlock() {
  try {
    var settingsMod = await import('../clinical-settings.mjs');
    var runtime = await import('../clinical-access-runtime.mjs');
    var settings = settingsMod.readRpcSettings();
    var clientId = settingsMod.resolveClinicalClientId(settings);
    if (runtime && typeof runtime.initClinicalAccessRuntime === 'function') {
      await runtime.initClinicalAccessRuntime(settings, clientId);
    }
  } catch (err) {
    console.warn('[R+] Clinical runtime after unlock:', err && err.message);
  }
}

async function refreshOnboardingAfterUnlock() {
  try {
    var onboardingMain = await import('./clinical-onboarding-main.mjs');
    if (onboardingMain && typeof onboardingMain.refreshMainClinicalOnboardingIfNeeded === 'function') {
      await onboardingMain.refreshMainClinicalOnboardingIfNeeded();
    }
  } catch {
    /* onboarding refresh optional */
  }
}

/**
 * Rehydrate clinical session after a late DB unlock (overlay / recovery).
 * @param {{ refreshOnboarding?: boolean }} [opts]
 */
export async function applyClinicalDbUnlockCompletion(opts) {
  var refreshOnboarding = !opts || opts.refreshOnboarding !== false;
  if (!isDbMode() || typeof window === 'undefined') return;
  await hydrateAppStateFromDb();
  await initClinicalRuntimeAfterUnlock();
  if (refreshOnboarding) await refreshOnboardingAfterUnlock();
}

export function handleUnlockSuccess(res) {
  if (res && res.clearKeys && res.clearKeys.length) {
    clearMigratedLocalStorageKeys(res.clearKeys);
  }
  if (res && res.migrationWarning) {
    var warnMsg =
      'La base cifrada se creó, pero la migración de datos locales falló: ' + res.migrationWarning;
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(warnMsg, 'error');
    }
  }
  dbUnlockState.lastMigrationProbe = { needed: false, hasHostJson: false };
}

export async function tryAutoUnlockDb(electron) {
  if (!electron || typeof electron.dbAutoUnlock !== 'function') return null;
  var lsSnapshot = collectClinicalLsSnapshot();
  try {
    return await electron.dbAutoUnlock({ lsSnapshot: lsSnapshot });
  } catch {
    return null;
  }
}
