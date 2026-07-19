import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVisibleRange, createVirtualScroll } from './virtual-scroll.mjs';

test('computeVisibleRange — empty list', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 0,
      itemCount: 0,
      itemHeight: 56,
      viewportHeight: 200,
      overscan: 3,
    }),
    { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 }
  );
});

test('computeVisibleRange — top of list with overscan clamped at zero', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 0,
      itemCount: 20,
      itemHeight: 50,
      viewportHeight: 120,
      overscan: 3,
    }),
    { startIndex: 0, endIndex: 5, offsetTop: 0, totalHeight: 1000 }
  );
});

test('computeVisibleRange — middle of list includes overscan buffer', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 500,
      itemCount: 30,
      itemHeight: 50,
      viewportHeight: 100,
      overscan: 2,
    }),
    { startIndex: 8, endIndex: 13, offsetTop: 400, totalHeight: 1500 }
  );
});

test('computeVisibleRange — bottom of list clamps overscan', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 900,
      itemCount: 20,
      itemHeight: 50,
      viewportHeight: 100,
      overscan: 3,
    }),
    { startIndex: 15, endIndex: 19, offsetTop: 750, totalHeight: 1000 }
  );
});

test('computeVisibleRange — single item', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 0,
      itemCount: 1,
      itemHeight: 40,
      viewportHeight: 800,
      overscan: 3,
    }),
    { startIndex: 0, endIndex: 0, offsetTop: 0, totalHeight: 40 }
  );
});

test('computeVisibleRange — viewport taller than content', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 0,
      itemCount: 3,
      itemHeight: 30,
      viewportHeight: 500,
      overscan: 0,
    }),
    { startIndex: 0, endIndex: 2, offsetTop: 0, totalHeight: 90 }
  );
});

test('computeVisibleRange — negative scrollTop treated as zero', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: -50,
      itemCount: 10,
      itemHeight: 50,
      viewportHeight: 100,
      overscan: 0,
    }),
    { startIndex: 0, endIndex: 1, offsetTop: 0, totalHeight: 500 }
  );
});

test('computeVisibleRange — scrollTop beyond max still returns last items', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 9999,
      itemCount: 5,
      itemHeight: 50,
      viewportHeight: 100,
      overscan: 1,
    }),
    { startIndex: 2, endIndex: 4, offsetTop: 100, totalHeight: 250 }
  );
});

test('computeVisibleRange — zero overscan', () => {
  assert.deepEqual(
    computeVisibleRange({
      scrollTop: 150,
      itemCount: 10,
      itemHeight: 50,
      viewportHeight: 100,
      overscan: 0,
    }),
    { startIndex: 3, endIndex: 4, offsetTop: 150, totalHeight: 500 }
  );
});

test('createVirtualScroll — renders visible rows and pools nodes', () => {
  if (typeof document === 'undefined') return;

  const container = document.createElement('div');
  container.style.height = '120px';
  container.style.overflow = 'auto';
  Object.defineProperty(container, 'clientHeight', { value: 120, configurable: true });

  const items = Array.from({ length: 20 }, (_, i) => ({ id: i, label: `row-${i}` }));
  let renderCalls = 0;

  const vs = createVirtualScroll({
    container,
    items,
    estimateItemHeight: 50,
    overscan: 1,
    renderItem: ({ item, index, top }) => {
      renderCalls += 1;
      const el = document.createElement('div');
      el.className = 'row';
      el.textContent = item.label;
      el.dataset.index = String(index);
      el.dataset.top = String(top);
      return el;
    },
  });

  assert.equal(container.querySelector('.virtual-scroll-inner')?.style.height, '1000px');
  const rendered = [...container.querySelectorAll('.row')];
  assert.ok(rendered.length >= 3 && rendered.length <= 5);
  assert.ok(rendered.some((el) => el.dataset.index === '0'));

  const firstPassCalls = renderCalls;
  container.scrollTop = 500;
  container.dispatchEvent(new Event('scroll'));

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const afterScroll = [...container.querySelectorAll('.row')];
      assert.ok(afterScroll.some((el) => Number(el.dataset.index) >= 8));
      assert.ok(renderCalls > firstPassCalls);
      vs.destroy();
      assert.equal(container.querySelector('.virtual-scroll-inner'), null);
      resolve();
    });
  });
});
