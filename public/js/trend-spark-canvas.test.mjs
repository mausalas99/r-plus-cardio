import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mountTrendSparkCanvas } from './trend-spark-canvas.mjs';

describe('trend-spark-canvas', () => {
  it('mountTrendSparkCanvas draws and updates without Chart.js', () => {
    const canvas = {
      width: 0,
      height: 0,
      clientWidth: 120,
      clientHeight: 40,
      getBoundingClientRect() {
        return { width: 120, height: 40 };
      },
      getContext() {
        const calls = [];
        return {
          calls: calls,
          setTransform() {},
          clearRect() {
            calls.push('clear');
          },
          scale() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          stroke() {},
          arc() {},
          fill() {},
        };
      },
    };
    const handle = mountTrendSparkCanvas(canvas, [1, 2, 3], '#0f0');
    assert.equal(typeof handle.update, 'function');
    handle.update([2, 4, 6], '#f00');
    handle.destroy();
  });
});
