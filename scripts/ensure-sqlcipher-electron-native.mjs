#!/usr/bin/env node
/**
 * Ensures better_sqlite3.node matches Electron on the current host before packaging.
 * Mac: Mach-O + Electron probe. Windows: PE + Electron probe.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(rel) {
  const scriptPath = path.join(root, rel);
  console.log(`→ node ${rel}`);
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, R_PLUS_STRICT_NATIVE: '1' },
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

if (process.platform === 'darwin' || process.platform === 'win32') {
  runScript('scripts/fetch-sqlite-electron.mjs');
} else {
  console.log('[ensure-sqlcipher-electron] Non-desktop host — skip fetch (use rebuild:db-native)');
}
