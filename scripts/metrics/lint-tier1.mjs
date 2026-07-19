#!/usr/bin/env node
/**
 * Tier 1 ESLint gate — changed files vs main or full scan.
 *
 *   node scripts/metrics/lint-tier1.mjs           # changed vs main...HEAD + unstaged
 *   node scripts/metrics/lint-tier1.mjs --full    # entire Tier 1 tree
 *   node scripts/metrics/lint-tier1.mjs --staged  # staged only
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { filterTier1Paths, filterLintableTier1Paths, gitChangedFilesAgainst } from './changed-files.mjs';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const full = args.has('--full');
const staged = args.has('--staged');

function lintablePaths(paths) {
  return filterLintableTier1Paths(paths);
}

function gitLines(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectPaths() {
  if (full) return ['public/js', 'lib', 'lan-squad'];
  if (staged) return lintablePaths(filterTier1Paths(gitLines('git diff --cached --name-only')));
  const committed = filterTier1Paths(gitChangedFilesAgainst('main'));
  const unstaged = filterTier1Paths(gitLines('git diff --name-only HEAD'));
  const untracked = filterTier1Paths(gitLines('git ls-files --others --exclude-standard'));
  return lintablePaths(
    [...new Set([...committed, ...unstaged, ...untracked])].filter((p) => existsSync(p))
  );
}

const paths = collectPaths();
if (!paths.length) {
  console.log('lint-tier1: no Tier 1 paths to lint');
  process.exit(0);
}

const label = full ? 'full Tier 1' : staged ? 'staged' : 'changed';
console.log(`lint-tier1 (${label}): ${paths.length} path(s)`);

const result = spawnSync('npx', ['eslint', ...paths, '--max-warnings', '0'], {
  cwd: ROOT,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
