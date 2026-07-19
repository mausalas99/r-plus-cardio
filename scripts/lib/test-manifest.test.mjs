/* global */
/**
 * CI drift guard: every *.test.mjs / *.test.js on disk must be present in
 * package.json → scripts.test, or explicitly quarantined in QUARANTINED.
 *
 * Fails with a human-readable list of missing paths so the fix is obvious.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listedTestFiles, testFilesOnDisk, QUARANTINED } from './test-manifest.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('every test file on disk is listed in package.json scripts.test (or quarantined)', () => {
  const listed = new Set(listedTestFiles(pkg));
  const onDisk = testFilesOnDisk(ROOT);
  const quarantined = new Set(QUARANTINED);

  const missing = onDisk.filter((f) => !listed.has(f) && !quarantined.has(f));

  assert.equal(
    missing.length,
    0,
    `${missing.length} test file(s) on disk are not in package.json scripts.test:\n` +
      missing.map((f) => `  ${f}`).join('\n') +
      '\n\nAdd them to the test list in package.json, or to QUARANTINED in scripts/lib/test-manifest.mjs.'
  );
});
