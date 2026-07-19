#!/usr/bin/env node
/**
 * Mechanical ESLint fixes for Tier 1 changed files (no behavior change).
 * Targets: no-empty, no-useless-escape, no-redeclare, no-constant-condition, no-unused-vars.
 *
 *   node scripts/metrics/fix-mechanical-eslint.mjs           # git-changed Tier 1 files
 *   node scripts/metrics/fix-mechanical-eslint.mjs --full    # entire Tier 1 tree
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { filterTier1Paths, gitChangedFilesAgainst } from './changed-files.mjs';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const full = args.has('--full');
const SRC_EXT = new Set(['.js', '.mjs', '.cjs']);

function gitLines(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectPaths() {
  if (full) return ['public/js', 'lib', 'lan-squad'];
  const committed = filterTier1Paths(gitChangedFilesAgainst('main'));
  const unstaged = filterTier1Paths(gitLines('git diff --name-only HEAD'));
  const untracked = filterTier1Paths(gitLines('git ls-files --others --exclude-standard'));
  return [...new Set([...committed, ...unstaged, ...untracked])].filter((p) => existsSync(p));
}

function expandSourceFiles(paths) {
  const out = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const st = statSync(p);
    if (st.isFile()) {
      out.push(p.replace(/\\/g, '/'));
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const rel of readdirSync(p, { recursive: true })) {
      const fullPath = join(p, rel).replace(/\\/g, '/');
      if (!SRC_EXT.has(extname(fullPath))) continue;
      try {
        if (statSync(fullPath).isFile()) out.push(fullPath);
      } catch {
        /* skip */
      }
    }
  }
  return [...new Set(out)];
}

