#!/usr/bin/env node
/**
 * Regenerate R+ Cardio app icons from design/icon/cardio-pulse-cross.
 * Run: node scripts/render-cardio-icons.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DESIGN = path.join(ROOT, 'design/icon/cardio-pulse-cross');
const PREVIEW = path.join(DESIGN, 'preview.svg');
const PREVIEW_32 = path.join(DESIGN, 'preview-small-32.svg');
const PUBLIC_ICONS = path.join(ROOT, 'public/icons');
const BUILD = path.join(ROOT, 'build');

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function resvg(svg, outPng, width) {
  run(`npx --yes @resvg/resvg-js-cli --fit-width ${width} "${svg}" "${outPng}"`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildIconset(png1024, iconsetDir) {
  ensureDir(iconsetDir);
  const map = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ];
  for (const [px, name] of map) {
    const out = path.join(iconsetDir, name);
    execSync(`sips -z ${px} ${px} "${png1024}" --out "${out}"`, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
}

function main() {
  if (!fs.existsSync(PREVIEW)) {
    throw new Error(`Missing ${PREVIEW}`);
  }
  ensureDir(PUBLIC_ICONS);
  ensureDir(BUILD);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardio-icons-'));
  const png1024 = path.join(tmp, 'icon-1024.png');
  const png192 = path.join(tmp, 'icon-192.png');
  const png32 = path.join(tmp, 'favicon-32.png');
  const png180 = path.join(tmp, 'apple-touch-icon.png');

  console.log('▸ Rasterize SVG…');
  resvg(PREVIEW, png1024, 1024);
  resvg(PREVIEW, png192, 192);
  resvg(PREVIEW, png180, 180);
  resvg(fs.existsSync(PREVIEW_32) ? PREVIEW_32 : PREVIEW, png32, 32);

  console.log('▸ public/icons…');
  fs.copyFileSync(png32, path.join(PUBLIC_ICONS, 'favicon-32.png'));
  fs.copyFileSync(png180, path.join(PUBLIC_ICONS, 'apple-touch-icon.png'));
  fs.copyFileSync(png192, path.join(PUBLIC_ICONS, 'icon-192.png'));

  console.log('▸ build/AppIcon.icns…');
  const iconset = path.join(tmp, 'AppIcon.iconset');
  buildIconset(png1024, iconset);
  const icnsOut = path.join(BUILD, 'AppIcon.icns');
  // Run from parent of .iconset so iconutil resolves names cleanly
  execSync(`iconutil -c icns AppIcon.iconset -o "${icnsOut}"`, {
    cwd: tmp,
    stdio: 'inherit',
  });

  console.log('▸ build/icon.ico…');
  const icoOut = path.join(BUILD, 'icon.ico');
  try {
    run(`magick "${png1024}" -define icon:auto-resize=256,128,64,48,32,16 "${icoOut}"`);
  } catch {
    run(`convert "${png1024}" -define icon:auto-resize=256,128,64,48,32,16 "${icoOut}"`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n✓ R+ Cardio icons rendered (public/icons + build/AppIcon.icns + build/icon.ico).');
}

main();
