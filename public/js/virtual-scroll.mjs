/**
 * Fixed-height virtual scroll controller (vanilla DOM).
 * Renders only visible items + overscan; reuses nodes from an internal pool.
 */
import { createVirtualScrollController } from './virtual-scroll-controller.mjs';

export { computeVisibleRange } from './virtual-scroll-range.mjs';

export function createVirtualScroll(opts) {
  return createVirtualScrollController(opts);
}
