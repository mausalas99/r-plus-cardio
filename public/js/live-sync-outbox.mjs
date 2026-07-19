/** Cola offline de bundles/patches LiveSync por sala (SQLCipher IPC o localStorage). */

const OUTBOX_KEY = 'rpc-lan-sync-outbox';
const MAX_ITEMS_PER_ROOM = 50;

let _ipcFallbackLogged = false;

function getApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function readAll() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(map));
}

function enqueueLocal(roomId, item) {
  const rid = String(roomId || '').trim();
  if (!rid || !item || !item.payload) return;
  const all = readAll();
  const list = Array.isArray(all[rid]) ? all[rid].slice() : [];
  const kind =
    item.kind === 'delta'
      ? 'delta'
      : item.kind === 'patch'
        ? 'patch'
        : item.kind === 'clinical_ops'
          ? 'clinical_ops'
          : 'bundle';
  list.push({
    kind,
    payload: item.payload,
    enqueuedAt: item.enqueuedAt || new Date().toISOString(),
  });
  while (list.length > MAX_ITEMS_PER_ROOM) list.shift();
  all[rid] = list;
  writeAll(all);
}

function drainLocal(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return [];
  const all = readAll();
  const list = Array.isArray(all[rid]) ? all[rid].slice() : [];
  delete all[rid];
  writeAll(all);
  return list;
}

function sizeLocal(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return 0;
  const all = readAll();
  const list = all[rid];
  return Array.isArray(list) ? list.length : 0;
}

function logIpcFallbackOnce() {
  if (_ipcFallbackLogged) return;
  _ipcFallbackLogged = true;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[lan-outbox] DB IPC unavailable; using localStorage fallback');
  }
}

/**
 * @param {string} roomId
 * @param {{ kind: 'bundle'|'patch'|'clinical_ops'|'delta', payload: object, enqueuedAt?: string }} item
 */
export async function enqueueOutbox(roomId, item) {
  const api = getApi();
  if (api?.dbLanOutboxEnqueue) {
    return api.dbLanOutboxEnqueue({
      roomId,
      kind: item.kind,
      payload: item.payload,
    });
  }
  logIpcFallbackOnce();
  enqueueLocal(roomId, item);
}

/** @param {string} roomId @returns {Promise<object[]>} */
export async function drainOutbox(roomId) {
  const api = getApi();
  if (api?.dbLanOutboxDrain) {
    const res = await api.dbLanOutboxDrain({ roomId });
    if (res?.ok && Array.isArray(res.items)) return res.items;
    return [];
  }
  logIpcFallbackOnce();
  return drainLocal(roomId);
}

/** @param {string} roomId */
export async function outboxSize(roomId) {
  const api = getApi();
  if (api?.dbLanOutboxCount) {
    const res = await api.dbLanOutboxCount({ roomId });
    if (res?.ok && typeof res.count === 'number') return res.count;
    return 0;
  }
  return sizeLocal(roomId);
}

/** @param {string} roomId — localStorage only (tests/diagnostics). */
export function peekOutbox(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return [];
  const all = readAll();
  const list = all[rid];
  return Array.isArray(list) ? list.slice() : [];
}
