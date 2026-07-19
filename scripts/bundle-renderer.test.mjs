import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBundleRendererPaths } from './bundle-renderer.mjs';
import { filePatternCovers, PACK_FILES_BASELINE } from './lib/electron-pack-files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

describe('bundle-renderer', () => {
  it('resuelve rutas de entrada y salida del bundle', () => {
    const { entry, outfile } = getBundleRendererPaths(repoRoot);
    assert.match(entry, /public\/js\/app\.js$/);
    assert.match(outfile, /public\/js\/app\.bundle\.mjs$/);
  });

  it('esbuild chunks quedan bajo public/** para el empaquetado Mac', () => {
    const chunksDir = path.join(repoRoot, 'public/js/chunks');
    assert.ok(fs.existsSync(chunksDir), 'run npm run build:ui to emit chunks');
    const sample = fs.readdirSync(chunksDir).find((f) => f.endsWith('.js') && !f.endsWith('.map'));
    assert.ok(sample, 'expected at least one chunk .js');
    const rel = `public/js/chunks/${sample}`;
    assert.ok(
      filePatternCovers(rel, PACK_FILES_BASELINE),
      `${rel} must be covered by electron-pack public/**/*`
    );
  });

  it('emite app.bundle.mjs (no dejar solo app.bundle.js)', () => {
    const bundleMjs = path.join(repoRoot, 'public/js/app.bundle.mjs');
    const bundleJs = path.join(repoRoot, 'public/js/app.bundle.js');
    assert.ok(fs.existsSync(bundleMjs), 'run npm run bundle:renderer');
    assert.ok(!fs.existsSync(bundleJs), 'app.bundle.js must be renamed to .mjs');
    const text = fs.readFileSync(bundleMjs, 'utf8');
    assert.ok(
      text.includes('/js/chunks/'),
      'bundle entry must import split chunks, not inline whole features'
    );
  });

  it('index.html carga Chart UMD antes del bundle (BN-09)', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'public/index.html'), 'utf8');
    const chartIdx = html.indexOf('vendor/chart.umd.min.js');
    const bundleIdx = html.indexOf('js/app.bundle.mjs');
    assert.ok(chartIdx >= 0 && bundleIdx >= 0);
    assert.ok(chartIdx < bundleIdx);
  });
});
