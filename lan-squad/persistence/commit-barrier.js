'use strict';

const { notifyFlushError, addWaiter, runPendingFlush } = require('./commit-barrier-flush.js');

/**
 * Coalesces durable host commits: many scheduleFlush() calls within coalesceMs
 * share one disk flush; all waiters resolve when completedGeneration reaches
 * their targetGeneration.
 */
function createCommitBarrier({ coalesceMs = 150, onError } = {}) {
  const ctx = {
    timer: null,
    flushing: false,
    waiters: [],
    pendingRun: null,
    followUpQueued: false,
    generation: 0,
    completedGeneration: 0,
  };

  function armTimer() {
    if (ctx.timer) clearTimeout(ctx.timer);
    ctx.timer = setTimeout(() => {
      ctx.timer = null;
      void runPendingFlush(ctx).catch((e) => notifyFlushError(onError, e));
    }, coalesceMs);
  }

  function scheduleFlush(runFn) {
    ctx.pendingRun = runFn;
    const target = ctx.generation + 1;
    if (ctx.flushing) {
      ctx.followUpQueued = true;
      return addWaiter(ctx.waiters, target);
    }
    armTimer();
    return addWaiter(ctx.waiters, target);
  }

  async function flushNow(runFn) {
    if (ctx.timer) {
      clearTimeout(ctx.timer);
      ctx.timer = null;
    }
    ctx.pendingRun = runFn;
    const target = ctx.generation + 1;
    const waiter = addWaiter(ctx.waiters, target);
    if (ctx.flushing) {
      ctx.followUpQueued = true;
      return waiter;
    }
    await runPendingFlush(ctx).catch((e) => notifyFlushError(onError, e));
    return waiter;
  }

  return { scheduleFlush, flushNow };
}

module.exports = { createCommitBarrier };
