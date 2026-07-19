#!/usr/bin/env node
/**
 * One-shot: replace local esc/escapeHtml helpers with dom-escape.mjs imports.
 * Usage: node scripts/migrate-dom-escape.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

const ESC_NAMES = new Set(['esc', 'escHtml', 'escAttr', 'escapeHtml', 'escapeAttr', 'escCensoHtml']);

/** @param {string} fileAbs */
function domEscapeImportPath(fileAbs) {
  const rel = path.relative(path.dirname(fileAbs), path.join(ROOT, 'public', 'js', 'dom-escape.mjs'));
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** @param {string} src */
function stripEscFunctions(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const removed = [];
  while (i < lines.length) {
    const line = lines[i];
    const fnMatch = line.match(/^(export\s+)?function\s+(\w+)\s*\(/);
    if (fnMatch && ESC_NAMES.has(fnMatch[2])) {
      const name = fnMatch[2];
      let depth = 0;
      let started = false;
      const start = i;
      while (i < lines.length) {
        for (const ch of lines[i]) {
          if (ch === '{') {
            depth++;
            started = true;
          } else if (ch === '}') depth--;
        }
        if (started && depth === 0) {
          i++;
          break;
        }
        i++;
      }
      removed.push(name);
      if (i < lines.length && lines[i] === '') i++;
      continue;
    }
    out.push(line);
    i++;
  }
  return { body: out.join('\n'), removed };
}

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

/** @param {string} fileAbs @param {string} body @param {string[]} names */
function ensureImport(fileAbs, body, names) {
  if (!names.length) return body;
  if (body.includes('dom-escape.mjs')) return body;

  const importPath = domEscapeImportPath(fileAbs);
  const unique = [...new Set(names.map((n) => {
    if (n === 'escCensoHtml') return { local: 'escCensoHtml', imported: 'escHtml' };
    return { local: n, imported: n };
  }).map((x) => JSON.stringify(x)))].map((s) => JSON.parse(s));

  const importNames = unique.map(({ local, imported }) =>
    local === imported ? imported : `${imported} as ${local}`
  );
  const importLine = `import { ${importNames.join(', ')} } from '${importPath}';`;

  const lines = body.split('\n');
  const insertAt = findImportEnd(lines);
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  if (before.length && before[before.length - 1].trim() !== '') before.push('');
  return [...before, importLine, ...after].join('\n');
}

function collectTargets(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'chunks' || name === 'app.bundle.mjs') continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) collectTargets(abs, acc);
    else if (name.endsWith('.mjs') && name !== 'dom-escape.mjs' && !name.includes('.test.')) acc.push(abs);
  }
  return acc;
}

const targets = [
  ...collectTargets(path.join(ROOT, 'public', 'js')),
  path.join(ROOT, 'public', 'interno', 'interno-app.mjs'),
].filter((f) => fs.existsSync(f));

let changed = 0;
for (const fileAbs of targets) {
  const src = fs.readFileSync(fileAbs, 'utf8');
  if (![...ESC_NAMES].some((n) => src.includes(`function ${n}(`))) continue;
  const { body, removed } = stripEscFunctions(src);
  if (!removed.length) continue;
  const next = ensureImport(fileAbs, body, removed);
  if (next === src) continue;
  changed++;
  console.log(path.relative(ROOT, fileAbs), '←', removed.join(', '));
  if (WRITE) fs.writeFileSync(fileAbs, next);
}

console.log(WRITE ? `updated ${changed} files` : `would update ${changed} files (dry run, pass --write)`);
