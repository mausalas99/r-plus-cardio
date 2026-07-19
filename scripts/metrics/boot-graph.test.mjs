import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectBootStaticImports,
  hashBootGraph,
  findBootLazyOnlyViolations,
} from './boot-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('collectBootStaticImports finds app.js feature imports', () => {
  const imports = collectBootStaticImports(ROOT);
  assert.ok(imports.some((i) => i.from.includes('features/patients')));
  assert.ok(!imports.some((i) => i.isDynamic && i.from.includes('features/patients')));
});

test('hashBootGraph is stable for same import set', () => {
  const a = collectBootStaticImports(ROOT);
  assert.equal(hashBootGraph(a), hashBootGraph(a));
});

test('findBootLazyOnlyViolations flags eager settings-help barrel on boot hub', () => {
  const violations = findBootLazyOnlyViolations([
    { hub: 'public/js/app-runtimes.mjs', from: './features/settings-help.mjs', isDynamic: false },
  ]);
  assert.equal(violations.length, 1);
  assert.match(violations[0].banned, /settings-help/);
});
