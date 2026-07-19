/** Visible range calculation for virtual scroll. */

export function computeVisibleRange({
  scrollTop,
  itemCount,
  itemHeight,
  viewportHeight,
  overscan,
}) {
  if (itemCount <= 0 || itemHeight <= 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 };
  }

  const totalHeight = itemCount * itemHeight;
  const maxScroll = Math.max(0, totalHeight - Math.max(0, viewportHeight));
  const safeScroll = Math.max(0, Math.min(scrollTop, maxScroll));
  const firstVisible = Math.min(itemCount - 1, Math.floor(safeScroll / itemHeight));
  const lastVisible = Math.min(
    itemCount - 1,
    Math.floor((safeScroll + Math.max(0, viewportHeight) - 1) / itemHeight)
  );

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(itemCount - 1, lastVisible + overscan);
  const offsetTop = startIndex * itemHeight;

  return { startIndex, endIndex, offsetTop, totalHeight };
}
