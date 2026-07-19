'use strict';

function createAuthFailureLockout({
  maxFailures = 8,
  lockoutMs = 5 * 60 * 1000,
  windowMs = 10 * 60 * 1000,
  now = Date.now,
} = {}) {
  let failures = 0;
  let windowStart = null;
  let lockedUntil = null;

  function currentNow() {
    return now();
  }

  function clearExpiredLockout() {
    const t = currentNow();
    if (lockedUntil != null && t >= lockedUntil) {
      lockedUntil = null;
      failures = 0;
      windowStart = null;
    }
  }

  function isLockedOut() {
    clearExpiredLockout();
    const t = currentNow();
    return lockedUntil != null && t < lockedUntil;
  }

  function recordFailure() {
    if (isLockedOut()) return;

    const t = currentNow();
    if (windowStart == null || t - windowStart > windowMs) {
      failures = 0;
      windowStart = t;
    }

    failures += 1;
    if (failures >= maxFailures) {
      lockedUntil = t + lockoutMs;
    }
  }

  function recordSuccess() {
    failures = 0;
    windowStart = null;
    lockedUntil = null;
  }

  function getStatus() {
    clearExpiredLockout();
    return { failures, lockedUntil };
  }

  return { isLockedOut, recordFailure, recordSuccess, getStatus };
}

module.exports = { createAuthFailureLockout };
