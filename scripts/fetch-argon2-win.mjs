/**
 * Fetches the Windows-native argon2 binary for cross-platform builds from macOS.
 * The @node-rs/argon2-win32-x64-msvc package cannot be installed on macOS due to
 * OS/cpu restrictions, but its .node binary must be present in the Windows build.
 *
 * Places argon2.win32-x64-msvc.node into node_modules/@node-rs/argon2/ so that
 * the require('./argon2.win32-x64-msvc.node') call in @node-rs/argon2/index.js
 * can find it at runtime.
 */
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGON2_VERSION = '2.0.2';
const PACKAGE_NAME = '@node-rs/argon2-win32-x64-msvc';
const TARBALL_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/-/${PACKAGE_NAME.split('/').pop()}-${ARGON2_VERSION}.tgz`;
const NODE_FILE = 'argon2.win32-x64-msvc.node';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(root, 'node_modules', '@node-rs', 'argon2');
const destFile = path.join(destDir, NODE_FILE);

// Check if already present
try {
  await fs.access(destFile);
  console.log(`[fetch-argon2-win] ${NODE_FILE} already present, skipping download`);
  process.exit(0);
} catch {
  // Not present, continue
}

console.log(`[fetch-argon2-win] Downloading ${TARBALL_URL}...`);

try {
  const resp = await fetch(TARBALL_URL);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Write tarball to temp file
  const tmpTgz = path.join(root, 'scripts', '.argon2-win.tgz');
  await fs.writeFile(tmpTgz, buffer);

  // Extract using tar
  const { execSync } = await import('node:child_process');
  const tmpDir = path.join(root, 'scripts', '.argon2-win-tmp');

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    execSync(`tar xzf "${tmpTgz}" -C "${tmpDir}"`, { cwd: root });

    // The tarball contains a "package/" directory with the .node file
    const packageDir = path.join(tmpDir, 'package');
    const srcFile = path.join(packageDir, NODE_FILE);

    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(srcFile, destFile);
    console.log(`[fetch-argon2-win] Copied ${NODE_FILE} to ${destDir}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.unlink(tmpTgz).catch(() => {});
  }
} catch (e) {
  console.error(`[fetch-argon2-win] Failed: ${e.message}`);
  process.exit(1);
}
