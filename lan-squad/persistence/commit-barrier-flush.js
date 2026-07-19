'use strict';

function notifyFlushError(onError, err) {
  if (onError) onError(err);
}

function settleWaiters(waiters, completedGeneration, err) {
  const staying = [];
  for (const w of waiters) {
    if (err) w.reject(err);
    else if (completedGeneration >= w.target) w.resolve();
    else staying.push(w);
  }
  return staying;
}

function addWaiter(waiters, target) {
  return new Promise((resolve, reject) => {
    waiters.push({ target, resolve, reject });
  });
}

async function runPendingFlush(ctx) {
  if (ctx.flushing) {
    ctx.followUpQueued = true;
    return;
  }
  if (!ctx.pendingRun) return;

  ctx.flushing = true;
  const runFn = ctx.pendingRun;
  ctx.pendingRun = null;
  if (ctx.timer) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
  }

  try {
    await runFn();
    ctx.generation += 1;
    ctx.completedGeneration = ctx.generation;
    ctx.waiters = settleWaiters(ctx.waiters, ctx.completedGeneration, null);
  } catch (e) {
    ctx.waiters = settleWaiters(ctx.waiters, ctx.completedGeneration, e);
    throw e;
  } finally {
    ctx.flushing = false;
    if (ctx.followUpQueued && ctx.pendingRun) {
      ctx.followUpQueued = false;
      await runPendingFlush(ctx);
    } else {
      ctx.followUpQueued = false;
    }
  }
}

module.exports = { notifyFlushError, settleWaiters, addWaiter, runPendingFlush };
