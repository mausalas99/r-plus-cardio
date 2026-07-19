#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { filterLintableTier1Paths, gitChangedFilesAgainst } from './changed-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = path.join(ROOT, 'scripts/metrics/report.json');
const BASELINE = path.join(ROOT, 'scripts/metrics/baseline.json');

execSync('node scripts/metrics/run.mjs', { cwd: ROOT, stdio: 'inherit' });

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

let failed = false;

if (baseline.totalScore == null) {
  console.error('baseline.json has no totalScore — run: npm run metrics:baseline');
  failed = true;
} else if (report.totalScore > baseline.totalScore + 1) {
  console.error(
    `DEBT REGRESSION: report ${report.totalScore} > baseline ${baseline.totalScore}`
  );
  failed = true;
}

const changed = filterLintableTier1Paths(gitChangedFilesAgainst('main'));
if (changed.length) {
  try {
    execSync(`npx eslint ${changed.map((p) => JSON.stringify(p)).join(' ')} --max-warnings 0`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch {
    console.error('eslint failed on changed Tier 1 files');
    failed = true;
  }
} else {
  console.log('metrics:check — no Tier 1 changed files vs main, skipping ratchet eslint');
}

if (failed) process.exit(1);
console.log('metrics:check OK');
