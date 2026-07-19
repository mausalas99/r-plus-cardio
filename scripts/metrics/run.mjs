#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { collectBootStaticImports, hashBootGraph, bootGraphDebtDelta } from './boot-graph.mjs';
import {
  computeTotalScore,
  eslintDebtFromResults,
  duplicationDebtFromJscpd,
} from './score.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = path.join(ROOT, 'scripts/metrics/report.json');
const BASELINE = path.join(ROOT, 'scripts/metrics/baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');

function runEslintJson() {
  try {
    const raw = execSync(
      'npx eslint public/js lib lan-squad --format json --max-warnings 99999',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    return JSON.parse(raw);
  } catch (err) {
    const stdout = err.stdout?.toString?.() || '';
    if (stdout.trim().startsWith('[')) {
      try {
        return JSON.parse(stdout);
      } catch {
        return [];
      }
    }
    return [];
  }
}

function runJscpdJson() {
  const outDir = path.join(ROOT, 'scripts/metrics/.jscpd-tmp');
  fs.mkdirSync(outDir, { recursive: true });
  try {
    execSync(
      [
        'npx jscpd public/js lib',
        '--min-lines 8',
        '--min-tokens 60',
        '--reporters json',
        `--output ${outDir}`,
        '--ignore',
        '**/public/js/chunks/**,**/public/js/app.bundle.*',
      ].join(' '),
      { cwd: ROOT, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
    );
  } catch {
    // jscpd exits non-zero when clones found
  }
  const reportPath = path.join(outDir, 'jscpd-report.json');
  if (!fs.existsSync(reportPath)) {
    return { statistics: { total: { tokens: 0 } } };
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function runDependencyCruiser() {
  const configPath = path.join(ROOT, '.dependency-cruiser.cjs');
  if (!fs.existsSync(configPath)) return 0;
  const outPath = path.join(ROOT, 'scripts/metrics/.depcruise.json');
  try {
    execSync(
      `npx depcruise public/js lib lan-squad --config .dependency-cruiser.cjs -T json -o scripts/metrics/.depcruise.json`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const errors = (raw.summary?.error || 0) + (raw.summary?.warn || 0);
    return errors * 50;
  } catch {
    return 0;
  }
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
}

function main() {
  const eslintResults = runEslintJson();
  const eslintDebt = eslintDebtFromResults(eslintResults);
  const jscpd = runJscpdJson();
  const duplicationDebt = duplicationDebtFromJscpd(jscpd);
  const importSmellDebt = runDependencyCruiser();
  const bootImports = collectBootStaticImports(ROOT);
  const bootGraphHash = hashBootGraph(bootImports);
  const baseline = loadBaseline();
  const bootGraphDebt = baseline?.bootGraph?.imports
    ? bootGraphDebtDelta(bootImports, baseline.bootGraph.imports)
    : 0;

  const parts = {
    ...eslintDebt,
    duplicationDebt,
    importSmellDebt,
    bootGraphDebt,
  };
  const totalScore = computeTotalScore(parts);

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalScore,
    parts,
    bootGraph: { hash: bootGraphHash, imports: bootImports },
    eslint: { errorCount: eslintResults.reduce((n, f) => n + (f.errorCount || 0), 0) },
    jscpd: { duplicatedTokens: jscpd.statistics?.total?.tokens || 0 },
  };

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log('wrote', REPORT, 'totalScore=', totalScore);

  if (writeBaseline) {
    const next = {
      version: 1,
      updatedAt: report.generatedAt,
      totalScore,
      bootGraphHash: bootGraphHash,
      bootGraph: report.bootGraph,
      byFile: {},
      changelog: [
        ...(baseline?.changelog || []).slice(-19),
        { date: report.generatedAt.slice(0, 10), note: `Baseline refresh totalScore=${totalScore}` },
      ],
    };
    fs.writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
    console.log('wrote', BASELINE);
  }
}

main();
