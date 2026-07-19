/**
 * Shared SQLCipher native helpers: Electron probe + on-disk Electron backup.
 * better-sqlite3 lazy-loads the .node on first Database() — probes must open :memory:.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const SQLCIPHER_NODE_REL = 'node_modules/better-sqlite3-multiple-ciphers/build/Release/better_sqlite3.node';

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(libDir, '..', '..');
const require = createRequire(import.meta.url);

/** @param {string} [root] */
export function electronAppBinaryAbs(root = repoRoot) {
  if (process.platform === 'win32') {
    return path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  }
  if (process.platform === 'darwin') {
    return path.join(
      root,
      'node_modules',
      'electron',
      'dist',
      'Electron.app',
      'Contents',
      'MacOS',
      'Electron'
    );
  }
  return path.join(root, 'node_modules', 'electron', 'dist', 'electron');
}

/** @param {string} [root] */
export function electronRuntimeReady(root = repoRoot) {
  return fs.existsSync(electronAppBinaryAbs(root));
}

/**
 * Download Electron.app when npm postinstall was skipped or dist/ is incomplete.
 * @param {string} [root]
 * @returns {boolean}
 */
export function ensureElectronRuntime(root = repoRoot) {
  if (electronRuntimeReady(root)) return true;
  const installScript = path.join(root, 'node_modules', 'electron', 'install.js');
  if (!fs.existsSync(installScript)) return false;
  console.log('[sqlcipher-native] Electron runtime missing — running electron/install.js…');
  execSync(`node "${installScript}"`, { cwd: root, stdio: 'inherit', timeout: 300_000 });
  return electronRuntimeReady(root);
}

/** @param {string} [root] */
export function sqlcipherDestAbs(root = repoRoot) {
  return path.join(root, SQLCIPHER_NODE_REL);
}

export function electronCacheAbs(root = repoRoot, platform = process.platform, arch = process.arch) {
  return path.join(root, 'scripts', '.native-cache', `better_sqlite3.electron.${platform}-${arch}.node`);
}

function legacyElectronCacheAbs(root = repoRoot) {
  return path.join(root, 'scripts', '.native-cache', 'better_sqlite3.electron.node');
}

/** Copy dest → per-arch cache (no load probe). Used after cross-arch beforePack installs. */
export function stashSqlcipherBinaryForArch(root, platform, arch) {
  const dest = sqlcipherDestAbs(root);
  if (!fs.existsSync(dest)) return false;
  const cache = electronCacheAbs(root, platform, arch);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.copyFileSync(dest, cache);
  return true;
}

/** @param {string} [root] */
export function electronBinAbs(root = repoRoot) {
  return process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'electron.cmd')
    : path.join(root, 'node_modules', '.bin', 'electron');
}

/** @param {string} [root] */
export function electronSqlcipherProbeScript(root = repoRoot) {
  return path.join(root, 'scripts', 'electron-sqlcipher-probe.cjs');
}

/** Headless Electron child env (probe only — no Dock window / main.js). */
export function electronProbeEnv() {
  return { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
}

/**
 * Cross-arch Mac packs (arm64 host → x64 target) must skip load probe — Mach-O only.
 * @param {string} platform
 * @param {string} arch
 */
export function canProbeSqlcipherUnderElectron(platform, arch) {
  return platform === process.platform && arch === process.arch;
}

/**
 * @param {string} [root]
 */
export function electronSqlcipherLoads(root = repoRoot) {
  if (!electronRuntimeReady(root)) return false;
  const electronBin = electronBinAbs(root);
  if (!fs.existsSync(electronBin)) return false;
  const probeScript = electronSqlcipherProbeScript(root);
  const r = spawnSync(electronBin, [probeScript], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 45_000,
    env: electronProbeEnv(),
  });
  return r.status === 0;
}

/**
 * Cache the current dest binary when it already loads under Electron.
 * @param {string} [root]
 */
export function cacheElectronBinaryIfValid(
  root = repoRoot,
  platform = process.platform,
  arch = process.arch
) {
  const dest = sqlcipherDestAbs(root);
  if (!canProbeSqlcipherUnderElectron(platform, arch)) return false;
  if (!fs.existsSync(dest) || !electronSqlcipherLoads(root)) return false;
  const cache = electronCacheAbs(root, platform, arch);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.copyFileSync(dest, cache);
  return true;
}

/**
 * Restore a previously cached Electron binary.
 * @param {string} [root]
 */
export function restoreElectronBinaryFromCache(
  root = repoRoot,
  platform = process.platform,
  arch = process.arch
) {
  const dest = sqlcipherDestAbs(root);
  const candidates = [electronCacheAbs(root, platform, arch)];
  if (platform === process.platform && arch === process.arch) {
    candidates.push(legacyElectronCacheAbs(root));
  }
  for (const cache of candidates) {
    if (!fs.existsSync(cache)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(cache, dest);
    return true;
  }
  return false;
}

/** @param {string} [root] */
export function rememberElectronBinary(root = repoRoot) {
  return cacheElectronBinaryIfValid(root);
}
