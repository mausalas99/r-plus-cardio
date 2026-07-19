import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleConflictsAreClinicalOpsOnly,
  pauseBundlePushForRoom,
  isBundlePushPaused,
} from './lan-sync-bundle-push.mjs';

describe('lan-sync-bundle-push', () => {
  it('detects clinicalOps-only conflict keys', () => {
    assert.equal(bundleConflictsAreClinicalOpsOnly([{ key: 'clinicalOps' }]), true);
    assert.equal(
      bundleConflictsAreClinicalOpsOnly([{ key: 'clinicalOps' }, { key: 'revision' }]),
      true
    );
    assert.equal(bundleConflictsAreClinicalOpsOnly([{ key: '*' }]), true);
    assert.equal(bundleConflictsAreClinicalOpsOnly([{ key: 'agenda' }]), false);
  });

  it('pauses push per room', () => {
    pauseBundlePushForRoom('sala-2', 5000);
    assert.equal(isBundlePushPaused('sala-2'), true);
    assert.equal(isBundlePushPaused('sala-1'), true);
  });
});
