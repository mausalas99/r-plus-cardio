import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('vendor-loader uses UMD inject only (no brittle ESM import)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'vendor-loader.mjs'), 'utf8');
  assert.match(src, /injectChartVendorScript/);
  assert.match(src, /publicAssetUrl\('vendor\/chart\.umd\.min\.js'\)/);
  assert.doesNotMatch(src, /chart\.js\/auto/);
  assert.doesNotMatch(src, /chart-chunk\.json/);
});

test('index.src.html loads Chart UMD before app bundle', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.src.html'), 'utf8');
  const chartIdx = html.indexOf('vendor/chart.umd.min.js');
  const bundleIdx = html.indexOf('js/app.bundle.mjs');
  assert.ok(chartIdx >= 0 && bundleIdx >= 0);
  assert.ok(chartIdx < bundleIdx);
});
