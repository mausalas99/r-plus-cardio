#!/usr/bin/env node
/**
 * Coloca todos los .node de argon2 en node_modules/@node-rs/argon2/ para asarUnpack y verify.
 * - arm64: copia desde @node-rs/argon2-darwin-arm64 (npm no siempre deja el archivo en argon2/)
 * - x64 Mac: fetch-argon2-darwin-x64.mjs
 * - win x64: fetch-argon2-win.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(root, 'node_modules', '@node-rs', 'argon2');
const ARM64_NODE = 'argon2.darwin-arm64.node';

async function linkDarwinArm64() {
  const destFile = path.join(destDir, ARM64_NODE);
  try {
    await fs.access(destFile);
    console.log(`[ensure-argon2] ${ARM64_NODE} already in @node-rs/argon2`);
    return;
  } catch {
    /* copy */
  }
  const optionalFile = path.join(
    root,
    'node_modules',
    '@node-rs',
    'argon2-darwin-arm64',
    ARM64_NODE
  );
  try {
    await fs.access(optionalFile);
  } catch {
    console.error(
      '[ensure-argon2] Falta @node-rs/argon2-darwin-arm64. Ejecuta: npm install'
    );
    process.exit(1);
  }
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(optionalFile, destFile);
  console.log(`[ensure-argon2] Copied ${ARM64_NODE} → @node-rs/argon2/`);
}

function runScript(name) {
  const scriptPath = path.join(root, 'scripts', name);
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

await linkDarwinArm64();

if (process.platform === 'darwin') {
  runScript('fetch-argon2-darwin-x64.mjs');
} else {
  console.log('[ensure-argon2] Not macOS — skip fetch-argon2-darwin-x64');
}

runScript('fetch-argon2-win.mjs');

console.log('[ensure-argon2] Pack natives listos en @node-rs/argon2/');
