import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadNativeDatabase } from './native-load.mjs';
import { applyMigrations } from './schema.mjs';
import { createDbManager } from './db-manager.mjs';

/** 64-char hex SQLCipher key for tests. */
export const TEST_KEY_HEX = 'ab'.repeat(32);

const mockSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`enc:${s}`).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

/**
 * Create an unlocked db-manager backed by a temp userData directory.
 * @param {string} userDataPath
 * @param {() => string} [getClientId]
 */
export async function createUnlockedDbManager(userDataPath, getClientId = () => 'host-store-test') {
  const mgr = createDbManager({
    userDataPath,
    safeStorage: mockSafeStorage,
    getClientId,
  });
  await mgr.unlockWithKeyHex(TEST_KEY_HEX);
  return mgr;
}

/**
 * Open a temp-file SQLCipher database for tests.
 * @param {string} keyHex 64-char hex SQLCipher key
 * @param {{ after?: (registerCleanup: (fn: () => void) => void) => void }} [opts]
 */
export function openTestDb(keyHex, opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-db-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const Database = loadNativeDatabase();
  const db = new Database(dbPath);
  db.pragma(`key = "x'${keyHex}'"`);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);

  const cleanups = [];
  const registerCleanup = (fn) => {
    cleanups.push(fn);
  };
  if (opts.after) opts.after(registerCleanup);

  function close() {
    for (let i = cleanups.length - 1; i >= 0; i -= 1) {
      cleanups[i]();
    }
    if (db.open) db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch (_e) { void _e; }
    try {
      fs.rmdirSync(tmpDir);
    } catch {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return { db, dbPath, tmpDir, close };
}
