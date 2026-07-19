import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTier1Paths } from './changed-files.mjs';

test('filterTier1Paths keeps public/js and lib', () => {
  const paths = ['public/js/features/foo.mjs', 'README.md', 'lib/db/schema.mjs'];
  const out = filterTier1Paths(paths);
  assert.deepEqual(out.sort(), ['lib/db/schema.mjs', 'public/js/features/foo.mjs'].sort());
});
