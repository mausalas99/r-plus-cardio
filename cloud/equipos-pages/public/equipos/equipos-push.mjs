/** Web Push registration for equipos waitlist. */

import { isCloudEquiposMode } from '../lib/equipos/equipos-cloud-mode.mjs';
import { equiposFetch } from './equipos-api.mjs';
import {
  upsertPushSyncQueueEntry,
  removePushSyncQueueEntry,
  replacePushSyncQueues,
} from './equipos-push-store.mjs';

const SW_VERSION = 21;
const SW_PATH = '/equipos/sw.js';
const SW_SCOPE = '/equipos/';

/** @returns {{ url: string, scope: string }} */
export function equiposServiceWorkerConfig() {
  if (isCloudEquiposMode()) {
    return { url: `/equipos-sw.js?v=${SW_VERSION}`, scope: '/' };
  }
  return { url: `${SW_PATH}?v=${SW_VERSION}`, scope: SW_SCOPE };
}

let pushSubscribeActive = false;

/** @param {boolean} active */
export function markPushSubscribeActive(active) {
  pushSubscribeActive = !!active;
}

export function isPushSubscribeActive() {
  return pushSubscribeActive;
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '');
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isStandalonePwa() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true
  );
}

function scopeHref(scope) {
  return new URL(scope, location.origin).href;
}

