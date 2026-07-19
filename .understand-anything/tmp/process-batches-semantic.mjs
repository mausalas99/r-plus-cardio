#!/usr/bin/env node
/**
 * Phase 2 file-analyzer: structural extraction + domain-aware semantic graph for R+.
 * Processes batch range [start, end] inclusive.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const PROJECT_ROOT = process.argv[2] || '/Users/mauriciosalas/R+';
const START = Number(process.argv[3] || 1);
const END = Number(process.argv[4] || 13);
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || `${process.env.HOME}/.understand-anything-plugin`;
const SKILL_DIR = join(PLUGIN_ROOT, 'skills/understand');
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');
const TMP = join(PROJECT_ROOT, '.understand-anything/tmp');

const batchesDoc = JSON.parse(readFileSync(join(INTER, 'batches.json'), 'utf8'));
const exportsByPath = batchesDoc.exportsByPath || {};

const FILE_SUMMARIES = {
  'lib/entrega/entrega-chip-markers.mjs': 'Maps guardia entrega handoff state to visual chip markers for census and board UI.',
  'lib/entrega/entrega-handoff-context.mjs': 'Normalizes and validates entrega handoff context JSON shared between guardia shift transitions.',
  'lib/entrega/entrega-pendientes.mjs': 'Core pendientes (todo) model for guardia entrega: due dates, reminders, and LAN-serializable payloads.',
  'lib/entrega/entrega-vitals-plan.mjs': 'Plans and normalizes vitals monitoring schedules during guardia entrega handoffs.',
  'lib/entrega/guardia-chip-critical.mjs': 'Flags critical guardia census chips based on pendientes and handoff context.',
  'lib/interno/interno-board.mjs': 'Server-side interno board row builder combining pendientes, vitals banner, and bed sort.',
  'lib/interno/interno-scope.mjs': 'Resolves which interno patients a mobile client may view based on clinical scope.',
  'lib/interno/vitals-banner.mjs': 'Formats vitals plan banner HTML for interno mobile board rows.',
  'lib/patient-bed-sort.mjs': 'Sorts patients by bed number for census and board displays.',
  'lib/patient-priority-sort.mjs': 'Priority sort for guardia board using handoff context, pendientes, and bed order.',
  'public/js/features/clinical-census-filters-state.mjs': 'Shared census filter state barrel re-exported for guardia board filtering.',
  'public/js/features/clinical-entrega.mjs': 'Renderer feature orchestrating guardia entrega workflow, roster, and modal UI.',
  'public/js/features/clinical-teams.mjs': 'Barrel re-export for clinical teams feature modules.',
  'public/js/features/entrega-modal-ui.mjs': 'Entrega modal DOM and interaction layer for shift handoff pendientes review.',
  'public/js/features/entrega-roster-panel.mjs': 'Roster panel showing team members and entrega status during guardia.',
  'public/js/features/guardia-board.mjs': 'Main guardia patient board integrating censo filters, entrega, vitals feed, and LAN sync.',
  'public/js/features/guardia-phase-bar.mjs': 'Phase indicator bar for guardia entrega stages tied to roster panel.',
  'public/js/features/guardia-vitals-feed.mjs': 'Live vitals feed panel on guardia board sourced from interno board data.',
  'public/js/features/session-manager.mjs': 'Manages guardia session lifecycle and entrega state transitions in renderer.',
  'public/js/features/unified-patient-grid-board.mjs': 'Unified patient grid layout combining chips, vitals, and priority sort.',
  'public/js/guardia-orphan-entregas.mjs': 'Detects and reconciles orphaned entrega records after guardia team changes.',
  'public/interno/interno-app.mjs': 'Mobile interno web client boot and routing for guardia board mirror.',
  'public/interno/host-discovery.mjs': 'LAN host discovery helpers for interno mobile connecting to ward Mac.',
  'public/js/features/lan/orchestrator.mjs': 'LAN sync façade coordinating push, room, transport, conflicts, and patient ops.',
  'public/js/features/lan/conflicts.mjs': 'LAN conflict detection and LWW resolution helpers for live sync.',
  'public/js/features/lan/entity-versions.mjs': 'Tracks entity version vectors for LAN delta sync and merge.',
  'public/js/features/lan/patient-delete.mjs': 'Client-side LAN patient delete with tombstone and host purge policy.',
  'public/js/features/lan/push.mjs': 'LAN bundle push transport to host with retry and profiling hooks.',
  'public/js/features/lan/room.mjs': 'LAN room join/leave and census snapshot hydration for ward sync.',
  'public/js/features/lan/transport.mjs': 'WebSocket/HTTP transport layer for LAN sync commands.',
  'public/js/lan-client.mjs': 'Low-level LAN HTTP client with auth token and host URL resolution.',
  'public/js/lan-connection-manager.mjs': 'Manages LAN connection state, reconnect, and host failover.',
  'public/js/lan-delta-client.mjs': 'Applies LAN delta patches to local patient bundles.',
  'public/js/lan-host-registry.mjs': 'Registry of known LAN hosts and ward consolidation metadata.',
  'public/js/lan-sync-state.mjs': 'Observable LAN sync state machine for renderer diagnostics.',
  'public/js/storage.js': 'Legacy localStorage bridge for non-DB renderer persistence paths.',
  'generate-censo.js': 'PDF censo generator with table layout, lab wrapping, and daily export file naming.',
  'public/js/censo-build.mjs': 'Builds censo row data from patient census state for PDF export.',
  'public/js/cultivo-block-core.mjs': 'Unified cultivo block parser for censo, bulk paste, and lab history import.',
  'public/js/labs.js': 'Main lab report parser (procesarLabs) splitting SOME text into structured sections.',
  'public/js/labs-display.mjs': 'Lab value display formatting, flags, and trend helpers for renderer.',
  'lib/db/schema.mjs': 'SQLCipher schema definitions, migrations, and version bump for clinical DB.',
  'lib/db/db-manager.mjs': 'SQLCipher database open, migrate, and connection lifecycle manager.',
  'lib/db/ipc-handlers.mjs': 'Electron IPC handlers exposing clinical DB operations to renderer.',
  'lib/db/clinical-access-db.mjs': 'Clinical user, guardia, team, and LAN directory persistence in SQLCipher.',
  'public/js/app.js': 'Renderer boot entry registering features via app-runtimes and building UI shell.',
  'public/js/app-runtimes.mjs': 'Feature registration table wiring windowHandlers for renderer modules.',
  'public/js/app-shell.mjs': 'Application chrome: toasts, modals, header, and global UI scaffolding.',
  'public/js/features/patients.mjs': 'Patient list and censo management feature for guardia workflows.',
  'public/js/features/pase-board.mjs': 'Pase de guardia board UI for shift handoff overview.',
  'public/js/features/vpo.mjs': 'VPO documentation feature for structured clinical note generation.',
  'public/js/features/notes-indicaciones.mjs': 'Indicaciones médicas note editor and export integration.',
  'server.js': 'Express LAN server on port 3738: doc export, interno routes, WS hub.',
  'main.js': 'Electron main process: window, IPC, auto-updater, spawns LAN server.',
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

function fnComplexity(start, end) {
  const lines = (end || 0) - (start || 0) + 1;
  if (lines < 15) return 'simple';
  if (lines <= 40) return 'moderate';
  return 'complex';
}

function inferDomainTags(path) {
  const tags = [];
  if (/\.(test|spec)\./.test(path) || /\.test\.(mjs|js)$/.test(path)) tags.push('test');
  if (/entrega|guardia|pendientes/.test(path)) tags.push('guardia', 'entrega');
  if (/interno/.test(path)) tags.push('interno', 'mobile');
  if (/lan-|livesync|live-sync|orchestrator/.test(path)) tags.push('lan-sync');
  if (/censo/.test(path)) tags.push('censo');
  if (/labs|lab-|tend|tendencias|cultivo/.test(path)) tags.push('labs');
  if (/lib\/db|sqlcipher|schema/.test(path)) tags.push('sqlcipher', 'data-model');
  if (/ipc-handlers|preload|main\.js/.test(path)) tags.push('electron', 'ipc');
  if (/server\.js|express/.test(path)) tags.push('api-handler');
  if (/settings-help|tour|onboarding/.test(path)) tags.push('onboarding');
  if (/vpo|indicaciones|doc-export|\.docx/.test(path)) tags.push('documentation');
  if (/features\//.test(path) && !tags.includes('test')) tags.push('component');
  if (basename(path) === 'app.js' || basename(path) === 'app-runtimes.mjs') tags.push('entry-point');
  if (basename(path).startsWith('index.') && /features\//.test(path)) tags.push('barrel');
  if (tags.length === 0) tags.push('utility');
  return [...new Set(tags)].slice(0, 5);
}

function tagsFor(file, result) {
  const tags = inferDomainTags(file.path);
  if (file.fileCategory === 'docs') return ['documentation', 'agent-skill', 'development'].slice(0, 5);
  if (file.fileCategory === 'config') return ['configuration', 'build-system', 'typescript'].slice(0, 5);
  if (file.fileCategory === 'script') return ['build-system', 'native', 'sqlcipher'].slice(0, 5);
  if ((result.exports?.length || 0) > 3 && (result.functions?.length || 0) <= 2) tags.push('barrel');
  if ((result.exports?.length || 0) > 0 && !tags.includes('test')) tags.push('exports');
  return [...new Set(tags)].slice(0, 5);
}

function humanizeName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function fnSummary(fnName, filePath) {
  const n = fnName;
  const base = basename(filePath);
  if (/^test|^describe|^it$|^assert/.test(n)) return `Test helper ${n} validating ${base.replace(/\.test\.(mjs|js)$/, '')} behavior.`;
  if (/^normalize|^parse|^build|^render|^format|^resolve|^compute|^calculate|^merge|^sync|^push|^fetch|^load|^save|^update|^create|^delete|^validate|^ensure|^wire|^open|^close|^handle|^on[A-Z]/.test(n)) {
    const verb = n.match(/^[a-z]+/)?.[0] || 'Handles';
    return `${verb.charAt(0).toUpperCase() + verb.slice(1)}s ${humanizeName(n.replace(/^[a-z]+/, ''))} for ${base}.`;
  }
  if (/^is[A-Z]|^has[A-Z]|^should[A-Z]|^can[A-Z]/.test(n)) {
    return `Predicate ${humanizeName(n)} used by ${base}.`;
  }
  if (/^get[A-Z]|^set[A-Z]|^list[A-Z]/.test(n)) {
    return `Accessor ${humanizeName(n)} exposing ${base} state or data.`;
  }
  return `${n} implements guardia/clinical workflow logic in ${base}.`;
}

function summaryFor(file, result) {
  if (FILE_SUMMARIES[file.path]) return FILE_SUMMARIES[file.path];
  const type = fileNodeType(file);
  const base = basename(file.path);
  const fn = result.functions?.length || 0;
  const exp = (exportsByPath[file.path] || result.exports?.map(e => e.name) || []).slice(0, 4);

  if (/\.test\.(mjs|js)$/.test(file.path)) {
    const prod = file.path.replace(/\.test\.(mjs|js)$/, '.$1').replace(/\.(mjs|js)$/, (_, ext) => `.${ext}`);
    return `Unit tests for ${basename(prod)} covering guardia/clinical behavior and edge cases.`;
  }
  if (type === 'document') return `Agent skill or project documentation (${result.nonEmptyLines || 0} lines).`;
  if (type === 'config') return `Project configuration controlling build, lint, or runtime settings.`;
  if (type === 'pipeline') return `CI/CD pipeline definition for test, build, and release gates.`;
  if (type === 'service') return `Infrastructure definition for deployment or container runtime.`;
  if (file.fileCategory === 'script') return `Build or native tooling script for Electron/SQLCipher packaging.`;

  const domain = inferDomainTags(file.path).filter(t => !['test', 'exports', 'utility', 'component'].includes(t))[0] || 'clinical';
  if (exp.length > 0) {
    return `${base} — ${domain} module exporting ${exp.join(', ')}${exp.length >= 4 ? ', …' : ''}.`;
  }
  if (fn > 0) {
    return `${base} — ${domain} module with ${fn} function(s) for R+ guardia workflows.`;
  }
  return `${base} — ${file.language} module (${result.nonEmptyLines || 0} lines) in ${domain} domain.`;
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

function productionTargetFromTest(testPath) {
  return testPath.replace(/\.test\.(mjs|js)$/, '.$1');
}

const summary = { status: 'DONE', batchesCompleted: [], nodesTotal: 0, edgesTotal: 0, errors: [] };

for (let idx = START; idx <= END; idx++) {
  const batch = batchesDoc.batches.find(b => b.batchIndex === idx);
  if (!batch) {
    summary.errors.push(`batch ${idx} not found`);
    summary.status = 'BLOCKED';
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
  if (run.status !== 0 || !existsSync(extractPath) || !readFileSync(extractPath, 'utf8').trim()) {
    summary.errors.push(`batch ${idx} extract failed: ${(run.stderr || '').slice(-300)}`);
    summary.status = 'BLOCKED';
    continue;
  }

  const extracted = JSON.parse(readFileSync(extractPath, 'utf8'));
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  for (const result of extracted.results || []) {
    const fileMeta = batch.files.find(f => f.path === result.path) || {
      path: result.path, language: result.language, fileCategory: result.fileCategory || 'code',
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
    nodeIds.add(fileId);

    const imports = batch.batchImportData?.[result.path] || [];
    for (const target of imports) {
      edges.push({
        source: `file:${result.path}`,
        target: `file:${target}`,
        type: 'imports',
        direction: 'forward',
        weight: 0.7,
      });
    }

    if (/\.test\.(mjs|js)$/.test(result.path)) {
      for (const target of imports) {
        if (!/\.test\.(mjs|js)$/.test(target)) {
          edges.push({
            source: `file:${target}`,
            target: `file:${result.path}`,
            type: 'tested_by',
            direction: 'forward',
            weight: 0.5,
          });
        }
      }
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
        tags: inferDomainTags(result.path).filter(t => t !== 'test').slice(0, 3).concat(['function']),
        complexity: fnComplexity(fn.startLine, fn.endLine),
      });
      nodeIds.add(fnId);
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
        summary: `Class ${cls.name} encapsulating ${inferDomainTags(result.path)[0] || 'clinical'} logic in ${basename(result.path)}.`,
        tags: inferDomainTags(result.path).filter(t => t !== 'test').slice(0, 3).concat(['class']),
        complexity: fnComplexity(cls.startLine, cls.endLine),
      });
      nodeIds.add(clsId);
      edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exports.some(e => e.name === cls.name)) {
        edges.push({ source: fileId, target: clsId, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }
  }

  // Skipped files still get nodes
  for (const skipped of extracted.filesSkipped || []) {
    if (nodeIds.has(`file:${skipped}`)) continue;
    const fileMeta = batch.files.find(f => f.path === skipped);
    if (!fileMeta) continue;
    const nType = fileNodeType(fileMeta);
    nodes.push({
      id: `${nodePrefix(nType)}:${skipped}`,
      type: nType,
      name: basename(skipped),
      filePath: skipped,
      summary: `Skipped by extractor; ${basename(skipped)} present in batch.`,
      tags: tagsFor(fileMeta, {}),
      complexity: 'simple',
    });
  }

  writeFileSync(outPath, JSON.stringify({ nodes, edges }, null, 2));
  summary.batchesCompleted.push(idx);
  summary.nodesTotal += nodes.length;
  summary.edgesTotal += edges.length;
  process.stderr.write(`batch ${idx}/${END} done\n`);
}

console.log(JSON.stringify(summary));
