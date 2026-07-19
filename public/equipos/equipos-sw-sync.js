/* Push re-subscribe while app is closed — importScripts from equipos/sw.js */

const PUSH_DB_NAME = 'equipos-push';
const PUSH_DB_VERSION = 1;
const PUSH_STORE = 'sync';
const PUSH_CONTEXT_KEY = 'context';

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

function readPushSyncContext() {
  return openPushDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(PUSH_STORE, 'readonly');
        const req = tx.objectStore(PUSH_STORE).get(PUSH_CONTEXT_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })
  );
}

function equiposApiUrl(apiBase, token, path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${String(apiBase).replace(/\/+$/, '')}/api/equipos/v1${path}${sep}t=${encodeURIComponent(token)}`;
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', 'X-Equipos-Token': String(token || '') };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function fetchVapidPublicKey(ctx) {
  return fetch(equiposApiUrl(ctx.apiBase, ctx.token, '/push/vapid-public-key'), {
    headers: authHeaders(ctx.token),
  })
    .then((res) => res.json().catch(() => ({})))
    .then((data) => data.publicKey || ctx.vapidPublicKey || '');
}

function postPushSubscribe(ctx, queue, subscription) {
  const json = subscription.toJSON();
  return fetch(equiposApiUrl(ctx.apiBase, ctx.token, '/push/subscribe'), {
    method: 'POST',
    headers: authHeaders(ctx.token),
    body: JSON.stringify({
      deviceType: queue.deviceType,
      reporterName: queue.reporterName,
      rotation: queue.rotation,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
}

function resubscribeAndSyncAll() {
  return readPushSyncContext().then(async (ctx) => {
    if (!ctx || !ctx.queues?.length) return;
    const reg = self.registration;
    let publicKey = ctx.vapidPublicKey || '';
    if (!publicKey) publicKey = await fetchVapidPublicKey(ctx);
    if (!publicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await Promise.all(ctx.queues.map((queue) => postPushSubscribe(ctx, queue, sub)));
  });
}

self.EquiposPushSync = { resubscribeAndSyncAll };
