#!/usr/bin/env node
/**
 * Regenerate Lista de espera PNG icons from SVG sources.
 * Run: node scripts/render-equipos-icons.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ICON_VERSION = 'v2';
const TARGETS = [
  path.join(ROOT, 'public/equipos/icons'),
  path.join(ROOT, 'cloud/equipos-pages/public/equipos/icons'),
];

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function renderSet(iconDir) {
  const outDir = path.join(iconDir, ICON_VERSION);
  fs.mkdirSync(outDir, { recursive: true });
  const svg = path.join(iconDir, 'icon.svg');
  const maskSvg = path.join(iconDir, 'icon-maskable.svg');
  if (!fs.existsSync(svg)) {
    throw new Error(`Missing ${svg}`);
  }
  run(`npx --yes @resvg/resvg-js-cli --fit-width 192 "${svg}" "${path.join(outDir, 'icon-192.png')}"`);
  run(`npx --yes @resvg/resvg-js-cli --fit-width 512 "${svg}" "${path.join(outDir, 'icon-512.png')}"`);
  if (fs.existsSync(maskSvg)) {
    run(
      `npx --yes @resvg/resvg-js-cli --fit-width 512 "${maskSvg}" "${path.join(outDir, 'icon-512-maskable.png')}"`
    );
  }
  fs.copyFileSync(path.join(outDir, 'icon-192.png'), path.join(outDir, 'apple-touch-icon.png'));
  for (const name of ['icon-192.png', 'apple-touch-icon.png', 'icon-512.png', 'icon-512-maskable.png']) {
    const src = path.join(outDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(iconDir, name));
    }
  }
}

for (const dir of TARGETS) {
  console.log(`\n▸ ${path.relative(ROOT, dir)}/${ICON_VERSION}/`);
  renderSet(dir);
}

console.log('\n✓ Equipos icons rendered. Redeploy worker if using cloud.');
