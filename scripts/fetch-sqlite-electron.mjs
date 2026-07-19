/**
 * Install an Electron prebuild for better-sqlite3-multiple-ciphers on the host platform.
 * Used before Mac/Windows electron-builder runs when node_modules has the wrong format
 * (e.g. after fetch-sqlite-win or Node-only test prebuilds).
 *
 * Prebuilds: https://github.com/m4heshd/better-sqlite3-multiple-ciphers/releases
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeNativeBinary, isMachO, isWindowsPe, readBinaryHeader } from './lib/native-binary-format.mjs';
import {
  canProbeSqlcipherUnderElectron,
  electronRuntimeReady,
  electronSqlcipherLoads,
  ensureElectronRuntime,
  rememberElectronBinary,
  sqlcipherDestAbs,
  stashSqlcipherBinaryForArch,
} from './lib/sqlcipher-native.mjs';

const require = createRequire(import.meta.url);

const PREBUILD_REPO = 'm4heshd/better-sqlite3-multiple-ciphers';
const NODE_REL = 'build/Release/better_sqlite3.node';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destFile = sqlcipherDestAbs(root);

function resolveElectronAbi() {
  const electronVersion = require('electron/package.json').version;
  const abi = require('node-abi');
  return { electronVersion, abiVersion: abi.getAbi(electronVersion, 'electron') };
}

function resolveTarget() {
  const platform = process.env.R_PLUS_SQLITE_PLATFORM || process.platform;
  const arch = process.env.R_PLUS_SQLITE_ARCH || process.arch;
  return { platform, arch };
}

function prebuildAssetName(version, abiVersion, platform, arch) {
  return `better-sqlite3-multiple-ciphers-v${version}-electron-v${abiVersion}-${platform}-${arch}.tar.gz`;
}

function prebuildUrl(version, abiVersion, platform, arch) {
  const asset = prebuildAssetName(version, abiVersion, platform, arch);
  return `https://github.com/${PREBUILD_REPO}/releases/download/v${version}/${asset}`;
}

/** @param {string} abs @param {string} platform */
async function assertFormat(abs, platform) {
  const buf = readBinaryHeader(abs);
  if (platform === 'win32' && !isWindowsPe(buf)) {
    throw new Error(`${path.basename(abs)} is not a Windows PE binary`);
  }
  if (platform === 'darwin' && !isMachO(buf)) {
    throw new Error(`${path.basename(abs)} is not a Mach-O binary`);
  }
}

async function installFromUrl(url, platform, label) {
  const tmpTgz = path.join(root, 'scripts', '.sqlite-electron.tgz');
  const tmpDir = path.join(root, 'scripts', '.sqlite-electron-tmp');

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    await fs.writeFile(tmpTgz, Buffer.from(await resp.arrayBuffer()));
    await fs.mkdir(tmpDir, { recursive: true });
    execSync(`tar xzf "${tmpTgz}" -C "${tmpDir}"`, { cwd: root });
    const srcFile = path.join(tmpDir, NODE_REL);
    await assertFormat(srcFile, platform);
    await fs.mkdir(path.dirname(destFile), { recursive: true });
    await fs.copyFile(srcFile, destFile);
    console.log(`[fetch-sqlite-electron] Installed ${NODE_REL} (${label})`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.unlink(tmpTgz).catch(() => {});
  }
}

async function main() {
  const strict = process.env.R_PLUS_STRICT_NATIVE === '1';
  const { platform, arch } = resolveTarget();
  if (platform !== 'darwin' && platform !== 'win32') {
    console.log(`[fetch-sqlite-electron] Skip unsupported platform ${platform}`);
    process.exit(0);
  }

  if (canProbeSqlcipherUnderElectron(platform, arch) && !ensureElectronRuntime(root)) {
    console.error(
      '[fetch-sqlite-electron] Electron runtime is missing (node_modules/electron/dist incomplete). ' +
        'Run: node node_modules/electron/install.js'
    );
    process.exit(1);
  }

  if (
    !strict &&
    describeNativeBinary(destFile, platform).ok &&
    (!canProbeSqlcipherUnderElectron(platform, arch) || electronSqlcipherLoads(root))
  ) {
    console.log(`[fetch-sqlite-electron] ${NODE_REL} already valid for Electron on ${platform}-${arch}`);
    rememberElectronBinary(root);
    process.exit(0);
  }

  const version = require('better-sqlite3-multiple-ciphers/package.json').version;
  const { electronVersion, abiVersion } = resolveElectronAbi();
  const url = prebuildUrl(version, abiVersion, platform, arch);
  console.log(
    `[fetch-sqlite-electron] Electron ${electronVersion} (abi ${abiVersion}) ${platform}-${arch} → ${url}`
  );

  try {
    await installFromUrl(url, platform, `electron-v${abiVersion}-${platform}-${arch}`);
  } catch (e) {
    console.error(`[fetch-sqlite-electron] Failed: ${e.message}`);
    process.exit(1);
  }

  if (canProbeSqlcipherUnderElectron(platform, arch)) {
    if (!electronSqlcipherLoads(root)) {
      if (!electronRuntimeReady(root)) {
        console.error(
          '[fetch-sqlite-electron] Electron runtime missing after install attempt. ' +
            'Run: node node_modules/electron/install.js'
        );
      } else {
        console.error(
          '[fetch-sqlite-electron] Installed prebuild does not load under Electron (ABI mismatch). ' +
            'Try: npm run rebuild:db-native'
        );
      }
      process.exit(1);
    }
    rememberElectronBinary(root);
    console.log('[fetch-sqlite-electron] Verified OK under Electron');
  } else {
    await assertFormat(destFile, platform);
    stashSqlcipherBinaryForArch(root, platform, arch);
    console.log(
      `[fetch-sqlite-electron] Verified ${platform}-${arch} binary format (load probe skipped — host is ${process.platform}-${process.arch})`
    );
  }
}

await main();
