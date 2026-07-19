'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createWriteQueue } = require('./write-queue.js');

describe('write-queue', () => {
  it('runs jobs sequentially', async () => {
    const q = createWriteQueue();
    const order = [];
    await Promise.all([
      q.enqueue(async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 10));
      }),
      q.enqueue(async () => {
        order.push(2);
      }),
      q.enqueue(async () => {
        order.push(3);
      }),
    ]);
    assert.deepEqual(order, [1, 2, 3]);
  });
});
