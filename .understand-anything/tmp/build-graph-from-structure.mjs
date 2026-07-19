#!/usr/bin/env node
/**
 * Deterministic batch graph builder: extract-structure → batch-*.json → merge.
 * Produces a structural knowledge graph (summaries are heuristic, not LLM).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const PROJECT_ROOT = process.argv[2] || process.cwd();
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || `${process.env.HOME}/.understand-anything-plugin`;
const SKILL_DIR = join(PLUGIN_ROOT, 'skills/understand');
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');

const scan = JSON.parse(readFileSync(join(INTER, 'scan-result.json'), 'utf8'));
const batches = JSON.parse(readFileSync(join(INTER, 'batches.json'), 'utf8'));

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

function tagsFor(file, result) {
  const tags = [];
  const base = basename(file.path);
  if (/\.(test|spec)\./.test(file.path) || /^test_/.test(base) || /_test\.(mjs|js)$/.test(base)) tags.push('test');
  if (base === 'main.js' || base === 'server.js' || base === 'app.js' || base === 'index.mjs') tags.push('entry-point');
  if (file.fileCategory === 'docs') tags.push('documentation');
  if (file.fileCategory === 'config') tags.push('configuration');
  if (file.fileCategory === 'infra') tags.push('infrastructure');
  if (file.fileCategory === 'script') tags.push('build-system');
  if ((result.functions?.length || 0) > 5) tags.push('utility');
  if ((result.exports?.length || 0) > 0) tags.push('exports');
  if (tags.length === 0) tags.push('module');
  return [...new Set(tags)].slice(0, 5);
}

function summaryFor(file, result) {
  const type = fileNodeType(file);
  const fn = result.functions?.length || 0;
  const cls = result.classes?.length || 0;
  const imp = result.metrics?.importCount || 0;
  if (type === 'document') return `Documentation file (${result.nonEmptyLines || 0} non-empty lines).`;
  if (type === 'config') return `Configuration for ${basename(file.path)} (${imp} imports referenced).`;
  if (type === 'pipeline') return `CI/CD pipeline definition (${result.steps?.length || 0} steps detected).`;
  if (type === 'service') return `Infrastructure/service definition for deployment or runtime.`;
  if (fn || cls) return `${basename(file.path)} — ${fn} function(s), ${cls} class(es), ${imp} internal import(s).`;
  return `${basename(file.path)} (${file.language}, ${result.nonEmptyLines || 0} lines).`;
}

function shouldEmitFunction(fn, exports, filePath) {
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

for (const batch of batches.batches) {
  const idx = batch.batchIndex;
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
    console.error(`batch ${idx} extract failed:`, run.stderr?.slice(-500));
    process.exit(1);
  }

  const extracted = JSON.parse(readFileSync(extractPath, 'utf8'));
  const nodes = [];
  const edges = [];

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
    for (const target of imports) {
      const targetFile = batch.files.find(f => f.path === target) || { fileCategory: 'code' };
      const tType = fileNodeType({ ...targetFile, path: target });
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
      if (!shouldEmitFunction(fn, exports, result.path)) continue;
      const fnId = `function:${result.path}:${fn.name}`;
      nodes.push({
        id: fnId,
        type: 'function',
        name: fn.name,
        filePath: result.path,
        lineRange: [fn.startLine, fn.endLine],
        summary: `Function ${fn.name} in ${basename(result.path)}.`,
        tags: ['function'],
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
        tags: ['class'],
        complexity: complexity((cls.endLine || 0) - (cls.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some(e => e.name === cls.name)) {
        edges.push({ source: fileId, target: clsId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }
  }

  writeFileSync(outPath, JSON.stringify({ nodes, edges }, null, 2));
  process.stderr.write(`batch ${idx}/${batches.totalBatches}: ${nodes.length} nodes, ${edges.length} edges\n`);
}

const merge = spawnSync('python3', [join(SKILL_DIR, 'merge-batch-graphs.py'), PROJECT_ROOT], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
if (merge.status !== 0) {
  console.error('merge failed:', merge.stderr);
  process.exit(1);
}
process.stderr.write(merge.stderr || '');

const assembled = JSON.parse(readFileSync(join(INTER, 'assembled-graph.json'), 'utf8'));
const fileLevel = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const fileNodes = assembled.nodes.filter(n => fileLevel.has(n.type));

const layerBuckets = {
  'layer:entry': { id: 'layer:entry', name: 'Entry & Shell', description: 'Main process, renderer boot, preload, server entry.', nodeIds: [] },
  'layer:features': { id: 'layer:features', name: 'Features (UI)', description: 'Renderer feature modules and UI shell.', nodeIds: [] },
  'layer:lib': { id: 'layer:lib', name: 'Shared Logic (lib/)', description: 'Node-side shared libraries, DB, doc generators.', nodeIds: [] },
  'layer:lan': { id: 'layer:lan', name: 'LAN Sync', description: 'LAN squad host/client sync kernel.', nodeIds: [] },
  'layer:infra': { id: 'layer:infra', name: 'Infra & Config', description: 'Build, CI, config, scripts, docs.', nodeIds: [] },
};

for (const n of fileNodes) {
  const p = n.filePath || n.id.split(':').slice(1).join(':');
  let layer = 'layer:infra';
  if (/^(main|preload|server)\.js$/.test(basename(p)) || p === 'public/js/app.js') layer = 'layer:entry';
  else if (p.startsWith('public/js/features/') || p.startsWith('public/js/app-')) layer = 'layer:features';
  else if (p.startsWith('lib/')) layer = 'layer:lib';
  else if (p.startsWith('lan-squad/') || /lan-sync|orchestrator/.test(p)) layer = 'layer:lan';
  else if (p.startsWith('public/js/')) layer = 'layer:features';
  layerBuckets[layer].nodeIds.push(n.id);
}

const layers = Object.values(layerBuckets).filter(l => l.nodeIds.length > 0);
const tour = [
  { order: 1, title: 'Electron Main', description: 'Desktop shell, IPC, auto-updater.', nodeIds: fileNodes.filter(n => n.filePath === 'main.js').map(n => n.id) },
  { order: 2, title: 'LAN Server', description: 'Express/WS hub on port 3738.', nodeIds: fileNodes.filter(n => n.filePath === 'server.js').map(n => n.id) },
  { order: 3, title: 'Renderer Boot', description: 'Feature registration and UI bundle.', nodeIds: fileNodes.filter(n => ['public/js/app.js', 'public/js/app-runtimes.mjs', 'public/js/app-shell.mjs'].includes(n.filePath)).map(n => n.id) },
  { order: 4, title: 'Clinical DB', description: 'SQLCipher schema and IPC handlers.', nodeIds: fileNodes.filter(n => n.filePath?.startsWith('lib/db/')).slice(0, 8).map(n => n.id) },
  { order: 5, title: 'LAN Sync', description: 'Orchestrator and host persistence.', nodeIds: fileNodes.filter(n => n.filePath?.includes('orchestrator') || n.filePath?.startsWith('lan-squad/')).slice(0, 8).map(n => n.id) },
].filter(s => s.nodeIds.length > 0);

const commit = spawnSync('git', ['-C', PROJECT_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const graph = {
  version: '1.0.0',
  project: {
    name: scan.name || 'R+',
    languages: scan.languages || [],
    frameworks: scan.frameworks || [],
    description: scan.description || 'Electron medical workbench',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: commit,
  },
  nodes: assembled.nodes,
  edges: assembled.edges,
  layers,
  tour,
};

writeFileSync(join(PROJECT_ROOT, '.understand-anything/knowledge-graph.json'), JSON.stringify(graph, null, 2));
writeFileSync(join(PROJECT_ROOT, '.understand-anything/meta.json'), JSON.stringify({ gitCommitHash: commit, analyzedAt: graph.project.analyzedAt }, null, 2));
console.log(JSON.stringify({ nodes: graph.nodes.length, edges: graph.edges.length, layers: layers.length, tour: tour.length }));
