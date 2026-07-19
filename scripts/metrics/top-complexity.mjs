#!/usr/bin/env node
/**
 * Rank ESLint complexity violations from JSON stdin.
 * Usage: npx eslint public/js lib lan-squad --format json | node scripts/metrics/top-complexity.mjs
 */
import { createInterface } from 'node:readline';

const COMPLEXITY_RULES = new Set([
  'complexity',
  'sonarjs/cognitive-complexity',
  'max-lines-per-function',
]);

async function readStdin() {
  const chunks = [];
  for await (const chunk of createInterface({ input: process.stdin })) {
    chunks.push(chunk);
  }
  return chunks.join('\n');
}

function relPath(filePath) {
  const cwd = process.cwd();
  return filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
}

function parseScore(message) {
  const m = String(message || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

const raw = await readStdin();
if (!raw.trim()) {
  console.error('No ESLint JSON on stdin');
  process.exit(1);
}

const results = JSON.parse(raw);
const hits = [];

for (const file of results) {
  const path = relPath(file.filePath || '');
  for (const msg of file.messages || []) {
    if (!COMPLEXITY_RULES.has(msg.ruleId)) continue;
    hits.push({
      path,
      line: msg.line,
      rule: msg.ruleId,
      score: parseScore(msg.message),
      message: msg.message,
    });
  }
}

hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

const limit = Number(process.env.TOP_N || 50);
console.log(`Top ${Math.min(limit, hits.length)} complexity hits (${hits.length} total):\n`);
for (const hit of hits.slice(0, limit)) {
  console.log(`${hit.score}\t${hit.rule}\t${hit.path}:${hit.line}`);
}
