/**
 * Places a Windows x64 SQLCipher (.node) into better-sqlite3-multiple-ciphers when
 * cross-building the .exe from macOS/Linux. Without this, electron-builder packages
 * the host Mach-O binary and Windows shows "not a valid Win32 application".
 *
 * Prebuilds: https://github.com/m4heshd/better-sqlite3-multiple-ciphers/releases
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const SQLCIPHER_VERSION = '12.10.0';
const PREBUILD_REPO = 'm4heshd/better-sqlite3-multiple-ciphers';
const NODE_REL = 'build/Release/better_sqlite3.node';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'better-sqlite3-multiple-ciphers');
const destFile = path.join(pkgDir, NODE_REL);

function resolveElectronAbi() {
  const electronVersion = require('electron/package.json').version;
  const abi = require('node-abi');
  return { electronVersion, abiVersion: abi.getAbi(electronVersion, 'electron') };
}

function prebuildAssetName(abiVersion) {
  return `better-sqlite3-multiple-ciphers-v${SQLCIPHER_VERSION}-electron-v${abiVersion}-win32-x64.tar.gz`;
}

function prebuildUrl(abiVersion) {
  const asset = prebuildAssetName(abiVersion);
  return `https://github.com/${PREBUILD_REPO}/releases/download/v${SQLCIPHER_VERSION}/${asset}`;
}

/** @param {string} abs */
async function assertPeBinary(abs) {
  const buf = Buffer.alloc(2);
  const fh = await fs.open(abs, 'r');
  try {
    await fh.read(buf, 0, 2, 0);
  } finally {
    await fh.close();
  }
  if (buf[0] !== 0x4d || buf[1] !== 0x5a) {
    throw new Error(`${path.basename(abs)} is not a Windows PE binary (expected MZ header)`);
  }
}

async function copyIfPe(src, label) {
  await assertPeBinary(src);
  await fs.mkdir(path.dirname(destFile), { recursive: true });
  await fs.copyFile(src, destFile);
  console.log(`[fetch-sqlite-win] Installed Windows ${NODE_REL} (${label})`);
}

async function main() {
  if (process.platform === 'win32') {
    console.log('[fetch-sqlite-win] On Windows — use npm run rebuild:db-native instead.');
    process.exit(0);
  }

  try {
    await assertPeBinary(destFile);
    console.log(`[fetch-sqlite-win] ${NODE_REL} already Windows PE, skipping.`);
    process.exit(0);
  } catch {
    /* fetch */
  }

  const { electronVersion, abiVersion } = resolveElectronAbi();
  const url = prebuildUrl(abiVersion);
  console.log(
    `[fetch-sqlite-win] Electron ${electronVersion} (abi ${abiVersion}) → ${url}`
  );

  const tmpTgz = path.join(root, 'scripts', '.sqlite-win.tgz');
  const tmpDir = path.join(root, 'scripts', '.sqlite-win-tmp');

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    await fs.writeFile(tmpTgz, Buffer.from(await resp.arrayBuffer()));
    await fs.mkdir(tmpDir, { recursive: true });
    execSync(`tar xzf "${tmpTgz}" -C "${tmpDir}"`, { cwd: root });
    const srcFile = path.join(tmpDir, NODE_REL);
    await copyIfPe(srcFile, `electron-v${abiVersion}-win32-x64`);
  } catch (e) {
    console.error(`[fetch-sqlite-win] Failed: ${e.message}`);
    process.exit(1);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.unlink(tmpTgz).catch(() => {});
  }
}

await main();
