#!/usr/bin/env node
/**
 * Phase 4: extract file nodes, run structural analysis, assign layers, write layers.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = process.argv[2] || '/Users/mauriciosalas/R+';
const INTER = path.join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = path.join(PROJECT_ROOT, '.understand-anything/tmp');

const FILE_LEVEL_TYPES = new Set([
  'file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint',
]);

const NON_CODE_TYPES = new Set(['config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);

function assignLayer(node, results) {
  const fp = node.filePath || '';
  const base = path.basename(fp);
  const type = node.type;
  const tags = node.tags || [];

  // Non-code nodes first
  if (type === 'document') return 'layer:infra-docs';
  if (type === 'pipeline') return 'layer:infra-docs';
  if (type === 'config') return 'layer:infra-docs';
  if (type === 'service' || type === 'resource') return 'layer:infra-docs';
  if (type === 'table' || type === 'schema') return 'layer:clinical-db';
  if (type === 'endpoint') return 'layer:lan-server';

  // Desktop Shell — Electron main process + preload bridge
  if (fp === 'main.js' || fp === 'preload.js') return 'layer:desktop-shell';
  if (fp.startsWith('lib/update-downgrade') || fp === 'lib/stable-versions.json' || fp === 'lib/min-version.json') {
    return 'layer:desktop-shell';
  }

  // LAN Server — Express HTTP/WS host on port 3738
  if (fp === 'server.js') return 'layer:lan-server';
  if (fp.startsWith('lib/doc-export-http')) return 'layer:lan-server';
  if (fp.startsWith('lib/doc-generators/')) return 'layer:lan-server';

  // Clinical DB — SQLCipher schema, crypto, IPC handlers
  if (fp.startsWith('lib/db/')) return 'layer:clinical-db';
  if (fp.startsWith('lib/historia-clinica/')) return 'layer:clinical-db';

  // LAN Sync — lan-squad kernel + renderer sync orchestration
  if (fp.startsWith('lan-squad/')) return 'layer:lan-sync';
  if (fp.startsWith('public/js/features/lan/')) return 'layer:lan-sync';
  if (/^public\/js\/lan-/.test(fp)) return 'layer:lan-sync';
  if (/lan-sync|lan-host|lan-ward|lan-delta|orchestrator/.test(fp) && fp.startsWith('public/js/')) {
    return 'layer:lan-sync';
  }

  // Renderer Boot — app shell, runtimes, state hydration, lazy routes
  if (fp === 'public/js/app.js') return 'layer:renderer-boot';
  if (/^public\/js\/app-/.test(fp)) return 'layer:renderer-boot';
  if (fp === 'public/js/clinical-access-runtime.mjs') return 'layer:renderer-boot';
  if (fp === 'public/js/lazy-feature-routes.mjs') return 'layer:renderer-boot';
  if (fp === 'public/js/storage.js') return 'layer:renderer-boot';
  if (fp === 'public/index.html' || fp.startsWith('public/partials/')) return 'layer:renderer-boot';
  if (fp.startsWith('public/styles/') && !fp.includes('interno')) return 'layer:renderer-boot';
  if (fp === 'public/tokens.css' || fp === 'design.md') return 'layer:renderer-boot';

  // Feature UI — renderer feature modules and mobile interno client
  if (fp.startsWith('public/js/features/')) return 'layer:feature-ui';
  if (fp.startsWith('public/interno/')) return 'layer:feature-ui';
  if (fp.startsWith('public/js/') && fp.endsWith('.mjs')) return 'layer:feature-ui';
  if (fp.startsWith('public/js/') && fp.endsWith('.js') && !fp.includes('app.')) return 'layer:feature-ui';
  if (fp.startsWith('public/') && (fp.endsWith('.css') || fp.endsWith('.html'))) return 'layer:feature-ui';

  // Shared lib — Node-side domain logic importable from main/server/renderer
  if (fp.startsWith('lib/')) return 'layer:shared-lib';
  if (fp.startsWith('lib/entrega/')) return 'layer:shared-lib';
  if (fp.startsWith('lib/drive-import/')) return 'layer:shared-lib';
  if (fp.startsWith('lib/interno/')) return 'layer:shared-lib';

  // Infra & Docs — build scripts, CI, agent skills, plans, tests at repo root
  if (fp.startsWith('scripts/')) return 'layer:infra-docs';
  if (fp.startsWith('docs/')) return 'layer:infra-docs';
  if (fp.startsWith('plans/')) return 'layer:infra-docs';
  if (fp.startsWith('.github/')) return 'layer:infra-docs';
  if (fp.startsWith('.cursor/')) return 'layer:infra-docs';
  if (fp.startsWith('.claude/')) return 'layer:infra-docs';
  if (fp.startsWith('.deepseek/')) return 'layer:infra-docs';
  if (fp.startsWith('.agents/')) return 'layer:infra-docs';
  if (fp.startsWith('.understand-anything/')) return 'layer:infra-docs';
  if (/\.(test|spec)\.(mjs|js)$/.test(base)) {
    // Colocate tests with their domain when path is clear
    if (fp.startsWith('lib/db/')) return 'layer:clinical-db';
    if (fp.startsWith('lan-squad/')) return 'layer:lan-sync';
    if (fp.startsWith('lib/')) return 'layer:shared-lib';
    if (fp.startsWith('public/js/features/lan/')) return 'layer:lan-sync';
    if (fp.startsWith('public/js/')) return 'layer:feature-ui';
    return 'layer:infra-docs';
  }
  if (type === 'file' && tags.includes('test')) {
    if (fp.startsWith('lib/db/')) return 'layer:clinical-db';
    if (fp.startsWith('lan-squad/')) return 'layer:lan-sync';
    if (fp.startsWith('lib/')) return 'layer:shared-lib';
    if (fp.startsWith('public/js/')) return 'layer:feature-ui';
    return 'layer:infra-docs';
  }

  // Root-level configs and manifests
  if (/^(package\.json|package-lock\.json|electron-builder|\.env|\.cursorignore|\.gitignore|README|CHANGELOG|CONTRIBUTING|CLAUDE|LICENSE)/.test(base) || fp.match(/^[A-Z_]+\.(md|json|yml|yaml)$/)) {
    return 'layer:infra-docs';
  }

  // Fallback using directory group pattern from structural analysis
  const group = Object.entries(results.directoryGroups).find(([, ids]) => ids.includes(node.id));
  if (group) {
    const [dirName, pattern] = [group[0], results.patternMatches[group[0]]];
    if (dirName === 'lan-squad') return 'layer:lan-sync';
    if (dirName === 'lib') return 'layer:shared-lib';
    if (dirName === 'docs' || dirName === 'scripts' || dirName === '.github') return 'layer:infra-docs';
    if (pattern === 'documentation' || pattern === 'ci-cd' || pattern === 'config' || pattern === 'infrastructure') {
      return 'layer:infra-docs';
    }
    if (pattern === 'data') return 'layer:clinical-db';
    if (pattern === 'ui') return 'layer:feature-ui';
    if (pattern === 'api') return 'layer:lan-server';
    if (pattern === 'service') return 'layer:shared-lib';
  }

  return 'layer:infra-docs';
}

function main() {
  const assembledPath = path.join(INTER, 'assembled-graph.json');
  const graph = JSON.parse(fs.readFileSync(assembledPath, 'utf8'));

  const fileNodes = graph.nodes
    .filter((n) => FILE_LEVEL_TYPES.has(n.type))
    .map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      filePath: n.filePath,
      summary: n.summary,
      tags: n.tags || [],
    }));

  const fileIdSet = new Set(fileNodes.map((n) => n.id));

  const importEdges = graph.edges.filter(
    (e) => e.type === 'imports' && fileIdSet.has(e.source) && fileIdSet.has(e.target),
  );

  const allEdges = graph.edges.filter(
    (e) => fileIdSet.has(e.source) && fileIdSet.has(e.target),
  );

  const inputPath = path.join(TMP, 'ua-arch-input.json');
  const resultsPath = path.join(TMP, 'ua-arch-results.json');
  const analyzeScript = path.join(TMP, 'ua-arch-analyze.js');

  fs.writeFileSync(inputPath, JSON.stringify({ fileNodes, importEdges, allEdges }, null, 2));

  const r = spawnSync('node', [analyzeScript, inputPath, resultsPath], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('Analysis failed:', r.stderr);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

  const layerDefs = {
    'layer:desktop-shell': {
      id: 'layer:desktop-shell',
      name: 'Desktop Shell',
      description: 'Electron main process, preload IPC bridge, auto-updater, and window lifecycle for the R+ desktop workbench.',
      nodeIds: [],
    },
    'layer:lan-server': {
      id: 'layer:lan-server',
      name: 'LAN Server',
      description: 'Express HTTP/WS server on port 3738, document export routes, and server-side handlers for interno mobile and LAN API.',
      nodeIds: [],
    },
    'layer:renderer-boot': {
      id: 'layer:renderer-boot',
      name: 'Renderer Boot',
      description: 'Renderer entry (app.js), feature registration via app-runtimes, app-shell chrome, state hydration, and lazy route loading.',
      nodeIds: [],
    },
    'layer:clinical-db': {
      id: 'layer:clinical-db',
      name: 'Clinical DB',
      description: 'SQLCipher schema, encryption, clinical access IPC, historia clínica compile/migration, and persisted patient data layer.',
      nodeIds: [],
    },
    'layer:lan-sync': {
      id: 'layer:lan-sync',
      name: 'LAN Sync',
      description: 'lan-squad host/client sync kernel — WS hub, conflict resolver, write queue, and renderer orchestrator for ward LiveSync.',
      nodeIds: [],
    },
    'layer:feature-ui': {
      id: 'layer:feature-ui',
      name: 'Feature UI',
      description: 'Renderer feature modules (labs, VPO, guardia, expediente), mobile interno web client, and patient-facing UI under public/js/features/.',
      nodeIds: [],
    },
    'layer:shared-lib': {
      id: 'layer:shared-lib',
      name: 'Shared lib',
      description: 'Node-side domain logic shared across main, server, and renderer — entrega, drive-import, interno helpers, and doc utilities outside DB/sync.',
      nodeIds: [],
    },
    'layer:infra-docs': {
      id: 'layer:infra-docs',
      name: 'Infra & Docs',
      description: 'Build/release scripts, CI pipelines, agent skills, project documentation, configuration manifests, and debt metrics tooling.',
      nodeIds: [],
    },
  };

  for (const node of fileNodes) {
    const layerId = assignLayer(node, results);
    if (!layerDefs[layerId]) {
      console.error('Unknown layer for', node.id, '->', layerId);
      process.exit(1);
    }
    layerDefs[layerId].nodeIds.push(node.id);
  }

  const layers = Object.values(layerDefs).filter((l) => l.nodeIds.length > 0);

  const assigned = new Set(layers.flatMap((l) => l.nodeIds));
  const missing = fileNodes.filter((n) => !assigned.has(n.id));
  const dupes = fileNodes.length - assigned.size;

  if (missing.length) {
    console.error('Unassigned nodes:', missing.map((n) => n.id).slice(0, 10));
    process.exit(1);
  }
  if (dupes !== 0) {
    console.error('Duplicate assignments detected');
    process.exit(1);
  }

  fs.writeFileSync(path.join(INTER, 'layers.json'), JSON.stringify(layers, null, 2));

  const summary = {
    status: 'ok',
    layerCount: layers.length,
    nodeCoverage: `${assigned.size}/${fileNodes.length}`,
    layers: layers.map((l) => ({ name: l.name, count: l.nodeIds.length })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
