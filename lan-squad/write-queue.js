'use strict';

function createWriteQueue() {
  let chain = Promise.resolve();
  function enqueue(fn) {
    const run = chain.then(() => fn());
    chain = run.catch(() => {});
    return run;
  }
  return { enqueue };
}

module.exports = { createWriteQueue };
