/** SQLCipher unlock overlay (Electron db mode only) — thin barrel. */
export {
  needsPassphraseConfirm,
  collectClinicalLsSnapshot,
} from './db-unlock-migration.mjs';
export { describeClinicalDbBootFailure } from './db-unlock-errors.mjs';
export {
  showRecoveryCodeReveal,
  dismissRecoveryCodeReveal,
  toggleDbUnlockSecretField,
  __resetDbUnlockWaitForTests,
} from './db-unlock-overlay.mjs';
export { getClinicalBootDelays, isSqlcipherNativeReady } from './db-unlock-native.mjs';
export { ensureClinicalDbUnlocked, waitForDbUnlock } from './db-unlock-boot.mjs';
export { applyClinicalDbUnlockCompletion } from './db-unlock-completion.mjs';
export {
  toggleRecoveryMode,
  submitRecoveryCode,
  submitDbUnlockPassphrase,
} from './db-unlock-submit.mjs';
export {
  syncDbSecuritySectionUi,
  openChangeMasterPasswordModal,
  closeChangeMasterPasswordModal,
  submitChangeMasterPassword,
} from './db-unlock-change-pass.mjs';

import { applyClinicalDbUnlockCompletion } from './db-unlock-completion.mjs';
import { ensureClinicalDbUnlocked } from './db-unlock-boot.mjs';
import {
  dismissRecoveryCodeReveal,
  toggleDbUnlockSecretField,
} from './db-unlock-overlay.mjs';
import {
  submitDbUnlockPassphrase,
  submitRecoveryCode,
  toggleRecoveryMode,
} from './db-unlock-submit.mjs';
import {
  closeChangeMasterPasswordModal,
  openChangeMasterPasswordModal,
  submitChangeMasterPassword,
} from './db-unlock-change-pass.mjs';

/**
 * Re-open DB unlock from onboarding / Mi rotación when boot auto-unlock did not run.
 * @returns {Promise<boolean>}
 */
export async function retryClinicalDbUnlockForOnboarding() {
  const { isDbMode } = await import('../db-storage-bridge.mjs');
  if (!isDbMode()) return false;
  const result = await ensureClinicalDbUnlocked();
  if (!result || !result.unlocked) return false;
  await applyClinicalDbUnlockCompletion({ refreshOnboarding: true });
  return true;
}

export const dbUnlockWindowHandlers = {
  dismissRecoveryCodeReveal,
  submitDbUnlockPassphrase,
  submitRecoveryCode,
  toggleRecoveryMode,
  openChangeMasterPasswordModal,
  closeChangeMasterPasswordModal,
  submitChangeMasterPassword,
  retryClinicalDbUnlockForOnboarding,
};

/** @internal tests */
export const __test = {
  toggleDbUnlockSecretField,
};
