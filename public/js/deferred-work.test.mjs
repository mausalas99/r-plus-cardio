import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleAfterPaint, scheduleIdle, cancelDeferredIdleWork } from './deferred-work.mjs';

test('scheduleAfterPaint runs callback', async () => {
  let ran = false;
  scheduleAfterPaint(function () {
    ran = true;
  });
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  assert.equal(ran, true);
});

test('cancelDeferredIdleWork drops pending scheduleAfterPaint', async () => {
  let ran = false;
  scheduleAfterPaint(function () {
    ran = true;
  });
  cancelDeferredIdleWork();
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  assert.equal(ran, false);
});

test('scheduleIdle runs callback', async () => {
  let ran = false;
  scheduleIdle(function () {
    ran = true;
  });
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  assert.equal(ran, true);
});
