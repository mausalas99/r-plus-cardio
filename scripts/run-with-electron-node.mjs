#!/usr/bin/env node
/**
 * Run Node CLI (e.g. --test) under Electron's embedded Node so native addons
 * built for Electron (SQLCipher) load without a Node/Electron binary swap.
 *
 * System Node and Electron ship different ABIs even at the same semver:
 *   node --test  → NODE_MODULE_VERSION for `node`
 *   npm start    → NODE_MODULE_VERSION for `electron`
 * One better_sqlite3.node cannot serve both; this wrapper uses one runtime.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronPath = require('electron');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-with-electron-node.mjs --test <files…>');
  process.exit(1);
}

// LAN characterization suites may leave fetch/WebSocket handles open; don't block CI/release.
if (args.includes('--test') && !args.includes('--test-force-exit')) {
  const testIdx = args.indexOf('--test');
  args.splice(testIdx + 1, 0, '--test-force-exit');
}

const r = spawnSync(electronPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  // Avoid macOS spawnSync occasionally waiting on orphaned stdio pipes from Electron's test runner.
  detached: false,
  windowsHide: true,
});

if (r.error) {
  console.error(r.error.message || r.error);
  process.exit(1);
}

process.exit(r.status === null ? 1 : r.status);
