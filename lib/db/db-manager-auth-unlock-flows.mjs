import fs from 'node:fs';
import { appendAuditInTransaction } from './forensic-audit.mjs';
import { clinicalDbPath } from './db-path.mjs';
import { loadNativeDatabase } from './native-load.mjs';
import {
  ARGON2_OPTS,
  deriveSqlcipherKeyHex,
  LEGACY_RECOVERY_CODE,
  normalizeRecoveryCodeInput,
  newSalt,
  unwrapDek,
  wrapDek,
} from './crypto.mjs';
import { getAppMeta, setAppMeta } from './db-manager-app-meta.mjs';
import {
  readUnlockMeta,
  removeClinicalDbFiles,
  removeUnlockMetaFile,
  writeUnlockMeta,
} from './db-manager-unlock-meta.mjs';
import {
  clearUnlockFails,
  flushPendingAuditsInTransaction,
  isRateLimited,
  keyHexMatchesSession,
  lockDb,
  openDatabaseConnection,
  recordUnlockFail,
  setupRecoveryKey,
  unlockWithKeyHex,
  unwrapRecoveryKeyFromCode,
} from './db-manager-auth-internals.mjs';

export function resolveUnlockSalt(ctx, { setup, bootstrap }) {
  const { deps, state } = ctx;
  let saltBuf = null;
  let nextBootstrap = bootstrap;

  if (setup) {
    lockDb(ctx);
    saltBuf = newSalt();
    removeClinicalDbFiles(deps.userDataPath);
    removeUnlockMetaFile(deps.userDataPath);
    nextBootstrap = {};
    if (fs.existsSync(clinicalDbPath(deps.userDataPath))) {
      recordUnlockFail(state);
      const err = new Error('Could not reset prior encrypted database files');
      err.code = 'DB_SETUP_RESET_FAILED';
      throw err;
    }
  } else if (bootstrap.kdf_salt) {
    saltBuf = Buffer.from(bootstrap.kdf_salt, 'base64');
  } else if (fs.existsSync(clinicalDbPath(deps.userDataPath))) {
    recordUnlockFail(state);
    const err = new Error('Missing KDF salt metadata');
    err.code = 'DB_UNLOCK_METADATA_MISSING';
    throw err;
  } else {
    saltBuf = newSalt();
  }

  return { saltBuf, bootstrap: nextBootstrap };
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function deriveKeyHexFromPassphrase(ctx, passphrase, saltBuf, setup) {
  const { state } = ctx;
  try {
    return await deriveSqlcipherKeyHex(passphrase, saltBuf);
  } catch (deriveErr) {
    recordUnlockFail(state);
    const err = new Error(setup ? 'Encrypted database setup failed' : 'Invalid passphrase');
    err.code = setup ? 'DB_SETUP_FAILED' : 'DB_UNLOCK_FAILED';
    err.cause = deriveErr;
    throw err;
  }
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function openDbWithDerivedKey(ctx, keyHex, setup) {
  const { deps, state } = ctx;
  try {
    await unlockWithKeyHex(ctx, keyHex);
  } catch (openErr) {
    if (
      openErr?.code === 'DB_NATIVE_ABI_MISMATCH' ||
      openErr?.code === 'DB_SCHEMA_MIGRATION_FAILED'
    ) {
      throw openErr;
    }
    const openDetail = String(openErr?.cause?.message || openErr?.message || '');
    if (/NODE_MODULE_VERSION|was compiled against a different/i.test(openDetail)) {
      const err = new Error(openErr.message || 'Native database module failed to load');
      err.code = 'DB_NATIVE_ABI_MISMATCH';
      err.cause = openErr;
      throw err;
    }
    if (setup) {
      removeClinicalDbFiles(deps.userDataPath);
      try {
        await unlockWithKeyHex(ctx, keyHex);
      } catch (retryErr) {
        recordUnlockFail(state);
        const err = new Error('Encrypted database setup failed');
        err.code = 'DB_SETUP_FAILED';
        err.cause = retryErr;
        throw err;
      }
    } else {
      recordUnlockFail(state);
      const err = new Error('Invalid passphrase');
      err.code = 'DB_UNLOCK_FAILED';
      err.cause = openErr;
      throw err;
    }
  }
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export function persistPassphraseUnlockMeta(
  ctx,
  { keyHex, saltBuf, bootstrap, remember, setup }
) {
  const { deps, state } = ctx;
  const saltB64 = saltBuf.toString('base64');
  const nextBootstrap = { ...bootstrap, kdf_salt: saltB64 };
  let rememberPersisted = false;
  const db = deps.getDb();
  try {
    db.transaction(() => {
      flushPendingAuditsInTransaction(state, db, deps.getClientId());
      setAppMeta(db, 'kdf_salt', saltB64);
      setAppMeta(db, 'kdf_params_json', JSON.stringify(ARGON2_OPTS));
      if (remember) {
        const wrapped = wrapDek(keyHex, deps.safeStorage);
        if (wrapped) {
          setAppMeta(db, 'wrapped_dek', wrapped);
          nextBootstrap.wrapped_dek = wrapped;
          rememberPersisted = true;
        }
      } else {
        db.prepare("DELETE FROM app_meta WHERE key = 'wrapped_dek'").run();
        delete nextBootstrap.wrapped_dek;
      }
      appendAuditInTransaction(db, {
        clientId: deps.getClientId(),
        eventType: 'auth.unlock.success',
        meta: {},
      });
      if (rememberPersisted) {
        appendAuditInTransaction(db, {
          clientId: deps.getClientId(),
          eventType: 'auth.remember_enabled',
          meta: {},
        });
      }
    })();
  } catch (metaErr) {
    lockDb(ctx);
    const err = new Error('Encrypted database setup failed');
    err.code = setup ? 'DB_SETUP_FAILED' : 'DB_ERROR';
    err.cause = metaErr;
    throw err;
  }
  writeUnlockMeta(deps.userDataPath, nextBootstrap);
  return nextBootstrap;
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function unlockWithPassphraseImpl(ctx, passphrase, { remember, setup } = {}) {
  const { deps, state } = ctx;
  loadNativeDatabase();
  if (isRateLimited(state)) {
    const err = new Error('Too many unlock attempts');
    err.code = 'AUTH_RATE_LIMITED';
    throw err;
  }
  if (!passphrase) {
    recordUnlockFail(state);
    const err = new Error('Passphrase required');
    err.code = 'DB_UNLOCK_FAILED';
    throw err;
  }

  const initialBootstrap = readUnlockMeta(deps.userDataPath);
  const { saltBuf, bootstrap } = resolveUnlockSalt(ctx, { setup, bootstrap: initialBootstrap });
  const keyHex = await deriveKeyHexFromPassphrase(ctx, passphrase, saltBuf, setup);
  await openDbWithDerivedKey(ctx, keyHex, setup);
  persistPassphraseUnlockMeta(ctx, { keyHex, saltBuf, bootstrap, remember, setup });

  let recoveryReveal = null;
  try {
    const recoverySetup = await setupRecoveryKey(ctx, keyHex);
    if (recoverySetup.isNew && recoverySetup.recoveryCode) {
      recoveryReveal = recoverySetup.recoveryCode;
    }
  } catch {
    // recovery setup is best-effort; unlock succeeds regardless
  }
  clearUnlockFails(state);
  return { ok: true, recoveryCodeToShow: recoveryReveal };
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function resolveRecoveryKeyHex(ctx, bootstrap, normalized) {
  const candidates = [];
  if (Number(bootstrap.recovery_version) >= 2) {
    candidates.push(normalized);
  } else {
    candidates.push(normalized, LEGACY_RECOVERY_CODE);
  }

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const attempt = await unwrapRecoveryKeyFromCode(ctx, bootstrap, candidate);
    if (attempt) {
      return { keyHex: attempt, usedLegacy: candidate === LEGACY_RECOVERY_CODE };
    }
  }
  return { keyHex: null, usedLegacy: false };
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
async function openDbWithRecoveryKey(ctx, keyHex) {
  const { state } = ctx;
  try {
    await unlockWithKeyHex(ctx, keyHex);
  } catch (openErr) {
    if (
      openErr?.code === 'DB_NATIVE_ABI_MISMATCH' ||
      openErr?.code === 'DB_SCHEMA_MIGRATION_FAILED'
    ) {
      throw openErr;
    }
    recordUnlockFail(state);
    const err = new Error('Invalid recovery code');
    err.code = 'DB_UNLOCK_FAILED';
    err.cause = openErr;
    throw err;
  }
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
async function finalizeRecoveryUnlock(ctx, bootstrap, keyHex, usedLegacy) {
  const { deps, state } = ctx;
  let recoveryReveal = null;
  if (usedLegacy || Number(bootstrap.recovery_version) < 2) {
    try {
      const rotated = await setupRecoveryKey(ctx, keyHex, { forceRotate: true });
      if (rotated.recoveryCode) recoveryReveal = rotated.recoveryCode;
    } catch {
      /* non-critical */
    }
  }

  clearUnlockFails(state);
  const db = deps.getDb();
  try {
    db.transaction(() => {
      appendAuditInTransaction(db, {
        clientId: deps.getClientId(),
        eventType: 'auth.recovery.unlock',
        meta: { legacy: usedLegacy },
      });
    })();
  } catch {
    // audit is non-critical for unlock
  }
  return { ok: true, recoveryCodeToShow: recoveryReveal };
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function unlockWithRecoveryCodeImpl(ctx, code) {
  const { deps, state } = ctx;
  const normalized = normalizeRecoveryCodeInput(code);
  if (!normalized) {
    recordUnlockFail(state);
    const err = new Error('Invalid recovery code');
    err.code = 'DB_UNLOCK_FAILED';
    throw err;
  }
  if (isRateLimited(state)) {
    const err = new Error('Too many unlock attempts');
    err.code = 'AUTH_RATE_LIMITED';
    throw err;
  }
  loadNativeDatabase();
  const bootstrap = readUnlockMeta(deps.userDataPath);
  if (!bootstrap.recovery_salt || !bootstrap.recovery_wrapped_key) {
    recordUnlockFail(state);
    const err = new Error('Recovery not configured');
    err.code = 'DB_RECOVERY_NOT_CONFIGURED';
    throw err;
  }

  const { keyHex, usedLegacy } = await resolveRecoveryKeyHex(ctx, bootstrap, normalized);
  if (!keyHex) {
    recordUnlockFail(state);
    const err = new Error('Invalid recovery code');
    err.code = 'DB_UNLOCK_FAILED';
    throw err;
  }

  await openDbWithRecoveryKey(ctx, keyHex);
  return finalizeRecoveryUnlock(ctx, bootstrap, keyHex, usedLegacy);
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function tryUnlockRememberedImpl(ctx) {
  const { deps, state } = ctx;
  if (isRateLimited(state)) return false;
  const bootstrap = readUnlockMeta(deps.userDataPath);
  let wrapped = bootstrap.wrapped_dek ?? null;
  const db = deps.getDb();
  if (!wrapped && db) {
    wrapped = getAppMeta(db, 'wrapped_dek');
  }
  const dek = unwrapDek(wrapped, deps.safeStorage);
  if (!dek) return false;
  try {
    await unlockWithKeyHex(ctx, dek);
    clearUnlockFails(state);
    return true;
  } catch {
    return false;
  }
}

function isNotADatabaseError(err) {
  const detail = String(err?.cause?.message || err?.message || '');
  return /file is not a database|not a database/i.test(detail);
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function ensureUnlockedImpl(ctx) {
  const { deps, state } = ctx;
  if (deps.getState() === 'unlocked') return { ok: true };
  loadNativeDatabase();
  if (await tryUnlockRememberedImpl(ctx)) return { ok: true };

  const bootstrap = readUnlockMeta(deps.userDataPath);
  const dbPath = clinicalDbPath(deps.userDataPath);
  const dbExists = fs.existsSync(dbPath);

  try {
    await openDatabaseConnection(ctx);
    clearUnlockFails(state);
    return { ok: true };
  } catch (plainErr) {
    if (!dbExists || !bootstrap.kdf_salt || !isNotADatabaseError(plainErr)) {
      throw plainErr;
    }
    lockDb(ctx);
    removeClinicalDbFiles(deps.userDataPath);
    removeUnlockMetaFile(deps.userDataPath);
    await openDatabaseConnection(ctx);
    clearUnlockFails(state);
    return { ok: true };
  }
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function changePassphraseImpl(
  ctx,
  { currentPassphrase, newPassphrase, remember } = {}
) {
  const { deps } = ctx;
  if (deps.getState() !== 'unlocked' || !deps.getDb()) {
    const err = new Error('Database locked');
    err.code = 'DB_LOCKED';
    throw err;
  }
  if (!currentPassphrase || !newPassphrase) {
    const err = new Error('Passphrase required');
    err.code = 'DB_PASSPHRASE_INVALID';
    throw err;
  }
  if (String(newPassphrase).length < 8) {
    const err = new Error('New passphrase must be at least 8 characters');
    err.code = 'DB_PASSPHRASE_TOO_SHORT';
    throw err;
  }

  const bootstrap = readUnlockMeta(deps.userDataPath);
  if (!bootstrap.kdf_salt) {
    const err = new Error('Missing KDF salt metadata');
    err.code = 'DB_UNLOCK_METADATA_MISSING';
    throw err;
  }

  const saltBuf = Buffer.from(bootstrap.kdf_salt, 'base64');
  const currentKeyHex = await deriveSqlcipherKeyHex(currentPassphrase, saltBuf);
  if (!keyHexMatchesSession(ctx, currentKeyHex)) {
    const err = new Error('Current passphrase incorrect');
    err.code = 'DB_PASSPHRASE_MISMATCH';
    throw err;
  }

  const newSaltBuf = newSalt();
  const newKeyHex = await deriveSqlcipherKeyHex(newPassphrase, newSaltBuf);
  const saltB64 = newSaltBuf.toString('base64');
  const db = deps.getDb();

  db.pragma('journal_mode = DELETE');
  db.pragma(`rekey = "x'${newKeyHex}'"`);
  db.pragma('journal_mode = WAL');
  const nextBootstrap = { ...bootstrap, kdf_salt: saltB64 };
  let rememberPersisted = false;
  db.transaction(() => {
    setAppMeta(db, 'kdf_salt', saltB64);
    setAppMeta(db, 'kdf_params_json', JSON.stringify(ARGON2_OPTS));
    if (remember) {
      const wrapped = wrapDek(newKeyHex, deps.safeStorage);
      if (wrapped) {
        setAppMeta(db, 'wrapped_dek', wrapped);
        nextBootstrap.wrapped_dek = wrapped;
        rememberPersisted = true;
      }
    } else {
      db.prepare("DELETE FROM app_meta WHERE key = 'wrapped_dek'").run();
      delete nextBootstrap.wrapped_dek;
    }
    appendAuditInTransaction(db, {
      clientId: deps.getClientId(),
      eventType: 'auth.passphrase.change',
      meta: { rememberPersisted },
    });
  })();
  writeUnlockMeta(deps.userDataPath, nextBootstrap);
  deps.setActiveKeyHex(newKeyHex);
  return true;
}
