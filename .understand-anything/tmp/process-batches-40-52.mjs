#!/usr/bin/env node
/**
 * Process Understand Anything batches 40-52: extract-structure → batch JSON.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const PROJECT_ROOT = '/Users/mauriciosalas/R+';
const PLUGIN_ROOT = '/Users/mauriciosalas/.understand-anything-plugin';
const SKILL_DIR = join(PLUGIN_ROOT, 'skills/understand');
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');
const BATCH_INDICES = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52];

const batchesAll = JSON.parse(readFileSync(join(INTER, 'batches.json'), 'utf8'));
const batchByIndex = new Map(batchesAll.batches.map(b => [b.batchIndex, b]));

function fileNodeType(file) {
  const { path, fileCategory, language } = file;
  if (fileCategory === 'config') return 'config';
  if (fileCategory === 'docs') return 'document';
  if (fileCategory === 'data') {
    if (language === 'sql') return 'table';
    return 'schema';
  }
  if (fileCategory === 'infra') {
    if (/\.github\/workflows|\.gitlab-ci|Jenkinsfile|\.circleci/.test(path)) return 'pipeline';
    if (/\.tf$|\.tfvars$|Vagrantfile|cloudformation/i.test(path)) return 'resource';
    return 'service';
  }
  return 'file';
}

function nodePrefix(type) {
  const map = {
    file: 'file', config: 'config', document: 'document', service: 'service',
    pipeline: 'pipeline', resource: 'resource', table: 'table', schema: 'schema', endpoint: 'endpoint',
  };
  return map[type] || 'file';
}

function complexity(nonEmpty) {
  if (nonEmpty < 50) return 'simple';
  if (nonEmpty <= 200) return 'moderate';
  return 'complex';
}

function firstHeading(result) {
  const h = (result.sections || []).find(s => s.level === 1);
  return h?.heading?.replace(/^#+\s*/, '').trim() || null;
}

function tagsFor(file, result) {
  const tags = new Set();
  const p = file.path;
  const base = basename(p);

  if (file.fileCategory === 'docs') tags.add('documentation');
  if (file.fileCategory === 'config') tags.add('configuration');
  if (/RELEASE_NOTES/.test(base)) {
    tags.add('release-notes');
    tags.add('changelog');
  }
  if (p.includes('/core/')) tags.add('architecture');
  if (p.includes('/superpowers/specs/')) tags.add('specification');
  if (p.includes('/superpowers/plans/')) tags.add('implementation-plan');
  if (/demo-patients/.test(p)) tags.add('demo-data');
  if (/lan|livesync|sync/i.test(p)) tags.add('lan-sync');
  if (/clinical|clinico|guardia|teams|hc|historia/i.test(p)) tags.add('clinical');
  if (/security|sqlcipher|encryption/i.test(p)) tags.add('security');
  if (/test|testing/i.test(p)) tags.add('testing');
  if (/design-system|ui|ux/i.test(p)) tags.add('design');
  if (/\.(test|spec)\./.test(p)) tags.add('test');
  if ((result.exports?.length || 0) > 0) tags.add('exports');
  if ((result.functions?.length || 0) > 3) tags.add('utility');
  if (base === 'README.md') tags.add('overview');

  if (tags.size < 3) tags.add('reference');
  return [...tags].slice(0, 5);
}

function summaryFor(file, result) {
  const heading = firstHeading(result);
  const lines = result.nonEmptyLines || 0;
  const base = basename(file.path);
  const nType = fileNodeType(file);

  if (/RELEASE_NOTES_([\d.]+)/.test(base)) {
    const ver = base.match(/RELEASE_NOTES_([\d.]+)/)[1];
    return `Release notes for R+ v${ver} listing user-visible changes, fixes, and shipped features for that version.`;
  }
  if (file.path === 'docs/db-encryption.md') {
    return 'Documents SQLCipher database encryption setup, key derivation, and operational guidance for clinical data at rest.';
  }
  if (file.path === 'docs/vision-north-star.md') {
    return 'Short pointer to the canonical product vision and north-star strategy document in docs/core/.';
  }
  if (file.path === 'docs/presentacion-r-plus-gemini-slides.md') {
    return 'Slide deck outline presenting R+ product value, workflows, and demo narrative for external audiences.';
  }
  if (file.path === 'docs/demo-patients/README.md') {
    return 'Explains demo patient JSON bundles used for pitches, onboarding tours, and local testing without real PHI.';
  }
  if (nType === 'config' && file.path.includes('demo-patients')) {
    return `Synthetic demo patient census bundle (${lines} non-empty lines) for presentations and tour scenarios.`;
  }
  if (nType === 'document' && heading) {
    const kind = file.path.includes('/plans/') ? 'Implementation plan'
      : file.path.includes('/specs/') ? 'Design specification'
        : file.path.includes('/core/') ? 'Core architecture document'
          : 'Documentation';
    return `${kind}: ${heading}.`;
  }
  if (nType === 'document') {
    return `Documentation file (${lines} non-empty lines) in ${basename(file.path)}.`;
  }
  if (nType === 'config') {
    return `Configuration file ${base} (${lines} non-empty lines).`;
  }
  const fn = result.functions?.length || 0;
  const cls = result.classes?.length || 0;
  if (fn || cls) {
    return `${base} — ${fn} function(s), ${cls} class(es), ${result.metrics?.importCount || 0} internal import(s).`;
  }
  return `${base} (${file.language}, ${lines} non-empty lines).`;
}

