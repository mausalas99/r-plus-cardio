#!/usr/bin/env node
/** Run Understand Anything phases 3-7 after batch merge. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.argv[2] || '/Users/mauriciosalas/R+';
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || `${process.env.HOME}/.understand-anything-plugin`;
const SKILL_DIR = join(PLUGIN_ROOT, 'skills/understand');
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');
const UA = join(PROJECT_ROOT, '.understand-anything');

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: PROJECT_ROOT });
  if (r.status !== 0) {
    console.error(`${label} failed:`, r.stderr?.slice(-2000));
    process.exit(1);
  }
  return r.stdout + (r.stderr || '');
}

// Phase 2 merge
console.log('[merge] merge-batch-graphs.py');
run('python3', [join(SKILL_DIR, 'merge-batch-graphs.py'), PROJECT_ROOT], 'merge');

const assembled = JSON.parse(readFileSync(join(INTER, 'assembled-graph.json'), 'utf8'));
const scan = JSON.parse(readFileSync(join(INTER, 'scan-result.json'), 'utf8'));
const commit = spawnSync('git', ['-C', PROJECT_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

// Load layers/tour if subagents wrote them
let layers = [];
let tour = [];
if (existsSync(join(INTER, 'layers.json'))) {
  const raw = JSON.parse(readFileSync(join(INTER, 'layers.json'), 'utf8'));
  layers = Array.isArray(raw) ? raw : raw.layers || [];
}
if (existsSync(join(INTER, 'tour.json'))) {
  const raw = JSON.parse(readFileSync(join(INTER, 'tour.json'), 'utf8'));
  tour = Array.isArray(raw) ? raw : raw.steps || raw.tour || [];
}

// Fallback layers from path heuristics if missing
if (layers.length === 0) {
  const fileLevel = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
  const buckets = {
    'layer:entry': { id: 'layer:entry', name: 'Entry & Shell', description: 'Electron main, preload, LAN server, renderer boot.', nodeIds: [] },
    'layer:features': { id: 'layer:features', name: 'Renderer Features', description: 'UI feature modules under public/js/features.', nodeIds: [] },
    'layer:lib': { id: 'layer:lib', name: 'Shared lib/', description: 'Node-side DB, doc generators, interno, entrega.', nodeIds: [] },
    'layer:lan': { id: 'layer:lan', name: 'LAN Sync', description: 'lan-squad host/client sync kernel.', nodeIds: [] },
    'layer:infra': { id: 'layer:infra', name: 'Infra & Docs', description: 'Build, CI, config, scripts, documentation.', nodeIds: [] },
  };
  for (const n of assembled.nodes.filter(n => fileLevel.has(n.type))) {
    const p = n.filePath || '';
    let L = 'layer:infra';
    if (/^(main|preload|server)\.js$/.test(p.split('/').pop()) || p === 'public/js/app.js') L = 'layer:entry';
    else if (p.startsWith('public/js/features/') || p.startsWith('public/js/app-')) L = 'layer:features';
    else if (p.startsWith('lib/')) L = 'layer:lib';
    else if (p.startsWith('lan-squad/') || /lan-sync|orchestrator/.test(p)) L = 'layer:lan';
    else if (p.startsWith('public/js/')) L = 'layer:features';
    buckets[L].nodeIds.push(n.id);
  }
  layers = Object.values(buckets).filter(l => l.nodeIds.length);
}

const nodeIds = new Set(assembled.nodes.map(n => n.id));
for (const layer of layers) {
  layer.nodeIds = (layer.nodeIds || []).filter(id => nodeIds.has(id));
}
for (const step of tour) {
  step.nodeIds = (step.nodeIds || []).filter(id => nodeIds.has(id));
}

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

writeFileSync(join(UA, 'knowledge-graph.json'), JSON.stringify(graph, null, 2));

// Phase 6 inline validate
const validateScript = join(TMP, 'ua-inline-validate.cjs');
if (!existsSync(validateScript)) {
  console.error('Missing validate script');
  process.exit(1);
}
run('node', [validateScript, join(INTER, 'assembled-graph.json'), join(INTER, 'review.json')], 'validate');

// Phase 7 fingerprints
const paths = scan.files.map(f => f.path);
writeFileSync(join(INTER, 'fingerprint-input.json'), JSON.stringify({
  projectRoot: PROJECT_ROOT,
  sourceFilePaths: paths,
  gitCommitHash: commit,
}, null, 2));
const fp = run('node', [join(SKILL_DIR, 'build-fingerprints.mjs'), join(INTER, 'fingerprint-input.json')], 'fingerprints');
if (!fp.includes('Fingerprints baseline:')) {
  console.error('Fingerprint build did not report success');
  process.exit(1);
}

writeFileSync(join(UA, 'meta.json'), JSON.stringify({
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash: commit,
  version: '1.0.0',
  analyzedFiles: scan.totalFiles,
}, null, 2));

console.log(JSON.stringify({
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  layers: layers.length,
  tour: tour.length,
  review: JSON.parse(readFileSync(join(INTER, 'review.json'), 'utf8')),
}, null, 2));
