#!/usr/bin/env node
/**
 * electron-builder afterPack: restore host-arch SQLCipher .node after cross-arch
 * beforePack (e.g. x64 pack on Apple Silicon). Keeps npm test / dev on host arch.
 */
const { spawnSync } = require('child_process');
const path = require('path');

/** @param {import('electron-builder').AfterPackContext} _context */
exports.default = async function afterPack(_context) {
  const root = path.join(__dirname, '..');
  console.log('[afterPack] Restoring host-arch SQLCipher binary for dev/tests');
  const r = spawnSync(process.execPath, ['scripts/rebuild-native-db.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.warn('[afterPack] rebuild-native-db returned non-zero (non-fatal for pack artifact)');
  }
};
