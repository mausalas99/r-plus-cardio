import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectBootStaticImports,
  findBootLazyOnlyViolations,
} from '../../scripts/metrics/boot-graph.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseNamedImports(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const out = [];
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const from = m[2];
    const names = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    out.push({ from, names });
  }
  return out;
}

function collectExportedNames(filePath, visited = new Set()) {
  const abs = path.resolve(filePath);
  if (visited.has(abs)) return new Set();
  visited.add(abs);

  const src = fs.readFileSync(abs, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((part) => {
      const chunk = part.trim();
      if (!chunk) return;
      const alias = chunk.split(/\s+as\s+/);
      names.add(alias[alias.length - 1].trim());
    });
  }
  for (const m of src.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    const reExport = resolveImport(path.dirname(abs), m[1]);
    if (reExport && fs.existsSync(reExport)) {
      for (const n of collectExportedNames(reExport, visited)) names.add(n);
    }
  }
  return names;
}

function resolveImport(baseDir, from) {
  if (!from.startsWith('.')) return null;
  const rel = from.endsWith('.mjs') || from.endsWith('.js') ? from : from + '.mjs';
  return path.resolve(baseDir, rel);
}

for (const bootFile of ['app.js', 'app-shell.mjs', 'app-runtimes.mjs']) {
  test(bootFile + ' — imports nombrados existen en el módulo destino', () => {
    const baseDir = __dirname;
    const bootPath = path.join(baseDir, bootFile);
    const imports = parseNamedImports(bootPath);
    const missing = [];

    for (const { from, names } of imports) {
      const target = resolveImport(baseDir, from);
      if (!target || !fs.existsSync(target)) continue;
      const exports = collectExportedNames(target);
      for (const name of names) {
        if (!exports.has(name)) missing.push({ from, name });
      }
    }

    assert.equal(
      missing.length,
      0,
      missing.map((x) => `${bootFile}: ${x.name} no exportado en ${x.from}`).join('\n')
    );
  });
}

test('app-shell.mjs no corrompe literales settings-* ni rpc-settings', () => {
  const src = fs.readFileSync(path.join(__dirname, 'app-shell.mjs'), 'utf8');
  assert.doesNotMatch(src, /rpc-shellCtx|shellCtx\.getSettings\(\)-/);
});

test('register* helpers use the same param name in signature and body', () => {
  const root = __dirname;
  const mismatches = [];
  const re = /export function (register\w+)\((partial|ctx)\)\s*\{([\s\S]{0,400}?)\n\}/g;

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(p);
        continue;
      }
      if (!ent.name.endsWith('.mjs')) continue;
      const src = fs.readFileSync(p, 'utf8');
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(src))) {
        const name = m[1];
        const param = m[2];
        const body = m[3];
        if (param === 'partial' && (/\bctx\b/.test(body) && !/\bpartial\b/.test(body))) {
          mismatches.push(`${path.relative(root, p)}:${name} declares partial but body uses ctx`);
        }
        if (param === 'ctx' && (/\bpartial\b/.test(body) && !/\bctx\b/.test(body))) {
          mismatches.push(`${path.relative(root, p)}:${name} declares ctx but body uses partial`);
        }
      }
    }
  }

  walk(root);
  assert.equal(mismatches.length, 0, mismatches.join('\n'));
});

test('boot hubs do not eagerly import lazy-only feature shells (BN-12)', () => {
  const imports = collectBootStaticImports(REPO_ROOT);
  const violations = findBootLazyOnlyViolations(imports);
  assert.equal(
    violations.length,
    0,
    violations
      .map((v) => `${v.hub} must not import ${v.from} (lazy route — use lazy-feature-routes.mjs)`)
      .join('\n')
  );
});
