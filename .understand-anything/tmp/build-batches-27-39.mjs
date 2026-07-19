#!/usr/bin/env node
/**
 * Build batch-27..39.json with semantic summaries from extract-structure results.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const PROJECT_ROOT = '/Users/mauriciosalas/R+';
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');

const batches = JSON.parse(readFileSync(join(INTER, 'batches.json'), 'utf8'));

const FILE_SUMMARIES = {
  'lib/stable-versions-catalog.js': 'Catalog of stable R+ release versions used for downgrade UI and update policy.',
  'lib/stable-versions-catalog.test.js': 'Tests for stable-versions-catalog parsing and lookup behavior.',
  'lib/update-downgrade.js': 'Legacy CommonJS module handling auto-update downgrade paths and stable version selection.',
  'lib/update-downgrade.test.js': 'Tests for update-downgrade version comparison and downgrade eligibility.',
  'lib/update-downgrade.mjs': 'ESM update/downgrade helpers: min-version checks, stable channel selection, and downgrade gating.',
  'scripts/bundle-renderer.mjs': 'esbuild pipeline that bundles public/js renderer sources into app.bundle.mjs and chunks.',
  'scripts/bundle-renderer.test.mjs': 'Tests for renderer bundle entry points, chunk splitting, and build flags.',
  'scripts/lib/artifact-names.js': 'Derives electron-builder artifact filenames per platform and version.',
  'scripts/lib/artifact-names.test.js': 'Tests artifact name templates for macOS and Windows builds.',
  'scripts/lib/electron-pack-files.js': 'Syncs electron-builder files list from project layout for release packaging.',
  'scripts/lib/electron-pack-files.test.js': 'Tests pack-files glob rules and write mode for electron-builder config.',
  'scripts/lib/mac-signing-prep.js': 'Prepares macOS code-signing entitlements and notarization inputs before build.',
  'scripts/lib/release-build-log.js': 'Structured logging helpers for the release pipeline build steps.',
  'scripts/lib/release-build-log.test.js': 'Tests release build log formatting and step markers.',
  'scripts/lib/release-git.js': 'Git operations for release: tag creation, dirty-tree checks, and push helpers.',
  'scripts/lib/release-notes-body.js': 'Builds GitHub release notes body from CHANGELOG sections.',
  'scripts/lib/release-notes-body.test.js': 'Tests release notes body extraction from markdown changelog.',
  'scripts/lib/release-notes-plain.js': 'Plain-text release notes formatter for in-app display.',
  'scripts/lib/release-notes-plain.test.js': 'Tests plain release notes truncation and section parsing.',
  'scripts/lib/release-progress.js': 'Terminal progress UI for multi-step release.js publish flow.',
  'scripts/lib/release-progress.test.js': 'Tests release progress bar and step label rendering.',
  'scripts/release.js': 'Main release orchestrator: bump version, test, build, publish to GitHub/electron-updater.',
  'scripts/write-release-yml.js': 'Generates latest-mac.yml / latest.yml for electron auto-updater feeds.',
  'lib/interno/interno-vitals.mjs': 'Server-side interno mobile vitals parsing and normalization for guardia board.',
  'public/js/censo-signos-format.mjs': 'Formats vital signs blocks for censo export and clipboard output.',
  'public/js/censo-signos-format.test.mjs': 'Tests censo vital signs formatting edge cases and unit labels.',
  'public/js/features/estado-actual-charts.mjs': 'Façade for Estado Actual chart modal: re-exports series, display, tabs, and Chart.js wiring.',
  'public/js/features/estado-actual-charts-chartjs.mjs': 'Chart.js canvas setup, dataset binding, and update-in-place for EA vitals charts.',
  'public/js/features/estado-actual-charts-display.mjs': 'Downsampling, bundle cache, and tooltip data for EA chart rendering.',
  'public/js/features/estado-actual-charts-modal.mjs': 'Modal shell for Estado Actual charts with tab navigation and lazy Chart.js load.',
  'public/js/features/estado-actual-charts-series.mjs': 'Series definitions, colors, and signature keys for EA vital sign chart lines.',
  'public/js/features/estado-actual-charts-session.mjs': 'Session-scoped chart state: active tab, zoom range, and patient binding.',
  'public/js/features/estado-actual-charts-tabs.mjs': 'Tab UI for EA charts (vitals, I/O, meds) with in-place dataset updates.',
  'public/js/features/estado-actual-charts.test.mjs': 'Integration tests for EA chart modal, downsampling, and tab switching.',
  'public/js/features/estado-actual-data.mjs': 'Core Estado Actual data model: vitals rows, I/O balance, diet, and LAN merge hooks.',
  'public/js/features/estado-actual-data.test.mjs': 'Tests EA data normalization, NC I/O balance, and diet confirm merge.',
  'public/js/features/estado-actual-glu-rescue.mjs': 'Glucose rescue protocol UI and threshold alerts in Estado Actual.',
  'public/js/features/estado-actual-glu-rescue.test.mjs': 'Tests glucose rescue trigger thresholds and display copy.',
  'public/js/features/estado-actual-io.mjs': 'Intake/output balance tracking and fluid summary for Estado Actual panel.',
  'public/js/features/estado-actual-io.test.mjs': 'Tests I/O parsing, net balance calculation, and unit normalization.',
  'public/js/features/estado-actual-med-ui.mjs': 'Medication row UI components for Estado Actual including dose and route display.',
  'public/js/features/estado-actual-med-ui.test.mjs': 'Tests EA medication row rendering and edit affordances.',
  'public/js/features/estado-actual-meds.mjs': 'Medication list parsing, sorting, and state for Estado Actual monitoring.',
  'public/js/features/estado-actual-meds.test.mjs': 'Tests EA medication parser and duplicate detection.',
  'public/js/features/estado-actual-panel.mjs': 'Main Estado Actual panel shell: vitals grid, meds, I/O, and chart launcher.',
  'public/js/features/estado-actual-panel.test.mjs': 'Tests EA panel layout, empty states, and section visibility.',
  'public/js/features/estado-actual-parse-variants.mjs': 'Alternate SOME/vitals paste format parsers for Estado Actual ingestion.',
  'public/js/features/estado-actual-parse-variants.test.mjs': 'Tests variant parser selection and fallback behavior.',
  'public/js/features/estado-actual-parser.mjs': 'Primary SOME-to-EA parser: vitals, meds, and I/O from pasted nursing notes.',
  'public/js/features/estado-actual-parser.test.mjs': 'Golden tests for EA SOME paste parsing across common hospital formats.',
  'public/js/features/estado-actual-ranges.mjs': 'Clinical reference ranges and abnormal flags for EA vital signs.',
  'public/js/features/estado-actual-ranges.test.mjs': 'Tests vital range thresholds and age-adjusted limits.',
  'public/js/features/estado-actual-registro-defaults.mjs': 'Default values for new EA registro rows and shift handoff fields.',
  'public/js/features/estado-actual-registro-defaults.test.mjs': 'Tests EA registro default population on new patient admit.',
  'public/js/features/estado-actual-text.mjs': 'Text serialization and clipboard export for Estado Actual summaries.',
  'public/js/features/estado-actual-text.test.mjs': 'Tests EA text export format for evolution notes.',
  'public/js/features/estado-actual-vital-extras.mjs': 'Extended vital fields (pain scale, GCS, etc.) beyond standard SOME columns.',
  'public/js/features/estado-actual-vital-series.mjs': 'Time-series extraction from EA rows for chart sparklines and trends.',
  'public/js/features/estado-actual-vital-series.test.mjs': 'Tests vital series ordering, dedup, and missing-point handling.',
  'public/js/labs-some-detect.test.mjs': 'Tests SOME lab block detection heuristics in pasted lab reports.',
  'public/js/med-receta-core.mjs': 'Core prescription (receta) parsing and formatting for medication orders.',
  'public/js/med-receta-core.test.mjs': 'Tests receta parsing, dose units, and HU prescription block output.',
  'public/js/vendor-loader.mjs': 'Lazy dynamic import loader for heavy vendor chunks (Chart.js, etc.).',
  'public/js/app-boot-imports.test.mjs': 'Tests renderer boot import graph stays within debt boot-graph budget.',
  'scripts/metrics/boot-graph.mjs': 'Analyzes eager static imports in app.js/app-runtimes for boot-graph debt scoring.',
  'scripts/metrics/boot-graph.test.mjs': 'Tests boot-graph import hash and new-import detection.',
  'scripts/metrics/constants.mjs': 'Shared debt metric thresholds, weights, and Tier-1 file budgets.',
  'scripts/metrics/run.mjs': 'Runs full technical debt analysis: ESLint complexity, jscpd, dependency-cruiser, boot graph.',
  'scripts/metrics/score.mjs': 'Computes total debt score from complexity, length, duplication, and import smell overages.',
  'scripts/metrics/score.test.mjs': 'Tests debt score aggregation and baseline comparison logic.',
  'public/js/patient-list-incremental.mjs': 'Incremental DOM updates for patient sidebar list on LAN sync deltas.',
  'public/js/patient-list-incremental.test.mjs': 'Tests incremental list patch application and ordering preservation.',
  'public/js/patient-list-virtual.mjs': 'Virtual scrolling for large censuses (>30 patients) in sidebar and board views.',
  'public/js/patient-list-virtual.test.mjs': 'Tests virtual list window calculation and scroll restoration.',
  'public/js/virtual-scroll.mjs': 'Generic virtual scroll engine: viewport window, item height, and scroll event binding.',
  'public/js/virtual-scroll.test.mjs': 'Tests virtual scroll math for variable and fixed item heights.',
  'public/js/min-version-fetch.mjs': 'Fetches min-version.json from release feed to gate incompatible LAN peers.',
  'public/js/min-version-fetch.test.mjs': 'Tests min-version fetch caching and offline fallback.',
  'public/js/stable-downgrade-ui.mjs': 'Settings UI for selecting stable channel downgrade and version picker.',
  'public/js/stable-downgrade-ui.test.mjs': 'Tests downgrade UI state and stable catalog integration.',
  'public/js/vpo-display.mjs': 'Display formatting helpers for VPO (voluntad anticipada) panel fields.',
  'public/js/vpo-lookups.mjs': 'Lookup tables and label maps for VPO documentation codes.',
  'public/js/vpo-lookups.test.mjs': 'Tests VPO lookup resolution and missing-code fallbacks.',
  'scripts/metrics/changed-files.mjs': 'Git diff helper: lists Tier-1 files touched for ratchet enforcement.',
  'scripts/metrics/changed-files.test.mjs': 'Tests changed-files detection against git diff output.',
  'scripts/metrics/check.mjs': 'CI gate: runs metrics and fails if total debt score exceeds baseline.',
  '.github/workflows/ci.yml': 'GitHub Actions CI on main/PR: npm ci, build:ui, lint, metrics:check, and full test suite.',
  '.agents/skills/improve/references/audit-playbook.md': 'Agent skill reference: structured UI/UX audit playbook for improve skill.',
  '.agents/skills/improve/references/closing-the-loop.md': 'Agent skill reference: closing-the-loop checklist after improvement iterations.',
  '.agents/skills/improve/references/plan-template.md': 'Agent skill reference: template for improvement plan documents.',
  '.env.example': 'Example R_PLUS_* environment variables for LAN peer dev, persistence mode, and user data override.',
  'CHANGELOG.md': 'Human-readable release history with versioned sections for GitHub releases.',
  'CLAUDE.md': 'Claude Code entry pointer: build commands, hard rules, and docs hub links.',
  'CONTRIBUTING.md': 'Contributor guide: PR conventions, test policy, and multi-agent rules table.',
  'README.md': 'Project overview: R+ Electron medical workbench, install, dev workflow, and release notes link.',
  'design.md': 'Design system reference: tokens, typography, spacing, and UI conventions for R+.',
  'min-version.json': 'Minimum compatible app version for LAN sync and auto-update peer gating.',
  'package.json': 'npm manifest: Electron app metadata, scripts, dependencies, and electron-builder config.',
  'skills-lock.json': 'Lockfile pinning agent skill versions for reproducible Cursor/Claude skill installs.',
  'stable-versions.json': 'Catalog of stable release versions available for downgrade selection.',
  'docs/INSTALLER_EXIT_CODES.md': 'Documents Windows/macOS installer exit codes for support troubleshooting.',
  'docs/LAN_SYNC_6.6.1_RISK_ANALYSIS.md': 'Risk analysis document for LAN sync changes in release 6.6.1.',
  'docs/README.md': 'Documentation hub index pointing to core, features, logic, and database doc trees.',
};

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

function tagsFor(file, result) {
  const tags = [];
  const base = basename(file.path);
  if (/\.(test|spec)\./.test(file.path) || /_test\.(mjs|js)$/.test(base)) tags.push('test');
  if (file.path.startsWith('scripts/')) tags.push('build-system');
  if (file.path.startsWith('lib/')) tags.push('service');
  if (file.path.startsWith('public/js/features/estado-actual')) tags.push('component');
  if (file.path.includes('estado-actual')) tags.push('clinical-ui');
  if (file.path.startsWith('public/js/features/')) tags.push('component');
  if (file.fileCategory === 'docs') tags.push('documentation');
  if (file.fileCategory === 'config') tags.push('configuration');
  if (file.fileCategory === 'infra') tags.push('ci-cd', 'deployment');
  if ((result.exports?.length || 0) > 0 && !tags.includes('test')) tags.push('exports');
  if (base === 'release.js') tags.push('entry-point');
  if (base === 'package.json') tags.push('entry-point');
  if (base === 'README.md') tags.push('entry-point');
  if (tags.length < 3) tags.push('module');
  return [...new Set(tags)].slice(0, 5);
}

function summaryFor(file, result) {
  if (FILE_SUMMARIES[file.path]) return FILE_SUMMARIES[file.path];
  const type = fileNodeType(file);
  if (type === 'document') {
    if (file.path.includes('RELEASE_NOTES')) {
      const ver = file.path.match(/RELEASE_NOTES_([\d.]+)/)?.[1] || 'unknown';
      return `Release notes for R+ version ${ver}: user-facing changes and fixes.`;
    }
    return `Project documentation (${result.nonEmptyLines || 0} lines).`;
  }
  if (type === 'config') return `Configuration file defining runtime or build settings for R+.`;
  if (type === 'pipeline') return `CI/CD workflow running build, lint, metrics, and tests on push/PR.`;
  const fn = result.functions?.length || 0;
  const exp = (result.exports || []).map(e => e.name).slice(0, 3).join(', ');
  if (fn && exp) return `Exports ${exp}${fn > 3 ? '…' : ''} — ${fn} functions in ${basename(file.path)}.`;
  return `${basename(file.path)} module (${result.nonEmptyLines || 0} lines).`;
}

function fnSummary(name, filePath) {
  const lower = name.toLowerCase();
  if (lower.startsWith('test') || lower.includes('assert')) return `Test helper ${name} validating expected behavior.`;
  if (lower.startsWith('parse')) return `Parses input text into structured ${filePath.includes('estado-actual') ? 'EA' : 'clinical'} data.`;
  if (lower.startsWith('format') || lower.startsWith('render')) return `Formats or renders ${name.replace(/^(format|render)/i, '')} for display or export.`;
  if (lower.startsWith('build')) return `Builds ${name.replace(/^build/i, '')} structure for downstream use.`;
  if (lower.startsWith('compute') || lower.startsWith('calc')) return `Computes ${name.replace(/^(compute|calc)/i, '')} from input values.`;
  if (lower.startsWith('get') || lower.startsWith('fetch')) return `Retrieves ${name.replace(/^(get|fetch)/i, '')} from state or remote source.`;
  if (lower.startsWith('normalize')) return `Normalizes ${name.replace(/^normalize/i, '')} to canonical form.`;
  if (lower.startsWith('merge')) return `Merges ${name.replace(/^merge/i, '')} with conflict-aware LAN sync rules.`;
  if (lower.includes('chart')) return `Chart-related helper for Estado Actual vitals visualization.`;
  if (lower.includes('release')) return `Release pipeline step: ${name}.`;
  if (lower.includes('metric') || lower.includes('score')) return `Debt metric computation: ${name}.`;
  return `${name} — implementation in ${basename(filePath)}.`;
}

function shouldEmitFunction(fn, exports) {
  const lines = (fn.endLine || 0) - (fn.startLine || 0) + 1;
  return exports.some(e => e.name === fn.name) || lines >= 10;
}

function shouldEmitClass(cls, exports) {
  const exported = exports.some(e => e.name === cls.name);
  const methods = cls.methods?.length || 0;
  const lines = (cls.endLine || 0) - (cls.startLine || 0) + 1;
  return exported || methods >= 2 || lines >= 20;
}

function buildBatchGraph(batch) {
  const idx = batch.batchIndex;
  const extractPath = join(TMP, `ua-file-extract-results-${idx}.json`);
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
      const targetMeta = batch.files.find(f => f.path === target);
      const tType = fileNodeType(targetMeta || { path: target, fileCategory: 'code' });
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
        summary: fnSummary(fn.name, result.path),
        tags: ['utility'],
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
        summary: `Class ${cls.name} encapsulating related behavior in ${basename(result.path)}.`,
        tags: ['class'],
        complexity: complexity((cls.endLine || 0) - (cls.startLine || 0) + 1),
      });
      edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some(e => e.name === cls.name)) {
        edges.push({ source: fileId, target: clsId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }

    // Non-code edges
    if (nType === 'pipeline' && result.path === '.github/workflows/ci.yml') {
      edges.push({ source: fileId, target: 'file:scripts/metrics/check.mjs', type: 'triggers', direction: 'forward', weight: 0.6 });
      edges.push({ source: fileId, target: 'file:scripts/bundle-renderer.mjs', type: 'triggers', direction: 'forward', weight: 0.6 });
    }
    if (result.path === 'package.json') {
      edges.push({ source: fileId, target: 'file:main.js', type: 'configures', direction: 'forward', weight: 0.6 });
      edges.push({ source: fileId, target: 'file:scripts/release.js', type: 'configures', direction: 'forward', weight: 0.6 });
    }
    if (result.path === 'README.md') {
      edges.push({ source: fileId, target: 'file:main.js', type: 'documents', direction: 'forward', weight: 0.5 });
    }
    if (result.path === 'CLAUDE.md') {
      edges.push({ source: fileId, target: 'file:main.js', type: 'documents', direction: 'forward', weight: 0.5 });
    }
    if (result.path === 'design.md') {
      edges.push({ source: fileId, target: 'file:public/tokens.css', type: 'documents', direction: 'forward', weight: 0.5 });
    }
    if (result.path === '.env.example') {
      edges.push({ source: fileId, target: 'file:server.js', type: 'configures', direction: 'forward', weight: 0.6 });
    }
    if (/\.test\.(mjs|js)$/.test(result.path)) {
      const prod = result.path.replace(/\.test\.(mjs|js)$/, '.$1');
      edges.push({ source: `file:${prod}`, target: fileId, type: 'tested_by', direction: 'forward', weight: 0.5 });
    }
  }

  return { nodes, edges };
}

function writeBatchOutput(batchIndex, nodes, edges, files) {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const needsSplit = nodeCount > 60 || edgeCount > 120;

  if (!needsSplit) {
    writeFileSync(join(INTER, `batch-${batchIndex}.json`), JSON.stringify({ nodes, edges }, null, 2));
    return { parts: 1, nodeCount, edgeCount };
  }

  const parts = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const chunkSize = Math.ceil(sortedFiles.length / parts);
  const fileChunks = [];
  for (let i = 0; i < parts; i++) {
    fileChunks.push(new Set(sortedFiles.slice(i * chunkSize, (i + 1) * chunkSize).map(f => f.path)));
  }

  // Remove old single-part file if exists
  const singlePath = join(INTER, `batch-${batchIndex}.json`);
  if (existsSync(singlePath)) unlinkSync(singlePath);

  for (let p = 0; p < parts; p++) {
    const fileSet = fileChunks[p];
    const partNodes = nodes.filter(n => !n.filePath || fileSet.has(n.filePath));
    const partNodeIds = new Set(partNodes.map(n => n.id));
    const partEdges = edges.filter(e => partNodeIds.has(e.source));
    writeFileSync(
      join(INTER, `batch-${batchIndex}-part-${p + 1}.json`),
      JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)
    );
  }

  return { parts, nodeCount, edgeCount };
}

const status = [];
for (let idx = 27; idx <= 39; idx++) {
  const batch = batches.batches.find(b => b.batchIndex === idx);
  const { nodes, edges } = buildBatchGraph(batch);
  const expectedImports = Object.values(batch.batchImportData || {}).reduce((s, a) => s + a.length, 0);
  const importEdges = edges.filter(e => e.type === 'imports').length;
  const result = writeBatchOutput(idx, nodes, edges, batch.files);
  status.push({
    batchIndex: idx,
    files: batch.files.length,
    nodes: result.nodeCount,
    edges: result.edgeCount,
    parts: result.parts,
    importEdges,
    expectedImports,
    importsOk: importEdges === expectedImports,
  });
}

console.log(JSON.stringify({ batches: status }, null, 2));
