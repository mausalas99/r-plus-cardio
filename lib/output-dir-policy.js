'use strict';

const fs = require('fs');
const path = require('path');

const APPROVED_OUTPUT_FILE = 'approved-output-dir.json';

function readApprovedOutputDir(userDataPath) {
  if (!userDataPath) return null;
  try {
    const filePath = path.join(userDataPath, APPROVED_OUTPUT_FILE);
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const dir = parsed && parsed.path ? String(parsed.path).trim() : '';
    return dir ? path.resolve(dir) : null;
  } catch {
    return null;
  }
}

function writeApprovedOutputDir(userDataPath, dir) {
  if (!userDataPath) return;
  const resolved = path.resolve(String(dir || '').trim());
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(
    path.join(userDataPath, APPROVED_OUTPUT_FILE),
    JSON.stringify({ path: resolved, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

function isPathInsideRoot(rootDir, targetDir) {
  const rel = path.relative(rootDir, targetDir);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolves a server-side export directory to an allowed, writable path.
 * @param {string} requestedDir
 * @param {{ userDataPath: string, downloadsPath: string }} opts
 */
function resolveAllowedOutputDir(requestedDir, opts) {
  const userDataPath = path.resolve(String(opts.userDataPath || ''));
  const downloadsPath = path.resolve(String(opts.downloadsPath || ''));
  const exportsRoot = path.join(userDataPath, 'exports');
  fs.mkdirSync(exportsRoot, { recursive: true });

  const approved = readApprovedOutputDir(userDataPath);
  const trimmed = String(requestedDir || '').trim();
  let target = trimmed ? path.resolve(trimmed) : approved || downloadsPath;

  const allowedRoots = [downloadsPath, exportsRoot];
  if (approved) allowedRoots.unshift(approved);

  let allowed = false;
  let resolvedTarget = target;
  for (const root of allowedRoots) {
    try {
      const realRoot = fs.realpathSync(root);
      if (!fs.existsSync(resolvedTarget)) {
        fs.mkdirSync(resolvedTarget, { recursive: true });
      }
      const realTarget = fs.realpathSync(resolvedTarget);
      if (isPathInsideRoot(realRoot, realTarget)) {
        allowed = true;
        resolvedTarget = realTarget;
        break;
      }
    } catch {
      /* try next root */
    }
  }

  if (!allowed) {
    const err = new Error('OUTPUT_DIR_NOT_ALLOWED');
    err.code = 'OUTPUT_DIR_NOT_ALLOWED';
    throw err;
  }

  try {
    fs.accessSync(resolvedTarget, fs.constants.W_OK);
  } catch {
    const err = new Error('OUTPUT_DIR_NOT_WRITABLE');
    err.code = 'OUTPUT_DIR_NOT_WRITABLE';
    throw err;
  }

  return resolvedTarget;
}

module.exports = {
  APPROVED_OUTPUT_FILE,
  readApprovedOutputDir,
  writeApprovedOutputDir,
  resolveAllowedOutputDir,
  isPathInsideRoot,
};