function isEquiposServiceWorkerScript(scriptUrl) {
  const u = String(scriptUrl || '');
  return u.includes('/equipos/sw.js') || u.includes('/equipos-sw.js');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyBytesMatch(a, b) {
  if (!a || !b) return false;
  const aa = a instanceof Uint8Array ? a : new Uint8Array(a);
  const bb = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

export function pushSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  // iOS only delivers web push to home-screen PWAs (16.4+), not Safari tabs.
  if (isIosDevice() && !isStandalonePwa()) return false;
  return true;
}

/** Whether the user still needs to grant permission or register push. */
export function pushActivationNeeded() {
  if (isIosDevice() && !isStandalonePwa()) return true;
  if (!window.isSecureContext) return true;
  if (!pushSupported()) return false;
  if (Notification.permission !== 'granted') return true;
  return !pushSubscribeActive;
}

/** @returns {string} */
export function pushSetupHint() {
  if (isIosDevice() && !isStandalonePwa()) {
    return 'En iPhone, agrega R+ Cola a la pantalla de inicio (Safari → Compartir) para recibir avisos.';
  }
  if (!window.isSecureContext) {
    return 'Los avisos requieren HTTPS. Usa el enlace cloud del turno.';
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    if (isAndroidDevice()) {
      return 'Notificaciones bloqueadas. Ajustes → Apps → Chrome → Notificaciones → Permitir.';
    }
    return 'Notificaciones bloqueadas. Actívalas en Ajustes del teléfono → R+ Cola.';
  }
  if (Notification.permission === 'granted' && !pushSubscribeActive) {
    return 'Permiso concedido, pero falta registrar avisos. Pulsa «Activar avisos».';
  }
  return 'Pulsa «Activar avisos». Recibirás notificación aunque cierres la app o esté en segundo plano.';
}

async function migrateStaleServiceWorkerRegistrations() {
  const { url, scope } = equiposServiceWorkerConfig();
  const wantedScope = scopeHref(scope);
  const wantedScript = url.split('?')[0];
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  for (const reg of regs) {
    const script =
      reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
    if (!isEquiposServiceWorkerScript(script)) continue;
    if (reg.scope !== wantedScope || !script.includes(wantedScript.replace(/^\//, ''))) {
      try {
        await reg.unregister();
      } catch (_e) {
        void _e;
      }
    }
  }
}

async function waitForRegistrationReady(reg) {
  if (reg.active) return reg;
  const sw = reg.installing || reg.waiting;
  if (!sw) return reg;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sw_activate_timeout')), 8000);
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated' || sw.state === 'redundant') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return reg;
}

export async function registerEquiposServiceWorker() {
  if (!pushSupported()) return null;
  const { url, scope } = equiposServiceWorkerConfig();
  try {
    await migrateStaleServiceWorkerRegistrations();
    const reg = await navigator.serviceWorker.register(url, { scope });
    return waitForRegistrationReady(reg);
  } catch (_e) {
    return null;
  }
}

async function findEquiposServiceWorkerRegistration() {
  const { scope } = equiposServiceWorkerConfig();
  const wantedScope = scopeHref(scope);
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  return regs.find((reg) => reg.scope === wantedScope) || null;
}

async function getEquiposServiceWorkerRegistration() {
  if (!pushSupported()) return null;
  const existing = await findEquiposServiceWorkerRegistration();
  if (existing) return existing;
  return registerEquiposServiceWorker();
}

/** Refresh local flag from PushManager (no server round-trip). */
export async function refreshPushSubscribeState() {
  if (!pushSupported() || Notification.permission !== 'granted') {
    markPushSubscribeActive(false);
    return false;
  }
  const reg = await getEquiposServiceWorkerRegistration();
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  markPushSubscribeActive(!!sub);
  return !!sub;
}

/**
 * @param {string} apiBase
 * @param {string} token
 */
export async function fetchVapidPublicKey(apiBase, token) {
  try {
    const data = await equiposFetch(apiBase, token, '/push/vapid-public-key');
    return data.publicKey || null;
  } catch (_e) {
    return null;
  }
}

/**
 * @param {ServiceWorkerRegistration} reg
 * @param {string} publicKey
 */
async function subscribePush(reg, publicKey) {
  const appServerKey = urlBase64ToUint8Array(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const existingKey = sub.options?.applicationServerKey;
    if (existingKey && !keyBytesMatch(existingKey, appServerKey)) {
      try {
        await sub.unsubscribe();
      } catch (_e) {
        void _e;
      }
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }
  return sub;
}

/**
 * Activate push when user joins a device queue.
 * @param {object} opts
 * @param {string} opts.apiBase
 * @param {string} opts.token
 * @param {string} opts.deviceType
 * @param {string} opts.reporterName
 * @param {string} opts.rotation
 * @param {boolean} [opts.requestPermission] iOS requires a user gesture; skip on background resync
 */
export async function enableQueuePush(opts) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const shouldAsk = opts.requestPermission !== false;
  if (shouldAsk) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      markPushSubscribeActive(false);
      return { ok: false, reason: 'denied' };
    }
  } else if (Notification.permission !== 'granted') {
    markPushSubscribeActive(false);
    return { ok: false, reason: 'denied' };
  }

  const reg = await getEquiposServiceWorkerRegistration();
  if (!reg) {
    markPushSubscribeActive(false);
    return { ok: false, reason: 'no_sw' };
  }
  try {
    await waitForRegistrationReady(reg);
  } catch (_e) {
    void _e;
  }

  const publicKey = await fetchVapidPublicKey(opts.apiBase, opts.token);
  if (!publicKey) {
    markPushSubscribeActive(false);
    return { ok: false, reason: 'unconfigured' };
  }

  const sub = await subscribePush(reg, publicKey);
  const json = sub.toJSON();
  await equiposFetch(opts.apiBase, opts.token, '/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceType: opts.deviceType,
      reporterName: opts.reporterName,
      rotation: opts.rotation,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
  await upsertPushSyncQueueEntry({
    apiBase: opts.apiBase,
    token: opts.token,
    vapidPublicKey: publicKey,
    queue: {
      deviceType: opts.deviceType,
      reporterName: opts.reporterName,
      rotation: opts.rotation,
    },
  });
  markPushSubscribeActive(true);
  return { ok: true };
}

/**
 * Persist queue entries so the service worker can re-sync after pushsubscriptionchange
 * while the app is closed or backgrounded.
 * @param {object} opts
 */
export async function persistPushSyncFromBoard(opts) {
  if (!opts.queues?.length) {
    await replacePushSyncQueues({ ...opts, queues: [] });
    return;
  }
  const publicKey = opts.vapidPublicKey || (await fetchVapidPublicKey(opts.apiBase, opts.token));
  if (!publicKey) return;
  await replacePushSyncQueues({ ...opts, vapidPublicKey: publicKey, queues: opts.queues });
}

/**
 * @param {object} opts
 */
export async function disableQueuePush(opts) {
  if (!pushSupported()) return;
  const reg = await getEquiposServiceWorkerRegistration();
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (sub) {
    try {
      await equiposFetch(opts.apiBase, opts.token, '/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceType: opts.deviceType,
          reporterName: opts.reporterName,
          rotation: opts.rotation,
          endpoint: sub.endpoint,
        }),
      });
    } catch (_e) {
      void _e;
    }
  }
  await removePushSyncQueueEntry({
    deviceType: opts.deviceType,
    reporterName: opts.reporterName,
    rotation: opts.rotation,
  });
  await refreshPushSubscribeState();
}
