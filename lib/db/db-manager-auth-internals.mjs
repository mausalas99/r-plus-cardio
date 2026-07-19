import crypto from 'node:crypto';
import fs from 'node:fs';
import { applyMigrations } from './schema.mjs';
import { appendAuditInTransaction } from './forensic-audit.mjs';
import { clinicalDbPath } from './db-path.mjs';
import { loadNativeDatabase } from './native-load.mjs';
import {
  deriveRecoveryWrappingKeyHex,
  generateRecoveryCode,
  newSalt,
  unwrapKeyForRecovery,
  wrapKeyForRecovery,
} from './crypto.mjs';
import { setAppMeta, assertCipherReadable } from './db-manager-app-meta.mjs';
import {
  readUnlockMeta,
  writeUnlockMeta,
} from './db-manager-unlock-meta.mjs';

export const MAX_UNLOCK_FAILS = 5;
export const UNLOCK_FAIL_WINDOW_MS = 15 * 60 * 1000;

/** @param {{ unlockFailTimestamps: number[] }} state */
export function isRateLimited(state) {
  const now = Date.now();
  state.unlockFailTimestamps = state.unlockFailTimestamps.filter(
    (t) => now - t < UNLOCK_FAIL_WINDOW_MS
  );
  return state.unlockFailTimestamps.length >= MAX_UNLOCK_FAILS;
}

/** @param {{ unlockFailTimestamps: number[], pendingUnlockFailCount: number }} state */
export function recordUnlockFail(state) {
  state.unlockFailTimestamps.push(Date.now());
  state.pendingUnlockFailCount += 1;
}

/** @param {{ unlockFailTimestamps: number[], pendingUnlockFailCount: number }} state */
export function clearUnlockFails(state) {
  state.unlockFailTimestamps = [];
}

/** @param {{ pendingUnlockFailCount: number, pendingAudits: { eventType: string, meta: Record<string, unknown> }[] }} state */
export function flushPendingAuditsInTransaction(state, conn, clientId) {
  for (let i = 0; i < state.pendingUnlockFailCount; i += 1) {
    appendAuditInTransaction(conn, {
      clientId,
      eventType: 'auth.unlock.fail',
      meta: {},
    });
  }
  state.pendingUnlockFailCount = 0;
  for (const item of state.pendingAudits) {
    appendAuditInTransaction(conn, {
      clientId,
      eventType: item.eventType,
      meta: item.meta,
    });
  }
  state.pendingAudits.length = 0;
}

/** @param {{ pendingAudits: { eventType: string, meta: Record<string, unknown> }[] }} state */
export function schedulePendingAuditInternal(state, eventType, meta = {}) {
  state.pendingAudits.push({ eventType, meta });
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export function lockDb(ctx) {
  const { deps } = ctx;
  const db = deps.getDb();
  if (db && deps.getState() === 'unlocked') {
    try {
      db.transaction(() => {
        appendAuditInTransaction(db, {
          clientId: deps.getClientId(),
          eventType: 'auth.lock',
          meta: {},
        });
      })();
    } catch {
      /* locked db may be unusable */
    }
    db.close();
  }
  deps.setDb(null);
  deps.setState('locked');
  deps.setActiveKeyHex(null);
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function openDatabaseConnection(ctx, { keyHex } = {}) {
  const { deps } = ctx;
  if (deps.getState() === 'unlocked') lockDb(ctx);
  const Database = loadNativeDatabase();
  fs.mkdirSync(deps.userDataPath, { recursive: true });
  const filePath = clinicalDbPath(deps.userDataPath);
  const conn = new Database(filePath);
  if (keyHex) {
    conn.pragma(`key = "x'${keyHex}'"`);
  }
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  try {
    applyMigrations(conn);
  } catch (migErr) {
    try {
      conn.close();
    } catch (_e) { void _e; }
    const err = new Error('Schema migration failed');
    err.code = 'DB_SCHEMA_MIGRATION_FAILED';
    err.cause = migErr;
    throw err;
  }
  assertCipherReadable(conn);
  deps.setDb(conn);
  deps.setState('unlocked');
  deps.setActiveKeyHex(keyHex || null);
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function unlockWithKeyHex(ctx, keyHex) {
  await openDatabaseConnection(ctx, { keyHex });
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export function keyHexMatchesSession(ctx, candidateHex) {
  const activeKeyHex = ctx.deps.getActiveKeyHex();
  if (!activeKeyHex || !candidateHex) return false;
  const a = Buffer.from(activeKeyHex, 'utf8');
  const b = Buffer.from(candidateHex, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function setupRecoveryKey(ctx, keyHex, { forceRotate = false } = {}) {
  const { deps } = ctx;
  const bootstrap = readUnlockMeta(deps.userDataPath);
  const hasV2 =
    Number(bootstrap.recovery_version) >= 2 &&
    bootstrap.recovery_salt &&
    bootstrap.recovery_wrapped_key;
  if (hasV2 && !forceRotate) {
    return { recoveryCode: null, isNew: false };
  }

  const recoverySalt = bootstrap.recovery_salt
    ? Buffer.from(bootstrap.recovery_salt, 'base64')
    : newSalt();
  const recoveryCode = generateRecoveryCode();
  const wrappingKeyHex = await deriveRecoveryWrappingKeyHex(recoverySalt, recoveryCode);
  const wrapped = wrapKeyForRecovery(keyHex, wrappingKeyHex);
  const recoverySaltB64 = recoverySalt.toString('base64');
  const nextBootstrap = {
    ...bootstrap,
    recovery_version: 2,
    recovery_salt: recoverySaltB64,
    recovery_wrapped_key: JSON.stringify(wrapped),
  };
  writeUnlockMeta(deps.userDataPath, nextBootstrap);
  const db = deps.getDb();
  if (db && deps.getState() === 'unlocked') {
    try {
      db.transaction(() => {
        setAppMeta(db, 'recovery_version', '2');
        setAppMeta(db, 'recovery_salt', recoverySaltB64);
        setAppMeta(db, 'recovery_wrapped_key', JSON.stringify(wrapped));
      })();
    } catch {
      // recovery persists via meta file alone
    }
  }
  return { recoveryCode, isNew: true };
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export async function unwrapRecoveryKeyFromCode(ctx, bootstrap, code) {
  if (!bootstrap.recovery_salt || !bootstrap.recovery_wrapped_key) {
    return null;
  }
  const recoverySalt = Buffer.from(bootstrap.recovery_salt, 'base64');
  let wrapped;
  try {
    wrapped = JSON.parse(bootstrap.recovery_wrapped_key);
  } catch {
    return null;
  }
  const wrappingKeyHex = await deriveRecoveryWrappingKeyHex(recoverySalt, code);
  try {
    return unwrapKeyForRecovery(wrapped, wrappingKeyHex);
  } catch {
    return null;
  }
}

/** @param {ReturnType<typeof createAuthDeps>} ctx */
export {
  unlockWithPassphraseImpl,
  resolveRecoveryKeyHex,
  unlockWithRecoveryCodeImpl,
  tryUnlockRememberedImpl,
  ensureUnlockedImpl,
  changePassphraseImpl,
} from './db-manager-auth-unlock-flows.mjs';


/**
 * @param {object} deps
 * @returns {{ deps: object, state: { unlockFailTimestamps: number[], pendingUnlockFailCount: number, pendingAudits: { eventType: string, meta: Record<string, unknown> }[] } }}
 */
export function createAuthDeps(deps) {
  return {
    deps,
    state: {
      unlockFailTimestamps: [],
      pendingUnlockFailCount: 0,
      pendingAudits: [],
    },
  };
}
