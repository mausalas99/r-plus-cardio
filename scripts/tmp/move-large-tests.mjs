#!/usr/bin/env node
/**
 * One-shot: move large *.test.* files from eslint paths to tests/ mirror tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const MOVES = [
  ['lan-squad/host-router.test.js', 'tests/lan-squad/host-router.test.js'],
  ['lan-squad/host-store.test.js', 'tests/lan-squad/host-store.test.js'],
  ['lan-squad/auth-router.test.js', 'tests/lan-squad/auth-router.test.js'],
  ['lib/db/clinical-access-db.test.mjs', 'tests/lib/db/clinical-access-db.test.mjs'],
  ['lib/db/clinical-ops-sync.test.mjs', 'tests/lib/db/clinical-ops-sync.test.mjs'],
  ['public/js/labs-cultivo.test.mjs', 'tests/public/js/labs-cultivo.test.mjs'],
  ['public/js/med-receta-core.test.mjs', 'tests/public/js/med-receta-core.test.mjs'],
  ['public/js/labs-some-table.test.mjs', 'tests/public/js/labs-some-table.test.mjs'],
  ['public/js/storage.test.mjs', 'tests/public/js/storage.test.mjs'],
];

function fixImports(content, fromRel, toRel) {
  const fromDir = path.dirname(fromRel);
  const toDir = path.dirname(toRel);
  const depthDelta =
    toDir.split('/').filter(Boolean).length - fromDir.split('/').filter(Boolean).length;

  return content.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, rel) => {
      const abs = path.normalize(path.join(fromDir, rel));
      let newRel = path.relative(toDir, abs).replace(/\\/g, '/');
      if (!newRel.startsWith('.')) newRel = './' + newRel;
      return `from '${newRel}'`;
    }
  ).replace(
    /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    (match, rel) => {
      const abs = path.normalize(path.join(fromDir, rel));
      let newRel = path.relative(toDir, abs).replace(/\\/g, '/');
      if (!newRel.startsWith('.')) newRel = './' + newRel;
      return `require('${newRel}')`;
    }
  );
}

for (const [from, to] of MOVES) {
  const fromPath = path.join(ROOT, from);
  const toPath = path.join(ROOT, to);
  if (!fs.existsSync(fromPath)) {
    console.warn('skip missing', from);
    continue;
  }
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  let content = fs.readFileSync(fromPath, 'utf8');
  content = fixImports(content, from, to);
  fs.writeFileSync(toPath, content);
  fs.unlinkSync(fromPath);
  console.log('moved', from, '->', to);
}

// Update package.json test script paths
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let testScript = pkg.scripts.test;
for (const [from, to] of MOVES) {
  testScript = testScript.split(from).join(to);
}
pkg.scripts.test = testScript;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('updated package.json');
