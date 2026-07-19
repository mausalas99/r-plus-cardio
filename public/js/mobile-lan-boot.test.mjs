import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleMobileLanWork } from './mobile-lan-boot.mjs';

describe('mobile-lan-boot', () => {
  it('scheduleMobileLanWork runs fn without throw', async () => {
    let ran = false;
    scheduleMobileLanWork(function () {
      ran = true;
    });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(ran, true);
  });
});
