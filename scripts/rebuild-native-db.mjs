import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeNativeBinary } from './lib/native-binary-format.mjs';
import {
  cacheElectronBinaryIfValid,
  electronSqlcipherLoads,
  ensureElectronRuntime,
  rememberElectronBinary,
  restoreElectronBinaryFromCache,
  sqlcipherDestAbs,
} from './lib/sqlcipher-native.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.env.R_PLUS_STRICT_NATIVE === '1';
const sqlAbs = sqlcipherDestAbs(root);
const expectPlatform = process.platform === 'win32' ? 'win32' : 'darwin';
const format = describeNativeBinary(sqlAbs, expectPlatform);

function runElectronRebuild(force) {
  const forceFlag = force ? ' -f' : '';
  execSync(`npx @electron/rebuild${forceFlag} -w better-sqlite3-multiple-ciphers`, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    timeout: 180_000,
  });
}

function tryFetchElectronPrebuild() {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;
  execSync('node scripts/fetch-sqlite-electron.mjs', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    timeout: 120_000,
  });
}

function failOrWarn(msg) {
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  process.exit(0);
}

const needsRebuild = !format.ok || !electronSqlcipherLoads(root);

if (!needsRebuild) {
  rememberElectronBinary(root);
  process.exit(0);
}

console.log('[rebuild-native-db] SQLCipher missing or wrong ABI for Electron — restoring…');

if (!ensureElectronRuntime(root)) {
  failOrWarn(
    '[rebuild-native-db] Electron runtime missing. Run: node node_modules/electron/install.js && npm run rebuild:db-native'
  );
}

if (restoreElectronBinaryFromCache(root) && electronSqlcipherLoads(root)) {
  console.log('[rebuild-native-db] Restored Electron binary from cache');
  rememberElectronBinary(root);
  process.exit(0);
}

try {
  runElectronRebuild(true);
} catch (e) {
  failOrWarn(`[rebuild-native-db] electron rebuild failed: ${e.message}`);
}

if (!electronSqlcipherLoads(root)) {
  try {
    tryFetchElectronPrebuild();
    runElectronRebuild(true);
  } catch (e) {
    failOrWarn(`[rebuild-native-db] recovery after fetch-sqlite-electron failed: ${e.message}`);
  }
}

if (!electronSqlcipherLoads(root)) {
  failOrWarn(
    '[rebuild-native-db] SQLCipher still does not load under Electron. Run: node scripts/fetch-sqlite-electron.mjs && npm run rebuild:db-native'
  );
}

rememberElectronBinary(root);
console.log('[rebuild-native-db] Electron SQLCipher OK');
