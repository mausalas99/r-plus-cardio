/** Virtual scroll controller factory (extracted for max-lines budget). */
import {
  mountVirtualNode,
  pruneVirtualNodes,
  releaseVirtualNode,
  updateVisibleVirtualNodes,
} from './virtual-scroll-pool.mjs';
import { computeVisibleRange } from './virtual-scroll-range.mjs';

function createVirtualScrollApi(state) {
  const { container, inner, activeNodes, pool, itemHeight, releaseNode } = state;
  let { currentItems, rafId, range } = state;

  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderRange();
    });
  }

  function renderRange() {
    const next = computeVisibleRange({
      scrollTop: container.scrollTop,
      itemCount: currentItems.length,
      itemHeight,
      viewportHeight: container.clientHeight,
      overscan: state.overscan,
    });
    inner.style.height = `${next.totalHeight}px`;
    range = next;
    if (next.endIndex < next.startIndex) {
      for (const el of activeNodes.values()) releaseNode(el);
      activeNodes.clear();
      return;
    }
    pruneVirtualNodes(activeNodes, next, releaseNode);
    updateVisibleVirtualNodes({
      next, itemHeight, currentItems, activeNodes,
      mountNode: (index) => mountVirtualNode({
        index, itemHeight, currentItems, renderItem: state.renderItem,
        pool, inner, activeNodes,
      }),
    });
  }

  function onScroll() { scheduleRender(); }
  container.addEventListener('scroll', onScroll, { passive: true });
  renderRange();

  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', onScroll);
      for (const el of activeNodes.values()) releaseNode(el);
      activeNodes.clear();
      inner.remove();
    },
    updateItems(nextItems) {
      currentItems = nextItems;
      state.currentItems = nextItems;
      for (const el of activeNodes.values()) releaseNode(el);
      activeNodes.clear();
      scheduleRender();
    },
    scrollToIndex(index, behavior = 'auto') {
      const clamped = Math.max(0, Math.min(index, currentItems.length - 1));
      container.scrollTo({ top: clamped * itemHeight, behavior });
    },
    getVisibleRange() { return { ...range }; },
  };
}

export function createVirtualScrollController({
  container,
  items,
  estimateItemHeight,
  renderItem,
  overscan = 3,
}) {
  const itemHeight = estimateItemHeight;
  const activeNodes = new Map();
  const pool = [];
  const inner = document.createElement('div');
  inner.className = 'virtual-scroll-inner';
  inner.style.position = 'relative';
  inner.style.width = '100%';
  if (!container.style.overflow) container.style.overflow = 'auto';
  container.replaceChildren(inner);

  function releaseNode(el) { releaseVirtualNode(el, pool); }

  return createVirtualScrollApi({
    container, inner, activeNodes, pool, itemHeight, releaseNode,
    currentItems: items, renderItem, overscan, rafId: 0,
    range: { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 },
  });
}