function shouldEmitFunction(fn, exports) {
  const lines = (fn.endLine || 0) - (fn.startLine || 0) + 1;
  const exported = exports.some(e => e.name === fn.name);
  return exported || lines >= 10;
}

function shouldEmitClass(cls, exports) {
  const exported = exports.some(e => e.name === cls.name);
  const methods = cls.methods?.length || 0;
  const lines = (cls.endLine || 0) - (cls.startLine || 0) + 1;
  return exported || methods >= 2 || lines >= 20;
}

const status = { batches: [], totalNodes: 0, totalEdges: 0, importEdgeCheck: 'pass' };

for (const idx of BATCH_INDICES) {
  const batch = batchByIndex.get(idx);
  if (!batch) {
    status.batches.push({ batchIndex: idx, error: 'not found in batches.json' });
    continue;
  }

  const inputPath = join(TMP, `ua-file-analyzer-input-${idx}.json`);
  const extractPath = join(TMP, `ua-file-extract-results-${idx}.json`);
  const outPath = join(INTER, `batch-${idx}.json`);

  writeFileSync(inputPath, JSON.stringify({
    projectRoot: PROJECT_ROOT,
    batchFiles: batch.files,
    batchImportData: batch.batchImportData || {},
  }));

  const run = spawnSync('node', [join(SKILL_DIR, 'extract-structure.mjs'), inputPath, extractPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    status.batches.push({ batchIndex: idx, error: run.stderr?.slice(-300) || 'extract failed' });
    continue;
  }

  const extracted = JSON.parse(readFileSync(extractPath, 'utf8'));
  const nodes = [];
  const edges = [];
  let expectedImports = 0;
  let actualImports = 0;

  for (const result of extracted.results || []) {
    const fileMeta = batch.files.find(f => f.path === result.path) || {
      path: result.path, language: result.language, fileCategory: result.fileCategory,
    };
    const nType = fileNodeType(fileMeta);
    const prefix = nodePrefix(nType);
    const fileId = `${prefix}:${result.path}`;

    nodes.push({
      id: fileId,
      type: nType,
      name: basename(result.path),
      filePath: result.path,
      summary: summaryFor(fileMeta, result),
      tags: tagsFor(fileMeta, result),
      complexity: complexity(result.nonEmptyLines || 0),
    });

    const imports = batch.batchImportData?.[result.path] || [];
    expectedImports += imports.length;
    for (const target of imports) {
      actualImports++;
      const targetFile = batch.files.find(f => f.path === target);
      const tType = fileNodeType(targetFile || { path: target, fileCategory: 'code' });
      const tPrefix = nodePrefix(tType);
      edges.push({
        source: fileId,
        target: `${tPrefix}:${target}`,
        type: 'imports',
        direction: 'forward',
        weight: 0.7,
      });
    }

    const exports = result.exports || [];
    for (const fn of result.functions || []) {
      if (!shouldEmitFunction(fn, exports)) continue;
      const fnId = `function:${result.path}:${fn.name}`;
      nodes.push({
        id: fnId,
        type: 'function',
        name: fn.name,
        filePath: result.path,
        lineRange: [fn.startLine, fn.endLine],
        summary: `Function ${fn.name} in ${basename(result.path)}.`,
        tags: ['function', 'module'],
        complexity: complexity((fn.endLine || 0) - (fn.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: fnId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some(e => e.name === fn.name)) {
        edges.push({ source: fileId, target: fnId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }

    for (const cls of result.classes || []) {
      if (!shouldEmitClass(cls, exports)) continue;
      const clsId = `class:${result.path}:${cls.name}`;
      nodes.push({
        id: clsId,
        type: 'class',
        name: cls.name,
        filePath: result.path,
        lineRange: [cls.startLine, cls.endLine],
        summary: `Class ${cls.name} in ${basename(result.path)}.`,
        tags: ['class', 'module'],
        complexity: complexity((cls.endLine || 0) - (cls.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some(e => e.name === cls.name)) {
        edges.push({ source: fileId, target: clsId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }
  }

  writeFileSync(outPath, JSON.stringify({ nodes, edges }, null, 2));

  const importOk = expectedImports === actualImports;
  if (!importOk) status.importEdgeCheck = 'fail';

  status.batches.push({
    batchIndex: idx,
    files: batch.files.length,
    nodes: nodes.length,
    edges: edges.length,
    importsExpected: expectedImports,
    importsEmitted: actualImports,
    filesSkipped: extracted.filesSkipped?.length || 0,
    ok: importOk,
  });
  status.totalNodes += nodes.length;
  status.totalEdges += edges.length;
}

console.log(JSON.stringify(status, null, 2));
