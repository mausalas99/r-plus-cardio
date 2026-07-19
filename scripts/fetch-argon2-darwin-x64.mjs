/**
 * Fetches the Intel macOS argon2 binary when building x64 DMGs from Apple Silicon.
 * npm optional deps only install @node-rs/argon2-darwin-arm64 on arm64 hosts; the x64
 * .node must be present for R+-x64.dmg (same pattern as fetch-argon2-win.mjs).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGON2_VERSION = '2.0.2';
const PACKAGE_NAME = '@node-rs/argon2-darwin-x64';
const TARBALL_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/-/${PACKAGE_NAME.split('/').pop()}-${ARGON2_VERSION}.tgz`;
const NODE_FILE = 'argon2.darwin-x64.node';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(root, 'node_modules', '@node-rs', 'argon2');
const destFile = path.join(destDir, NODE_FILE);
const optionalPkgFile = path.join(
  root,
  'node_modules',
  '@node-rs',
  'argon2-darwin-x64',
  NODE_FILE
);

if (process.platform !== 'darwin') {
  console.log('[fetch-argon2-darwin-x64] Not macOS, skipping.');
  process.exit(0);
}

if (process.arch === 'x64') {
  console.log('[fetch-argon2-darwin-x64] Host is x64; optional dependency should suffice.');
  process.exit(0);
}

try {
  await fs.access(destFile);
  console.log(`[fetch-argon2-darwin-x64] ${NODE_FILE} already in @node-rs/argon2, skipping.`);
  process.exit(0);
} catch {
  /* continue */
}

try {
  await fs.access(optionalPkgFile);
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(optionalPkgFile, destFile);
  console.log(`[fetch-argon2-darwin-x64] Linked ${NODE_FILE} from optional package.`);
  process.exit(0);
} catch {
  /* download */
}

console.log(`[fetch-argon2-darwin-x64] Downloading ${TARBALL_URL}...`);

try {
  const resp = await fetch(TARBALL_URL);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  const tmpTgz = path.join(root, 'scripts', '.argon2-darwin-x64.tgz');
  await fs.writeFile(tmpTgz, buffer);

  const { execSync } = await import('node:child_process');
  const tmpDir = path.join(root, 'scripts', '.argon2-darwin-x64-tmp');

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    execSync(`tar xzf "${tmpTgz}" -C "${tmpDir}"`, { cwd: root });
    const srcFile = path.join(tmpDir, 'package', NODE_FILE);
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(srcFile, destFile);
    console.log(`[fetch-argon2-darwin-x64] Copied ${NODE_FILE} to ${destDir}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.unlink(tmpTgz).catch(() => {});
  }
} catch (e) {
  console.error(`[fetch-argon2-darwin-x64] Failed: ${e.message}`);
  process.exit(1);
}
