import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectExportedNames(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((part) => {
      const chunk = part.trim();
      if (!chunk || chunk.startsWith('//')) return;
      const alias = chunk.split(/\s+as\s+/);
      names.add(alias[alias.length - 1].trim());
    });
  }
  return names;
}

function stubDomForShellImport() {
  globalThis.document = {
    documentElement: {
      classList: {
        toggle() {},
        add() {},
        remove() {},
        contains() {
          return false;
        },
      },
    },
    body: {
      classList: {
        toggle() {},
        add() {},
        remove() {},
        contains() {
          return false;
        },
      },
    },
    addEventListener() {},
    getElementById() {
      return null;
    },
    activeElement: null,
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.matchMedia = globalThis.window.matchMedia || function () {
    return { matches: false, addEventListener() {}, removeEventListener() {} };
  };
  if (!globalThis.localStorage) {
    globalThis.localStorage = {
      getItem(key) {
        if (key === 'rpc-settings') {
          return JSON.stringify({ clinicalLocalOnly: true });
        }
        return null;
      },
      setItem() {},
    };
  }
}

describe('app-shell backward-compat re-exports', () => {
  it('app-shell.mjs stays at or under 800 lines', () => {
    const shellPath = path.join(__dirname, 'app-shell.mjs');
    const lineCount = fs.readFileSync(shellPath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 800, 'app-shell.mjs has ' + lineCount + ' lines (max 800)');
  });

  it('declares deprecated re-exports on the shell module', () => {
    const exports = collectExportedNames(path.join(__dirname, 'app-shell.mjs'));
    assert.ok(exports.has('guardMobileDocExport'));
    assert.ok(exports.has('launchConfetti'));
    assert.ok(exports.has('applyDefaultsToNewPatient'));
  });

  it('re-exported symbols resolve to functions when shell loads', async () => {
    stubDomForShellImport();
    const mod = await import('./app-shell.mjs');
    assert.equal(typeof mod.guardMobileDocExport, 'function');
    assert.equal(typeof mod.launchConfetti, 'function');
    assert.equal(typeof mod.applyDefaultsToNewPatient, 'function');
  });
});
