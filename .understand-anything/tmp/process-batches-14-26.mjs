#!/usr/bin/env node
/**
 * Process batches 14-26: extract-structure + semantic graph emission.
 * Import edges are emitted 1:1 from batchImportData.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const PROJECT_ROOT = '/Users/mauriciosalas/R+';
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || `${process.env.HOME}/.understand-anything-plugin`;
const SKILL_DIR = join(PLUGIN_ROOT, 'skills/understand');
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');
const BATCH_RANGE = [14, 26];

const batchesDoc = JSON.parse(readFileSync(join(INTER, 'batches.json'), 'utf8'));

function fileNodeType(file) {
  const { path, fileCategory, language } = file;
  if (fileCategory === 'config') return 'config';
  if (fileCategory === 'docs') return 'document';
  if (fileCategory === 'data') {
    if (language === 'sql') return 'table';
    if (['graphql', 'protobuf', 'prisma'].includes(language)) return 'schema';
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

function readSource(relPath) {
  const full = join(PROJECT_ROOT, relPath);
  if (!existsSync(full)) return '';
  try {
    return readFileSync(full, 'utf8');
  } catch {
    return '';
  }
}

function extractFileComment(src) {
  const block = src.match(/^\/\*\*([\s\S]*?)\*\//);
  if (block) {
    return block[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !l.startsWith('@'))
      .join(' ')
      .slice(0, 280);
  }
  const line = src.match(/^\/\/\s*(.+)/m);
  return line ? line[1].slice(0, 280) : '';
}

function extractFnComment(src, fnName, startLine) {
  const lines = src.split('\n');
  for (let i = Math.max(0, startLine - 4); i < startLine - 1; i++) {
    const chunk = lines.slice(Math.max(0, i - 6), startLine).join('\n');
    const m = chunk.match(/\/\*\*([\s\S]*?)\*\//);
    if (m) {
      return m[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .filter((l) => l && !l.startsWith('@'))
        .join(' ')
        .slice(0, 200);
    }
  }
  return '';
}

function domainHint(path) {
  if (path.includes('lan-squad/') || path.includes('lan-sync')) return 'LAN LiveSync';
  if (path.includes('historia-clinica')) return 'historia clínica (clinical history)';
  if (path.includes('clinico-access')) return 'clinical access scope evaluation';
  if (path.includes('clinical-teams')) return 'clinical team roster and guardia';
  if (path.includes('drive-import')) return 'Google Drive HC/labs import';
  if (path.includes('entrega')) return 'modo entrega handoff';
  if (path.includes('tour-')) return 'onboarding tour demo fixtures';
  if (path.includes('lib/db/')) return 'SQLCipher clinical database';
  if (path.includes('doc-export') || path.includes('doc-generators')) return 'clinical document export';
  if (path.startsWith('public/js/features/')) return 'renderer UI feature';
  if (path.includes('.test.')) return 'unit tests';
  return '';
}

function humanizeName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function tagsFor(file, result) {
  const tags = [];
  const base = basename(file.path);
  const p = file.path;
  if (/\.(test|spec)\./.test(p) || /_test\.(mjs|js)$/.test(base)) tags.push('test');
  if (base === 'main.js' || base === 'server.js' || base === 'app.js') tags.push('entry-point');
  if (file.fileCategory === 'docs') tags.push('documentation');
  if (file.fileCategory === 'config') tags.push('configuration');
  if (file.fileCategory === 'infra') tags.push('infrastructure');
  if (file.fileCategory === 'script') tags.push('build-system');
  if (p.includes('lan-squad/') || p.includes('lan-sync')) tags.push('lan-sync');
  if (p.includes('historia-clinica')) tags.push('historia-clinica');
  if (p.includes('clinico-access')) tags.push('clinical-access');
  if (p.includes('clinical-teams')) tags.push('clinical-teams');
  if (p.includes('drive-import')) tags.push('drive-import');
  if (p.startsWith('lib/')) tags.push('shared-logic');
  if (p.startsWith('public/js/features/')) tags.push('ui-feature');
  if ((result.exports?.length || 0) > 0) tags.push('exports');
  if ((result.functions?.length || 0) > 8) tags.push('utility');
  if (/Handler|Controller|Router/.test(base)) tags.push('api-handler');
  if (tags.length < 3) tags.push('module');
  return [...new Set(tags)].slice(0, 5);
}

function summaryForFile(file, result, src) {
  const comment = extractFileComment(src);
  if (comment) return comment.endsWith('.') ? comment : `${comment}.`;
  const domain = domainHint(file.path);
  const fn = result.functions?.length || 0;
  const exp = result.exports?.length || 0;
  const base = basename(file.path);
  if (/\.test\./.test(file.path)) {
    return `Tests for ${base.replace(/\.test\.(mjs|js)$/, '.$1')} covering ${domain || 'module behavior'}.`;
  }
  if (domain) {
    if (fn && exp) return `${domain} module exporting ${exp} symbol(s) with ${fn} helper(s) in ${base}.`;
    if (fn) return `${domain} helpers and wiring in ${base}.`;
    return `${domain} definitions in ${base}.`;
  }
  if (fn || exp) return `Shared ${file.language} module (${fn} functions, ${exp} exports) for the R+ workbench.`;
  return `${base} — ${file.fileCategory} file for the R+ Electron medical workbench.`;
}

function summaryForFn(fn, filePath, src, exported) {
  const comment = extractFnComment(src, fn.name, fn.startLine);
  if (comment) return comment.endsWith('.') ? comment : `${comment}.`;
  const domain = domainHint(filePath);
  const human = humanizeName(fn.name);
  if (fn.name.startsWith('test') || fn.name.startsWith('assert')) {
    return `Test helper ${fn.name} validating expected behavior.`;
  }
  if (exported) {
    return domain
      ? `Exported ${human} for ${domain}.`
      : `Exported ${human} used by other R+ modules.`;
  }
  return domain ? `${human} supporting ${domain}.` : `Internal ${human} in ${basename(filePath)}.`;
}

function shouldEmitFunction(fn, exports) {
  const lines = (fn.endLine || 0) - (fn.startLine || 0) + 1;
  const exported = exports.some((e) => e.name === fn.name);
  return exported || lines >= 10;
}

function shouldEmitClass(cls, exports) {
  const exported = exports.some((e) => e.name === cls.name);
  const methods = cls.methods?.length || 0;
  const lines = (cls.endLine || 0) - (cls.startLine || 0) + 1;
  return exported || methods >= 2 || lines >= 20;
}

function targetIdForPath(targetPath, allFiles) {
  const meta = allFiles.find((f) => f.path === targetPath) || {
    path: targetPath, fileCategory: 'code', language: 'javascript',
  };
  const tType = fileNodeType(meta);
  return `${nodePrefix(tType)}:${targetPath}`;
}

function processBatch(batch) {
  const idx = batch.batchIndex;
  const inputPath = join(TMP, `ua-file-analyzer-input-${idx}.json`);
  const extractPath = join(TMP, `ua-file-extract-results-${idx}.json`);

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
    throw new Error(`batch ${idx} extract failed: ${run.stderr?.slice(-800)}`);
  }
  if (!existsSync(extractPath) || !readFileSync(extractPath, 'utf8').trim()) {
    throw new Error(`batch ${idx} extract output missing or empty`);
  }

  const extracted = JSON.parse(readFileSync(extractPath, 'utf8'));
  const nodes = [];
  const edges = [];
  const srcCache = new Map();

  for (const result of extracted.results || []) {
    const fileMeta = batch.files.find((f) => f.path === result.path) || {
      path: result.path, language: result.language, fileCategory: result.fileCategory,
    };
    if (!srcCache.has(result.path)) srcCache.set(result.path, readSource(result.path));
    const src = srcCache.get(result.path);

    const nType = fileNodeType(fileMeta);
    const fileId = `${nodePrefix(nType)}:${result.path}`;

    nodes.push({
      id: fileId,
      type: nType,
      name: basename(result.path),
      filePath: result.path,
      summary: summaryForFile(fileMeta, result, src),
      tags: tagsFor(fileMeta, result),
      complexity: complexity(result.nonEmptyLines || 0),
    });

    const imports = batch.batchImportData?.[result.path] || [];
    for (const target of imports) {
      edges.push({
        source: fileId,
        target: targetIdForPath(target, batch.files),
        type: 'imports',
        direction: 'forward',
        weight: 0.7,
      });
    }

    const exports = result.exports || [];
    for (const fn of result.functions || []) {
      if (!shouldEmitFunction(fn, exports)) continue;
      const fnId = `function:${result.path}:${fn.name}`;
      const exported = exports.some((e) => e.name === fn.name);
      nodes.push({
        id: fnId,
        type: 'function',
        name: fn.name,
        filePath: result.path,
        lineRange: [fn.startLine, fn.endLine],
        summary: summaryForFn(fn, result.path, src, exported),
        tags: exported ? ['exports', 'function'] : ['function'],
        complexity: complexity((fn.endLine || 0) - (fn.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: fnId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exported) {
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
        summary: `Class ${cls.name} encapsulating ${domainHint(result.path) || 'module'} behavior.`,
        tags: ['class'],
        complexity: complexity((cls.endLine || 0) - (cls.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some((e) => e.name === cls.name)) {
        edges.push({ source: fileId, target: clsId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }

    if (/\.test\./.test(result.path)) {
      for (const target of imports) {
        if (/\.test\./.test(target)) continue;
        edges.push({
          source: targetIdForPath(target, batch.files),
          target: fileId,
          type: 'tested_by',
          direction: 'forward',
          weight: 0.5,
        });
      }
    }
  }

  for (const skipped of extracted.filesSkipped || []) {
    const fileMeta = batch.files.find((f) => f.path === skipped) || {
      path: skipped, language: 'unknown', fileCategory: 'code',
    };
    const nType = fileNodeType(fileMeta);
    nodes.push({
      id: `${nodePrefix(nType)}:${skipped}`,
      type: nType,
      name: basename(skipped),
      filePath: skipped,
      summary: `Skipped by structural extractor; placeholder node for ${basename(skipped)}.`,
      tags: tagsFor(fileMeta, {}),
      complexity: 'simple',
    });
  }

  const expectedImports = Object.values(batch.batchImportData || {}).reduce((s, a) => s + (a?.length || 0), 0);
  const actualImports = edges.filter((e) => e.type === 'imports').length;
  if (expectedImports !== actualImports) {
    throw new Error(`batch ${idx} import mismatch: expected ${expectedImports}, got ${actualImports}`);
  }

  const outPath = join(INTER, `batch-${idx}.json`);
  writeFileSync(outPath, JSON.stringify({ nodes, edges }, null, 2));
  return { batchIndex: idx, nodes: nodes.length, edges: edges.length, imports: actualImports };
}

const results = [];
const errors = [];

for (let i = BATCH_RANGE[0]; i <= BATCH_RANGE[1]; i++) {
  const batch = batchesDoc.batches.find((b) => b.batchIndex === i);
  if (!batch) {
    errors.push(`batch ${i} not found in batches.json`);
    continue;
  }
  try {
    results.push(processBatch(batch));
  } catch (err) {
    errors.push(String(err.message || err));
  }
}

const totals = results.reduce(
  (acc, r) => ({ nodes: acc.nodes + r.nodes, edges: acc.edges + r.edges }),
  { nodes: 0, edges: 0 },
);

console.log(JSON.stringify({
  status: errors.length ? 'partial' : 'ok',
  batchesCompleted: results.length,
  nodesTotal: totals.nodes,
  edgesTotal: totals.edges,
  errors,
  batches: results,
}));
