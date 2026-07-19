/**
 * Rebuild better-sqlite3-multiple-ciphers for the current Node ABI when needed.
 * Legacy: npm test no longer uses system Node (see scripts/run-with-electron-node.mjs).
 * Keep for manual `node --test` without the Electron wrapper, or CI without Electron.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheElectronBinaryIfValid } from './lib/sqlcipher-native.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'better-sqlite3-multiple-ciphers');

const NATIVE_PROBE = [
  "const D = require('better-sqlite3-multiple-ciphers');",
  "const db = new D(':memory:');",
  'db.close();',
].join('');

/** Probe in a child process so a bad .node cannot SIGKILL this script mid-recovery. */
function nativeLoadError() {
  try {
    execSync(`node -e ${JSON.stringify(NATIVE_PROBE)}`, {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 15_000,
      env: process.env,
    });
    return null;
  } catch (e) {
    if (e.status === 137 || e.signal === 'SIGKILL') {
      return 'Native module load aborted (SIGKILL) — binary likely wrong ABI or corrupt';
    }
    const stderr = e.stderr ? String(e.stderr).trim() : '';
    return stderr || (e.message ? String(e.message) : String(e));
  }
}

const mismatch = nativeLoadError();
if (!mismatch) {
  process.exit(0);
}

console.log(
  `[ensure-native-db-for-node] Native DB module mismatch for Node ${process.version} (modules ${process.versions.modules}); rebuilding…`
);

cacheElectronBinaryIfValid(root);

/** Rosetta Node on Apple Silicon — compile paths need native arm64. */
function needsDarwinArm64Wrap() {
  return process.platform === 'darwin' && process.arch === 'x64';
}

function wrapDarwinArm64(cmd) {
  if (needsDarwinArm64Wrap()) {
    return `arch -arm64 ${cmd}`;
  }
  return cmd;
}

function runShell(cmd, opts = {}) {
  execSync(wrapDarwinArm64(cmd), {
    cwd: opts.cwd || root,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
    shell: true,
  });
}

function tryFetchNodePrebuild() {
  console.log('[ensure-native-db-for-node] Trying GitHub Node prebuild fetch…');
  runShell('node scripts/fetch-sqlite-node.mjs');
}

function tryNpmRebuild() {
  console.log('[ensure-native-db-for-node] Trying npm rebuild (may compile from source)…');
  const rebuildCmd = needsDarwinArm64Wrap()
    ? 'arch -arm64 npm rebuild better-sqlite3-multiple-ciphers'
    : 'npm rebuild better-sqlite3-multiple-ciphers';
  runShell(rebuildCmd);
}

/** npm test uses Node ABI; R+ app needs Electron ABI — restore after failed pretest. */
function restoreElectronSqlcipherForApp() {
  console.warn(
    '[ensure-native-db-for-node] Restoring Electron SQLCipher binary (R+ app needs this to open your DB)…'
  );
  try {
    runShell('node scripts/rebuild-native-db.mjs');
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    console.warn('[ensure-native-db-for-node] Electron restore failed:', msg);
  }
}

let lastError = null;

try {
  tryFetchNodePrebuild();
  if (!nativeLoadError()) {
    console.log('[ensure-native-db-for-node] OK for Node', process.version);
    process.exit(0);
  }
} catch (e) {
  lastError = e;
  const msg = e && e.message ? String(e.message) : String(e);
  console.warn('[ensure-native-db-for-node] tryFetchNodePrebuild failed:', msg);
}

// Do not run prebuild-install here — it targets npm_config_runtime (Electron) and
// overwrites a good Node prebuild with the wrong ABI (SIGKILL under system Node).

try {
  tryNpmRebuild();
} catch (e) {
  lastError = e;
  const msg = e && e.message ? String(e.message) : String(e);
  if (/libxcrun|need 'x86_64'|Rosetta/i.test(msg)) {
    console.warn(
      '[ensure-native-db-for-node] Compile failed (arch mismatch). ' +
        'Use a native arm64 Terminal (not Rosetta) or rely on prebuild fetch.'
    );
  } else {
    console.warn('[ensure-native-db-for-node] tryNpmRebuild failed:', msg);
  }
}

const after = nativeLoadError();
if (after) {
  console.error('[ensure-native-db-for-node] Still cannot load native module after rebuild:\n', after);
  if (lastError) {
    console.error('[ensure-native-db-for-node] Last error:', lastError.message || lastError);
  }
  console.error(
    '[ensure-native-db-for-node] Try: node scripts/fetch-sqlite-node.mjs  (Node prebuild for tests)'
  );
  restoreElectronSqlcipherForApp();
  process.exit(1);
}

console.log('[ensure-native-db-for-node] OK for Node', process.version);
