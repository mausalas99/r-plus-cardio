import {
  changePassphraseImpl,
  createAuthDeps,
  ensureUnlockedImpl,
  isRateLimited,
  lockDb,
  openDatabaseConnection,
  recordUnlockFail,
  schedulePendingAuditInternal,
  tryUnlockRememberedImpl,
  unlockWithKeyHex,
  unlockWithPassphraseImpl,
  unlockWithRecoveryCodeImpl,
} from './db-manager-auth-internals.mjs';

/**
 * @param {{
 *   userDataPath: string,
 *   safeStorage: object,
 *   getClientId: () => string,
 *   getDb: () => import('better-sqlite3').Database | null,
 *   getState: () => 'locked' | 'unlocked',
 *   setDb: (db: import('better-sqlite3').Database | null) => void,
 *   setState: (state: 'locked' | 'unlocked') => void,
 *   getActiveKeyHex: () => string | null,
 *   setActiveKeyHex: (hex: string | null) => void,
 *   schedulePendingAudit: (eventType: string, meta?: Record<string, unknown>) => void,
 * }} deps
 */
export function createDbAuthMethods(deps) {
  const ctx = createAuthDeps(deps);

  return {
    unlockWithPassphrase: (passphrase, opts) => unlockWithPassphraseImpl(ctx, passphrase, opts),
    unlockWithRecoveryCode: (code) => unlockWithRecoveryCodeImpl(ctx, code),
    changePassphrase: (opts) => changePassphraseImpl(ctx, opts),
    tryUnlockRemembered: () => tryUnlockRememberedImpl(ctx),
    ensureUnlocked: () => ensureUnlockedImpl(ctx),
    unlockPlain: () => openDatabaseConnection(ctx),
    unlockWithKeyHex: (keyHex) => unlockWithKeyHex(ctx, keyHex),
    lock: () => lockDb(ctx),
    isRateLimited: () => isRateLimited(ctx.state),
    recordUnlockFail: () => recordUnlockFail(ctx.state),
    schedulePendingAudit: (eventType, meta) =>
      schedulePendingAuditInternal(ctx.state, eventType, meta),
  };
}
