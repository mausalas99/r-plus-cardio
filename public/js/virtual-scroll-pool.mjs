/** DOM node pool helpers for virtual-scroll (extracted for max-lines budget). */

export function releaseVirtualNode(el, pool) {
  el.replaceChildren();
  el.removeAttribute('data-virtual-index');
  el.remove();
  pool.push(el);
}

export function copyRenderedNode(target, source) {
  target.replaceChildren(...source.childNodes);
  target.className = source.className;
  for (const attr of source.attributes) {
    target.setAttribute(attr.name, attr.value);
  }
  source.remove();
  return target;
}

export function mountVirtualNode({
  index,
  itemHeight,
  currentItems,
  renderItem,
  pool,
  inner,
  activeNodes,
}) {
  const top = index * itemHeight;
  const rendered = renderItem({ item: currentItems[index], index, top });
  const pooled = pool.pop();
  const el = pooled ? copyRenderedNode(pooled, rendered) : rendered;
  el.style.position = 'absolute';
  el.style.top = `${top}px`;
  el.style.left = '0';
  el.style.right = '0';
  el.style.boxSizing = 'border-box';
  el.dataset.virtualIndex = String(index);
  inner.appendChild(el);
  activeNodes.set(index, el);
  return el;
}

export function pruneVirtualNodes(activeNodes, next, releaseNode) {
  for (const [index, el] of activeNodes) {
    if (index < next.startIndex || index > next.endIndex) {
      activeNodes.delete(index);
      releaseNode(el);
    }
  }
}

export function updateVisibleVirtualNodes({
  next,
  itemHeight,
  currentItems: _currentItems,
  activeNodes,
  mountNode,
}) {
  for (let i = next.startIndex; i <= next.endIndex; i += 1) {
    const top = i * itemHeight;
    const existing = activeNodes.get(i);
    if (existing) {
      existing.style.top = `${top}px`;
      continue;
    }
    mountNode(i);
  }
}
