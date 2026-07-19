/** IndexedDB push sync context — shared schema with equipos-sw-sync.js (service worker). */

export const PUSH_DB_NAME = 'equipos-push';
export const PUSH_DB_VERSION = 1;
export const PUSH_STORE = 'sync';
export const PUSH_CONTEXT_KEY = 'context';

/** @typedef {{ deviceType: string, reporterName: string, rotation: string }} PushQueueEntry */

/**
 * @typedef {object} PushSyncContext
 * @property {string} apiBase
 * @property {string} token
 * @property {string} vapidPublicKey
 * @property {PushQueueEntry[]} queues
 */

function openPushDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB_NAME, PUSH_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PUSH_STORE)) {
        req.result.createObjectStore(PUSH_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

/** @returns {Promise<PushSyncContext|null>} */
export async function readPushSyncContext() {
  const db = await openPushDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PUSH_STORE, 'readonly');
    const req = tx.objectStore(PUSH_STORE).get(PUSH_CONTEXT_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** @param {PushSyncContext|null} ctx */
export async function writePushSyncContext(ctx) {
  const db = await openPushDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PUSH_STORE, 'readwrite');
    if (ctx) tx.objectStore(PUSH_STORE).put(ctx, PUSH_CONTEXT_KEY);
    else tx.objectStore(PUSH_STORE).delete(PUSH_CONTEXT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** @param {PushQueueEntry} a @param {PushQueueEntry} b */
function queueEntryKey(a, b) {
  return (
    a.deviceType === b.deviceType &&
    a.reporterName === b.reporterName &&
    a.rotation === b.rotation
  );
}

/**
 * @param {object} input
 * @param {string} input.apiBase
 * @param {string} input.token
 * @param {string} input.vapidPublicKey
 * @param {PushQueueEntry} input.queue
 */
export async function upsertPushSyncQueueEntry(input) {
  const ctx = (await readPushSyncContext()) || {
    apiBase: input.apiBase,
    token: input.token,
    vapidPublicKey: input.vapidPublicKey,
    queues: [],
  };
  ctx.apiBase = input.apiBase;
  ctx.token = input.token;
  ctx.vapidPublicKey = input.vapidPublicKey || ctx.vapidPublicKey;
  const queues = ctx.queues.filter((q) => !queueEntryKey(q, input.queue));
  queues.push(input.queue);
  ctx.queues = queues;
  await writePushSyncContext(ctx);
}

/** @param {PushQueueEntry} queue */
export async function removePushSyncQueueEntry(queue) {
  const ctx = await readPushSyncContext();
  if (!ctx) return;
  ctx.queues = ctx.queues.filter((q) => !queueEntryKey(q, queue));
  if (!ctx.queues.length) await writePushSyncContext(null);
  else await writePushSyncContext(ctx);
}

/**
 * Replace queue list (e.g. after board refresh).
 * @param {object} input
 * @param {string} input.apiBase
 * @param {string} input.token
 * @param {string} input.vapidPublicKey
 * @param {PushQueueEntry[]} input.queues
 */
export async function replacePushSyncQueues(input) {
  if (!input.queues.length) {
    await writePushSyncContext(null);
    return;
  }
  await writePushSyncContext({
    apiBase: input.apiBase,
    token: input.token,
    vapidPublicKey: input.vapidPublicKey,
    queues: input.queues,
  });
}
