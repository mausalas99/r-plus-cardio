import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripVitalUnitSuffix } from './estado-actual-parse-variants.mjs';

test('stripVitalUnitSuffix — quita LPM y MMHG', () => {
  assert.equal(stripVitalUnitSuffix('113 LPM'), '113');
  assert.equal(stripVitalUnitSuffix('140/60 MMHG'), '140/60');
});
