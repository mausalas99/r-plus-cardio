#!/usr/bin/env node
/**
 * One-shot extractor for BN-06 platform split.
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
  path.join(process.cwd(), 'public/js/features/platform.mjs'),
  'utf8'
);
const lines = src.split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const outDir = path.join(process.cwd(), 'public/js/features/platform');

const sections = {
  'updater-early.mjs': slice(87, 162),
  offline: slice(164, 613),
  audit: slice(615, 920),
  'import-backup': slice(922, 1789),
  updater: slice(1791, 2478),
  handlers: slice(2480, 2521),
};

for (const [name, body] of Object.entries(sections)) {
  fs.writeFileSync(path.join(outDir, `_extract_${name}.txt`), body + '\n');
}
console.log('Wrote extracts to', outDir);
