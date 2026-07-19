#!/usr/bin/env node
/**
 * electron-builder beforePack: install Electron-ABI SQLCipher prebuild for the
 * target platform/arch about to be packaged. Avoids shipping Node-test ABI (127)
 * or the wrong arch when npmRebuild is disabled.
 *
 * @param {import('electron-builder').BeforePackContext} context
 */
const { spawnSync } = require('child_process');
const path = require('path');

/** @param {unknown} raw */
function normalizePackArch(raw) {
  const map = {
    0: 'ia32',
    1: 'x64',
    2: 'arm',
    3: 'arm64',
    ia32: 'ia32',
    x64: 'x64',
    arm: 'arm',
    arm64: 'arm64',
    armv7l: 'arm',
  };
  const key = String(raw ?? '').trim();
  return map[key] || key || process.arch;
}

exports.default = async function beforePack(context) {
  const root = path.join(__dirname, '..');
  const platform = String(context.electronPlatformName || process.platform).trim();
  const arch = normalizePackArch(context.arch);
  const label = `${platform}-${arch}`;
  console.log(`[beforePack] Ensuring SQLCipher Electron binary for ${label}`);

  const r = spawnSync(process.execPath, ['scripts/fetch-sqlite-electron.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      R_PLUS_SQLITE_PLATFORM: platform,
      R_PLUS_SQLITE_ARCH: arch,
      R_PLUS_STRICT_NATIVE: '1',
    },
  });
  if (r.status !== 0) {
    throw new Error(`fetch-sqlite-electron failed for ${label} (exit ${r.status ?? 1})`);
  }
};
