import { isDbMode } from '../db-storage-bridge.mjs';
import { unlockErrorMessage } from './db-unlock-errors.mjs';
import { handleUnlockSuccess, tryAutoUnlockDb } from './db-unlock-completion.mjs';
import { delayMs, getClinicalBootDelays, isSqlcipherNativeReady } from './db-unlock-native.mjs';
import { presentDbUnlockGate } from './db-unlock-overlay.mjs';
import { electronApi } from './db-unlock-state.mjs';

function isUnlockedDbStatus(status) {
  return !status || status.state === 'unlocked';
}

async function readDbStatus(electron) {
  try {
    return await electron.dbStatus();
  } catch {
    return null;
  }
}

function isAutoUnlockSuccess(autoRes) {
  return !!(autoRes && autoRes.ok !== false && autoRes.state === 'unlocked');
}

async function tryAutoUnlockAttempt(electron) {
  var autoRes = await tryAutoUnlockDb(electron);
  if (!isAutoUnlockSuccess(autoRes)) return { unlocked: false, autoRes: autoRes };
  handleUnlockSuccess(autoRes);
  return { unlocked: true, status: autoRes };
}

async function pollBootUnlockAttempt(electron) {
  var status = await readDbStatus(electron);
  if (!status) return null;
  if (!isSqlcipherNativeReady(status)) {
    return { unlocked: false, reason: 'native_blocked', status: status };
  }
  if (isUnlockedDbStatus(status)) {
    return { unlocked: true, status: status };
  }
  var autoAttempt = await tryAutoUnlockAttempt(electron);
  if (autoAttempt.unlocked) return { unlocked: true, status: autoAttempt.status };
  return null;
}

function showToastIfAvailable(msg, kind) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, kind);
  }
}

async function handleNativeBlockedUnlock(status) {
  var nativeMsg = unlockErrorMessage(
    { code: 'DB_NATIVE_ABI_MISMATCH' },
    { nativeError: status.nativeError }
  );
  showToastIfAvailable(nativeMsg, 'error');
  return { unlocked: false, status: status };
}

async function tryManualUnlockGate(status, autoRes) {
  if (!status.dbFileExists || !status.hasKdfSalt) return null;
  var overlayResult = await presentDbUnlockGate(status);
  if (overlayResult && overlayResult.unlocked) {
    handleUnlockSuccess(overlayResult.status || {});
    return { unlocked: true, status: overlayResult.status || status };
  }
  return { unlocked: false, status: overlayResult?.status || autoRes || status };
}

function buildAutoUnlockFailureResult(autoRes, status) {
  var errMsg =
    (autoRes && (autoRes.cause || autoRes.error || autoRes.message)) ||
    'No se pudo abrir la base de datos clínica.';
  showToastIfAvailable(errMsg, 'error');
  return { unlocked: false, status: autoRes || status };
}

/**
 * Poll + auto-unlock clinical DB (no manual gate). Used at boot and onboarding.
 * @returns {Promise<{ unlocked: boolean, status?: object, reason?: string }>}
 */
export async function ensureClinicalDbUnlocked() {
  if (!isDbMode()) return { unlocked: true };
  var electron = electronApi();
  if (!electron || typeof electron.dbStatus !== 'function') {
    return { unlocked: false, reason: 'no_api' };
  }

  var delays = getClinicalBootDelays();
  for (var i = 0; i < delays.length; i += 1) {
    if (delays[i] > 0) await delayMs(delays[i]);
    var attempt = await pollBootUnlockAttempt(electron);
    if (attempt) return attempt;
  }

  var final = await waitForDbUnlock();
  return {
    unlocked: !!(final && final.unlocked),
    status: final && final.status,
    reason: final && final.unlocked ? undefined : 'locked',
  };
}

/**
 * Opens the clinical DB on startup (no passphrase gate while encryption is deferred).
 * @returns {Promise<{ unlocked: boolean, status?: object }>}
 */
export async function waitForDbUnlock() {
  if (!isDbMode()) return { unlocked: true };
  var electron = electronApi();
  if (!electron || typeof electron.dbStatus !== 'function') {
    return { unlocked: true };
  }

  var status = await readDbStatus(electron);
  if (!status) return { unlocked: false };
  if (isUnlockedDbStatus(status)) {
    return { unlocked: true, status: status };
  }
  if (!isSqlcipherNativeReady(status)) {
    return handleNativeBlockedUnlock(status);
  }

  var autoAttempt = await tryAutoUnlockAttempt(electron);
  if (autoAttempt.unlocked) return { unlocked: true, status: autoAttempt.status };

  var gateResult = await tryManualUnlockGate(status, autoAttempt.autoRes);
  if (gateResult) return gateResult;

  return buildAutoUnlockFailureResult(autoAttempt.autoRes, status);
}
