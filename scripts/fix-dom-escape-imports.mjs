#!/usr/bin/env node
/** Move dom-escape imports to top; add re-exports for known barrels. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const REEXPORT = new Map([
  ['public/js/features/patients-html.mjs', ['esc']],
  ['public/js/features/medications-utils.mjs', ['esc']],
  ['public/js/features/historia-clinica-app-panel/runtime.mjs', ['esc']],
  ['public/js/features/historia-clinica-panel/runtime.mjs', ['esc']],
  ['public/js/features/lan/transport-deps.mjs', ['esc']],
  ['public/js/features/expediente/expediente-runtime.mjs', ['esc']],
]);

function findImportEnd(lines) {
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith('/**')) {
      i++;
      while (i < lines.length && !lines[i].trim().endsWith('*/')) i++;
      i++;
      continue;
    }
    if (!t) {
      i++;
      continue;
    }
    if (t.startsWith('import ')) {
      while (i < lines.length && !lines[i].includes(';')) i++;
      i++;
      continue;
    }
    break;
  }
  return i;
}

function fixFile(rel) {
  const abs = path.join(ROOT, rel);
  let lines = fs.readFileSync(abs, 'utf8').split('\n');
  const domImports = [];
  lines = lines.filter((line) => {
    if (line.includes('dom-escape.mjs') && line.trim().startsWith('import ')) {
      domImports.push(line);
      return false;
    }
    return true;
  });
  if (!domImports.length) return false;
  const unique = [...new Set(domImports)];
  const insertAt = Math.min(findImportEnd(lines), lines.length);
  const block = [...unique];
  const reexp = REEXPORT.get(rel);
  if (reexp?.length) {
    const names = reexp.join(', ');
    const hasRe = lines.some((l) => l.includes(`export { ${names}`) || l.includes(`export {${names}`));
    if (!hasRe) block.push(`export { ${names} };`);
  }
  if (insertAt > 0 && lines[insertAt - 1]?.trim() !== '') block.push('');
  lines.splice(insertAt, 0, ...block);
  fs.writeFileSync(abs, lines.join('\n'));
  return true;
}

const walk = (dir, acc = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'chunks' || name === 'app.bundle.mjs') continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, acc);
    else if (name.endsWith('.mjs')) acc.push(path.relative(ROOT, abs));
  }
  return acc;
};

let n = 0;
for (const rel of walk(path.join(ROOT, 'public'))) {
  if (fixFile(rel)) {
    n++;
    console.log('fixed', rel);
  }
}
fixFile('public/interno/interno-app.mjs');
console.log('done', n);
