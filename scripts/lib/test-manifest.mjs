/**
 * Helpers for maintaining the explicit test-file manifest in package.json.
 *
 * - listedTestFiles(pkg)   → paths from pkg.scripts.test
 * - testFilesOnDisk(root)  → *.test.mjs / *.test.js paths on disk (repo-relative)
 *
 * Used by scripts/lib/test-manifest.test.mjs (the CI drift guard) and
 * can be imported by shard-splitter scripts in the future.
 *
 *   node scripts/lib/test-manifest.mjs   # prints missing / extra to stdout
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directories (by name) that are never walked for test files. */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.claude',
  '.worktrees',
  'dist',
  'build',
  'hallmark',
  'micode',
  'superpowers',
  'plugins',
  '.git',
  'python-runtime',
  'ui-ux-pro-max-skill',
]);

const TEST_SCRIPT_PREFIXES = [
  'node scripts/run-with-electron-node.mjs --test ',
  'node --test ',
];

/**
 * Parse the listed test files from package.json scripts.test.
 *
 * @param {object} pkg - Parsed package.json object
 * @returns {string[]}
 */
export function listedTestFiles(pkg) {
  const raw = pkg?.scripts?.test ?? '';
  const prefix = TEST_SCRIPT_PREFIXES.find((p) => raw.startsWith(p));
  if (!prefix) {
    throw new Error(
      'pkg.scripts.test must start with "node scripts/run-with-electron-node.mjs --test " (or legacy "node --test ")'
    );
  }
  return raw.slice(prefix.length).split(/\s+/).filter(Boolean);
}

/**
 * Walk the repo from rootDir and collect all *.test.mjs / *.test.js files,
 * skipping EXCLUDED_DIRS.  Returns repo-relative paths with "/" separators.
 *
 * @param {string} rootDir - Absolute path to repo root
 * @returns {string[]}
 */
export function testFilesOnDisk(rootDir) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (
        entry.name.endsWith('.test.mjs') ||
        entry.name.endsWith('.test.js')
      ) {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  walk(rootDir);
  return results;
}

/**
 * Paths that are intentionally excluded from the drift check.
 * Each entry must have an inline comment explaining why.
 *
 * Remove an entry here once the underlying issue is resolved and
 * the file is added back to scripts.test.
 */
export const QUARANTINED = [
];

// ---------------------------------------------------------------------------
// CLI helper (node scripts/lib/test-manifest.mjs)
// ---------------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  const listed = new Set(listedTestFiles(pkg));
  const onDisk = testFilesOnDisk(rootDir);
  const quarantined = new Set(QUARANTINED);

  const missing = onDisk.filter((f) => !listed.has(f) && !quarantined.has(f));
  const extra = [...listed].filter((f) => !onDisk.find((d) => d === f));

  console.log(`listed: ${listed.size}  on-disk: ${onDisk.length}  quarantined: ${quarantined.size}`);
  if (missing.length) {
    console.log(`\nMissing from scripts.test (${missing.length}):`);
    missing.forEach((f) => console.log(' ', f));
  }
  if (extra.length) {
    console.log(`\nIn scripts.test but not on disk (${extra.length}):`);
    extra.forEach((f) => console.log(' ', f));
  }
  if (!missing.length && !extra.length) {
    console.log('No drift detected.');
  }
}
