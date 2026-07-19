'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { createAuthFailureLockout } = require('./auth-failure-lockout.js');

test('failures below threshold do not lock out', () => {
  let t = 1_000_000;
  const lockout = createAuthFailureLockout({
    maxFailures: 8,
    now: () => t,
  });

  for (let i = 0; i < 7; i += 1) {
    lockout.recordFailure();
  }

  assert.strictEqual(lockout.isLockedOut(), false);
  assert.strictEqual(lockout.getStatus().failures, 7);
  assert.strictEqual(lockout.getStatus().lockedUntil, null);
});

test('threshold reached triggers lockout', () => {
  let t = 2_000_000;
  const lockout = createAuthFailureLockout({
    maxFailures: 8,
    lockoutMs: 300_000,
    now: () => t,
  });

  for (let i = 0; i < 8; i += 1) {
    lockout.recordFailure();
  }

  assert.strictEqual(lockout.isLockedOut(), true);
  assert.strictEqual(lockout.getStatus().lockedUntil, t + 300_000);
});

test('lockout expires after lockoutMs', () => {
  let t = 3_000_000;
  const lockout = createAuthFailureLockout({
    maxFailures: 3,
    lockoutMs: 60_000,
    now: () => t,
  });

  for (let i = 0; i < 3; i += 1) {
    lockout.recordFailure();
  }
  assert.strictEqual(lockout.isLockedOut(), true);

  t += 60_000;
  assert.strictEqual(lockout.isLockedOut(), false);
  assert.strictEqual(lockout.getStatus().failures, 0);
  assert.strictEqual(lockout.getStatus().lockedUntil, null);
});

test('recordSuccess resets counter and lockout', () => {
  let t = 4_000_000;
  const lockout = createAuthFailureLockout({
    maxFailures: 8,
    lockoutMs: 300_000,
    now: () => t,
  });

  for (let i = 0; i < 8; i += 1) {
    lockout.recordFailure();
  }
  assert.strictEqual(lockout.isLockedOut(), true);

  lockout.recordSuccess();
  assert.strictEqual(lockout.isLockedOut(), false);
  assert.strictEqual(lockout.getStatus().failures, 0);
  assert.strictEqual(lockout.getStatus().lockedUntil, null);
});

test('failures outside windowMs do not accumulate', () => {
  let t = 5_000_000;
  const lockout = createAuthFailureLockout({
    maxFailures: 8,
    lockoutMs: 300_000,
    windowMs: 600_000,
    now: () => t,
  });

  for (let i = 0; i < 7; i += 1) {
    lockout.recordFailure();
  }
  assert.strictEqual(lockout.getStatus().failures, 7);

  t += 601_000;
  lockout.recordFailure();
  assert.strictEqual(lockout.getStatus().failures, 1);
  assert.strictEqual(lockout.isLockedOut(), false);
});
