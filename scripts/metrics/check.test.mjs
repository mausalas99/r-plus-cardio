import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const METRICS_DIR = path.dirname(fileURLToPath(import.meta.url));

test('baseline.json is valid JSON when present', () => {
  const p = path.join(METRICS_DIR, 'baseline.json');
  const raw = fs.readFileSync(p, 'utf8');
  const o = JSON.parse(raw);
  assert.equal(o.version, 1);
});
