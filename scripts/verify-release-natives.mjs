#!/usr/bin/env node
/**
 * Verifica que los .node de argon2 y sqlcipher existan y tengan el formato correcto antes de publicar.
 * Uso: node scripts/verify-release-natives.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describeNativeBinary } from './lib/native-binary-format.mjs';
import { electronProbeEnv } from './lib/sqlcipher-native.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const ARGON2_NODES = [
  'node_modules/@node-rs/argon2/argon2.darwin-arm64.node',
  'node_modules/@node-rs/argon2/argon2.darwin-x64.node',
  'node_modules/@node-rs/argon2/argon2.win32-x64-msvc.node',
];

const SQLCIPHER_REL =
  'node_modules/better-sqlite3-multiple-ciphers/build/Release/better_sqlite3.node';

function checkFile(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    return { rel, ok: false, reason: 'missing' };
  }
  const st = fs.statSync(abs);
  if (st.size < 1000) {
    return { rel, ok: false, reason: 'too small' };
  }
  return { rel, ok: true };
}

function ensurePackNatives() {
  const script = path.join(root, 'scripts', 'ensure-argon2-pack-natives.mjs');
  console.log('→ node scripts/ensure-argon2-pack-natives.mjs');
  const r = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

function probeSqlcipherElectron() {
  const probeScript = path.join(root, 'scripts', 'electron-sqlcipher-probe.cjs');
  const r = spawnSync('npx', ['electron', probeScript], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 60_000,
    env: electronProbeEnv(),
  });
  if (r.status === 0) return { ok: true };
  const err = (r.stderr || r.stdout || '').trim();
  return { ok: false, message: err || `electron probe exit ${r.status}` };
}

function main() {
  ensurePackNatives();
  const missing = [];
  for (const rel of ARGON2_NODES) {
    const r = checkFile(rel);
    if (!r.ok) missing.push(r);
  }
  const sql = checkFile(SQLCIPHER_REL);
  if (!sql.ok) missing.push(sql);

  const sqlAbs = path.join(root, SQLCIPHER_REL);
  if (process.platform === 'darwin') {
    const fmt = describeNativeBinary(sqlAbs, 'darwin');
    if (!fmt.ok) {
      console.error(
        `verify-release-natives: ${SQLCIPHER_REL} has wrong format (${fmt.format}: ${fmt.reason}).`,
        'Run: node scripts/fetch-sqlite-electron.mjs && npm run rebuild:db-native'
      );
      process.exit(1);
    }
  }

  const electronProbe = probeSqlcipherElectron();
  if (!electronProbe.ok) {
    console.error('verify-release-natives: Electron sqlcipher probe failed:', electronProbe.message);
    console.error('Run: node scripts/ensure-sqlcipher-electron-native.mjs');
    process.exit(1);
  }

  let argon2Ok = true;
  try {
    const { probeNativeRuntime } = require('../lib/native-runtime-probe.js');
    const probe = probeNativeRuntime();
    if (!probe.argon2.ok) {
      argon2Ok = false;
      console.error('probeNativeRuntime argon2 failed:', JSON.stringify(probe.failures, null, 2));
    }
  } catch (e) {
    argon2Ok = false;
    console.error('probeNativeRuntime threw:', e.message);
  }

  if (missing.length) {
    console.error('verify-release-natives: archivos .node faltantes o inválidos:');
    for (const m of missing) {
      console.error(`  - ${m.rel} (${m.reason})`);
    }
    console.error('\nEjecuta: node scripts/ensure-argon2-pack-natives.mjs');
    console.error('Luego: node scripts/ensure-sqlcipher-electron-native.mjs');
    process.exit(1);
  }

  if (!argon2Ok) {
    process.exit(1);
  }

  console.log(
    'verify-release-natives: OK (argon2 arm64/x64/win + sqlcipher Mach-O/Electron + argon2 runtime)'
  );
}

main();