/** no-empty: keep catch binding, mark error intentionally unused. */
function fixNoEmptyCatchBlocks(src) {
  let out = src;
  out = out.replace(
    /catch\s*\(\s*([a-zA-Z_][a-zA-Z0-9]*)\s*\)\s*\{\s*\}/g,
    'catch ($1) { void $1; }',
  );
  out = out.replace(
    /catch\s*\(\s*([a-zA-Z_][a-zA-Z0-9]*)\s*\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/g,
    'catch ($1) { void $1; }',
  );
  out = out.replace(/catch\s*\{\s*\}/g, 'catch (_e) { void _e; }');
  out = out.replace(
    /catch\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/g,
    'catch (_e) { void _e; }',
  );
  return out;
}

function fixUnusedCatchBindings(src) {
  const edits = [];
  const catchRe = /\bcatch\s*\(\s*([a-zA-Z_][a-zA-Z0-9]*)\s*\)\s*\{/g;
  let m;
  while ((m = catchRe.exec(src)) !== null) {
    const varName = m[1];
    const openBrace = m.index + m[0].length - 1;
    let depth = 0;
    let pos = openBrace;
    do {
      if (src[pos] === '{') depth++;
      else if (src[pos] === '}') depth--;
      pos++;
    } while (pos < src.length && depth > 0);
    const body = src.slice(openBrace + 1, pos - 1);
    const usedRe = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (!usedRe.test(body)) {
      edits.push({ start: m.index, end: openBrace + 1, text: 'catch {' });
    }
  }
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) {
    src = src.slice(0, e.start) + e.text + src.slice(e.end);
  }
  return src;
}

function removeImportName(src, name, nearLine) {
  const lines = src.split('\n');
  let start = Math.max(0, nearLine - 1);
  while (start > 0 && !/^\s*import\b/.test(lines[start])) start--;
  if (!/^\s*import\b/.test(lines[start])) return src;
  let end = start;
  while (end + 1 < lines.length && !/\bfrom\s+['"]/.test(lines[end])) end++;
  const blockLines = lines.slice(start, end + 1);
  const block = blockLines.join('\n');
  const brace = block.match(/\{([\s\S]*?)\}/);
  if (!brace) return src;
  const specs = brace[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = specs.filter((s) => {
    const parts = s.split(/\s+as\s+/);
    const imported = parts[0].trim();
    const local = (parts[1] || parts[0]).trim();
    return local !== name && imported !== name;
  });
  if (kept.length === specs.length) return src;
  if (!kept.length) {
    const next = [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n');
    return next;
  }
  const newBlock = block.replace(brace[0], `{ ${kept.join(', ')} }`);
  const newLines = [...lines.slice(0, start), ...newBlock.split('\n'), ...lines.slice(end + 1)];
  return newLines.join('\n');
}

function removeDeadFunctionAt(src, lineNo, name) {
  const lines = src.split('\n');
  let idx = lineNo - 1;
  while (idx > 0 && !new RegExp(`\\bfunction\\s+${name}\\b`).test(lines[idx]) && !new RegExp(`\\b${name}\\s*=\\s*function\\b`).test(lines[idx])) {
    if (lines[idx].includes('function') || lines[idx].includes('=>')) break;
    idx--;
  }
  if (idx < 0 || idx >= lines.length) return src;
  const line = lines[idx];
  if (!new RegExp(`\\bfunction\\s+${name}\\b`).test(line) && !new RegExp(`\\b${name}\\s*=\\s*function\\b`).test(line)) {
    return src;
  }
  let start = idx;
  while (start > 0 && (lines[start - 1].trim().startsWith('*') || lines[start - 1].trim().startsWith('/**') || lines[start - 1].trim().startsWith('/*') || lines[start - 1].trim() === '*/')) {
    start--;
  }
  let pos = 0;
  for (let i = start; i < lines.length; i++) {
    pos += lines[i].length + 1;
  }
  const fromChar = lines.slice(0, start).join('\n').length + (start > 0 ? 1 : 0);
  const tail = lines.slice(start).join('\n');
  const fnRe = new RegExp(`(?:^|\\n)(?:\\/\\*\\*[\\s\\S]*?\\*\\/\\s*)?(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = tail.match(fnRe);
  if (!m) return src;
  const fnStart = fromChar + m.index + (m[0].startsWith('\n') ? 1 : 0);
  let braceIdx = src.indexOf('{', fnStart);
  if (braceIdx === -1) return src;
  let depth = 0;
  let end = braceIdx;
  do {
    if (src[end] === '{') depth++;
    else if (src[end] === '}') depth--;
    end++;
  } while (end < src.length && depth > 0);
  let removeEnd = end;
  if (src[removeEnd] === '\n') removeEnd++;
  return src.slice(0, fnStart) + src.slice(removeEnd);
}

function fixUselessEscapes(src, issues) {
  if (!issues.length) return src;
  const lines = src.split('\n');
  const lineSet = new Set(issues.map((i) => i.line));
  for (const ln of lineSet) {
    const idx = ln - 1;
    if (idx < 0 || idx >= lines.length) continue;
    let line = lines[idx];
    for (const issue of issues.filter((i) => i.line === ln)) {
      const m = issue.message.match(/\\(.)/);
      if (!m) continue;
      const ch = m[1];
      line = line.replace(`\\${ch}`, ch);
    }
    lines[idx] = line;
  }
  return lines.join('\n');
}

function removeImportSpecifier(line, name) {
  // import { a, b as c } from 'x'
  const re = new RegExp(
    `import\\s*\\{([^}]*?)\\}\\s*from`,
  );
  const m = line.match(re);
  if (!m) return null;
  const specs = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  const kept = specs.filter((s) => {
    const parts = s.split(/\s+as\s+/);
    const imported = parts[0].trim();
    const local = (parts[1] || parts[0]).trim();
    return local !== name && imported !== name;
  });
  if (kept.length === specs.length) return null;
  if (!kept.length) return null; // leave destructure-only imports to manual fix
  return line.replace(m[0], `import { ${kept.join(', ')} } from`);
}

function prefixParamInSignature(src, lineNo, name) {
  const lines = src.split('\n');
  const idx = lineNo - 1;
  for (let i = idx; i < Math.min(idx + 8, lines.length); i++) {
    const re = new RegExp(`\\b${name}\\b(?!\\s*:)`);
    if (re.test(lines[i]) && (lines[i].includes('function') || lines[i].includes('=>') || lines[i].includes('('))) {
      lines[i] = lines[i].replace(new RegExp(`\\b${name}\\b`), `_${name}`);
      return lines.join('\n');
    }
  }
  return src;
}

function renameBindingAtLine(src, lineNo, oldName, newName) {
  const lines = src.split('\n');
  const idx = lineNo - 1;
  if (idx < 0 || idx >= lines.length) return src;
  lines[idx] = lines[idx].replace(new RegExp(`\\b${oldName}\\b`), newName);
  return lines.join('\n');
}

function applyUnusedVarFix(src, issue) {
  const nameMatch = issue.message.match(/'([^']+)'/);
  if (!nameMatch) return src;
  const name = nameMatch[1];

  const lines = src.split('\n');
  const idx = issue.line - 1;
  const line = lines[idx] || '';

  const inImportBlock = /import\s*\{/.test(lines.slice(Math.max(0, idx - 5), idx + 1).join('\n'));
  if (issue.message.includes('imported') || /^\s*import\b/.test(line) || (line.includes(',') && idx > 0 && inImportBlock)) {
    const next = removeImportName(src, name.replace(/^_/, ''), issue.line);
    if (next !== src) return next;
    if (!name.startsWith('_')) {
      const next2 = removeImportName(src, name, issue.line);
      if (next2 !== src) return next2;
    }
  }

  if (issue.message.includes('Allowed unused args')) {
    return prefixParamInSignature(src, issue.line, name);
  }

  if (issue.message.includes('assigned a value but never used')) {
    if (name.startsWith('_')) return src;
    lines[idx] = line.replace(new RegExp(`\\b${name}\\b`), `_${name}`);
    return lines.join('\n');
  }

  if (issue.message.includes('is defined but never used')) {
    if (/^\s*(export\s+)?(async\s+)?function\s+/.test(line) || /^\s*function\s+/.test(line)) {
      const dead = removeDeadFunctionAt(src, issue.line, name.replace(/^_/, ''));
      if (dead !== src) return dead;
    }
    if (name.startsWith('_') && /^\s*function\s+/.test(line)) {
      const dead = removeDeadFunctionAt(src, issue.line, name);
      if (dead !== src) return dead;
    }
    if (line.includes('import ')) {
      const updated = removeImportName(src, name, issue.line);
      if (updated !== src) return updated;
    }
    const importTry = removeImportName(src, name, issue.line);
    if (importTry !== src) return importTry;
  }

  return src;
}

/** Scoped renames: [startLine, endLine] inclusive — only `\bname\b` in that range. */
const REDECLARE_SCOPED = [
  { file: 'public/js/features/lan/panel-diagnostics.mjs', start: 253, end: 270, old: 'pre', new: 'reportPre' },
  { file: 'public/js/features/lan/panel-diagnostics.mjs', start: 263, end: 268, old: 'hint', new: 'splitHintP' },
  { file: 'public/js/features/tendencias-render.mjs', start: 243, end: 285, old: 'fk', new: 'specFk' },
  { file: 'public/js/labs-cultivo-scan.mjs', start: 14, end: 28, old: 'i', new: 'ii' },
  { file: 'public/js/labs-fluidos-misc.mjs', start: 318, end: 323, old: 'j', new: 'jj' },
  { file: 'public/js/labs-fluidos-misc.mjs', start: 318, end: 323, old: 'v', new: 'vv' },
  { file: 'public/js/labs-fluidos-misc.mjs', start: 318, end: 323, old: 'm', new: 'mm' },
  { file: 'public/js/labs-gaso-section.mjs', start: 161, end: 165, old: 'raw', new: 'rowRaw' },
  { file: 'public/js/labs-gaso-section.mjs', start: 314, end: 318, old: 'idx', new: 'idxPie' },
  { file: 'public/js/labs-gaso-section.mjs', start: 314, end: 318, old: 'sub', new: 'subPie' },
  { file: 'public/js/labs-gaso-section.mjs', start: 314, end: 318, old: 'm', new: 'mPie' },
];

function applyScopedRenames(src, scoped) {
  const lines = src.split('\n');
  for (const fix of scoped) {
    const re = new RegExp(`\\b${fix.old}\\b`, 'g');
    for (let i = fix.start - 1; i < fix.end && i < lines.length; i++) {
      lines[i] = lines[i].replace(re, fix.new);
    }
  }
  return lines.join('\n');
}

function eslintJson(paths) {
  const result = spawnSync('npx', ['eslint', ...paths, '-f', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(result.stdout || '[]');
}

const TARGET_RULES = new Set([
  'no-empty',
  'no-useless-escape',
  'no-undef',
  'no-redeclare',
  'no-constant-condition',
  'no-unused-vars',
]);

const paths = collectPaths();
const sourceFiles = expandSourceFiles(paths);
const label = full ? 'full Tier 1' : 'changed';
console.log(`fix-mechanical-eslint (${label}): ${paths.length} path(s), ${sourceFiles.length} source file(s)`);

// Pass 1: no-empty catch blocks across tier1 source files
let catchFixCount = 0;
for (const rel of sourceFiles) {
  const before = readFileSync(rel, 'utf8');
  const after = fixNoEmptyCatchBlocks(before);
  if (after !== before) {
    writeFileSync(rel, after);
    catchFixCount++;
  }
}
console.log(`Pass 1: fixed empty catch blocks in ${catchFixCount} file(s)`);

// Pass 2: no-redeclare scoped renames
const redeclareFiles = [...new Set(REDECLARE_SCOPED.map((f) => f.file))];
for (const rel of redeclareFiles) {
  if (!existsSync(rel)) continue;
  const scoped = REDECLARE_SCOPED.filter((f) => f.file === rel);
  const src = readFileSync(rel, 'utf8');
  const next = applyScopedRenames(src, scoped);
  if (next !== src) writeFileSync(rel, next);
}
console.log('Pass 2: applied no-redeclare renames');

// Pass 3: no-constant-condition in labs-gaso-section.mjs
const gasoPath = 'public/js/labs-gaso-section.mjs';
if (existsSync(gasoPath)) {
  let gaso = readFileSync(gasoPath, 'utf8');
  gaso = gaso.replace(/^\s*if\s*\(\s*true\s*\)\s*return\s*'';/m, "  return '';");
  gaso = gaso.replace(
    /\s*if\s*\(\s*false\s*\)\s*\{[\s\S]*?\n\s*\}/m,
    '',
  );
  writeFileSync(gasoPath, gaso);
}
console.log('Pass 3: fixed no-constant-condition in labs-gaso-section.mjs');

// Pass 4–6: iterate eslint-driven fixes for escapes + unused vars
for (let pass = 0; pass < 5; pass++) {
  const data = eslintJson(paths);
  const byFile = new Map();
  for (const f of data) {
    const issues = f.messages.filter((m) => TARGET_RULES.has(m.ruleId));
    if (issues.length) byFile.set(f.filePath.replace(ROOT + '/', ''), issues);
  }

  let changed = 0;
  for (const [rel, issues] of byFile) {
    let src = readFileSync(rel, 'utf8');
    const orig = src;

    const empty = issues.filter((i) => i.ruleId === 'no-empty');
    if (empty.length) src = fixNoEmptyCatchBlocks(src);

    const escapes = issues.filter((i) => i.ruleId === 'no-useless-escape');
    if (escapes.length) src = fixUselessEscapes(src, escapes);

    const unused = issues.filter((i) => i.ruleId === 'no-unused-vars');
    for (const issue of unused) {
      src = applyUnusedVarFix(src, issue);
    }

    if (src !== orig) {
      writeFileSync(rel, src);
      changed++;
    }
  }
  console.log(`Pass ${4 + pass}: updated ${changed} file(s) from eslint issues`);
  if (!changed) break;
}

// Final report
const final = eslintJson(paths);
const byRule = {};
for (const f of final) {
  for (const m of f.messages) {
    if (!TARGET_RULES.has(m.ruleId)) continue;
    byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
  }
}
console.log('\nRemaining target issues:');
Object.entries(byRule)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${v}\t${k}`));
const total = Object.values(byRule).reduce((a, b) => a + b, 0);
console.log(`  TOTAL: ${total}`);

if (total > 0) {
  const leftovers = [];
  for (const f of final) {
    for (const m of f.messages) {
      if (!TARGET_RULES.has(m.ruleId)) continue;
      leftovers.push({
        file: f.filePath.replace(ROOT + '/', ''),
        line: m.line,
        rule: m.ruleId,
        msg: m.message,
      });
    }
  }
  writeFileSync('/tmp/eslint-leftovers.json', JSON.stringify(leftovers, null, 2));
  console.log(`Wrote ${leftovers.length} leftovers to /tmp/eslint-leftovers.json`);
}
