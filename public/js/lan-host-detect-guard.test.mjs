import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AUTO_HOST_DETECT_ATTEMPTS,
  canAttemptAutoHostDetect,
  isAutoHostDetectPaused,
  recordAutoHostDetectMiss,
  recordAutoHostDetectSuccess,
  resumeAutoHostDetect,
} from './lan-host-detect-guard.mjs';

describe('lan-host-detect-guard', () => {
  beforeEach(() => {
    resumeAutoHostDetect();
  });

  it('allows attempts until MAX misses', () => {
    for (let i = 0; i < MAX_AUTO_HOST_DETECT_ATTEMPTS - 1; i += 1) {
      assert.equal(canAttemptAutoHostDetect(), true);
      recordAutoHostDetectMiss();
    }
    assert.equal(canAttemptAutoHostDetect(), true);
    recordAutoHostDetectMiss();
    assert.equal(isAutoHostDetectPaused(), true);
    assert.equal(canAttemptAutoHostDetect(), false);
  });

  it('resumes after success or explicit resume', () => {
    for (let i = 0; i < MAX_AUTO_HOST_DETECT_ATTEMPTS; i += 1) {
      recordAutoHostDetectMiss();
    }
    assert.equal(isAutoHostDetectPaused(), true);
    recordAutoHostDetectSuccess();
    assert.equal(canAttemptAutoHostDetect(), true);
    for (let j = 0; j < MAX_AUTO_HOST_DETECT_ATTEMPTS; j += 1) {
      recordAutoHostDetectMiss();
    }
    resumeAutoHostDetect();
    assert.equal(canAttemptAutoHostDetect(), true);
  });
});
