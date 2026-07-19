/**
 * Web Push sender — RFC 8291 (aes128gcm) + RFC 8292 (VAPID).
 *
 * Self-contained WebCrypto implementation that runs on Cloudflare Workers and
 * Node (LAN server / scripts). Replaces @pushforge/builder, whose 2.x builds
 * requests with the legacy `aesgcm` draft encoding that modern Chrome/FCM
 * silently drops (FCM returns 201 but the SW `push` event never fires).
 */

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

/**
 * VAPID `sub` contact. Apple's push service (Safari/iOS PWA) validates this
 * claim and rejects invalid domains (e.g. `.local`) with 403 BadJwtToken;
 * FCM/Chrome does not. Must be a real `mailto:` or `https:` URL.
 */
const DEFAULT_ADMIN_CONTACT = 'https://rmas-lista-de-espera.rmas-workersdev.workers.dev';

/** Payload budget: 4096 push body − 86 header − 16 AEAD tag − 1 delimiter. */
const MAX_PLAINTEXT_BYTES = 3993;
const RECORD_SIZE = 4096;

/** @param {ArrayBuffer|Uint8Array} buf */
function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} value base64url or base64 */
function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** @param {Uint8Array[]} chunks */
function concatBytes(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * HKDF-SHA256 (extract + expand) via WebCrypto.
 * @param {Uint8Array} salt @param {Uint8Array} ikm @param {Uint8Array} info @param {number} length bytes
 */
async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** @param {object} jwk EC P-256 private JWK */
function publicKeyFromJwk(jwk) {
  const x = base64UrlDecode(jwk.x);
  const y = base64UrlDecode(jwk.y);
  return concatBytes([new Uint8Array([4]), x, y]);
}

/**
 * RFC 8292 VAPID `Authorization: vapid t=<jwt>, k=<pub>` header value.
 * @param {object} jwk EC P-256 private JWK
 * @param {string} endpoint push service URL (audience = origin)
 * @param {string} adminContact mailto: contact for the push service
 */
async function buildVapidAuthorization(jwk, endpoint, adminContact) {
  const header = base64UrlEncode(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(
    te.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: adminContact,
      })
    )
  );
  const signingInput = `${header}.${claims}`;
  const key = await subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    te.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  return `vapid t=${jwt}, k=${base64UrlEncode(publicKeyFromJwk(jwk))}`;
}

/**
 * RFC 8291 aes128gcm body: salt(16) | rs(4) | idlen(1) | as_public(65) | ciphertext.
 * @param {{ p256dh: string, auth: string }} keys subscription keys
 * @param {Uint8Array} plaintext
 */
async function encryptAes128Gcm(keys, plaintext) {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) {
    throw new Error(`Push payload too large: ${plaintext.length} > ${MAX_PLAINTEXT_BYTES} bytes`);
  }
  const uaPublicRaw = base64UrlDecode(keys.p256dh);
  const authSecret = base64UrlDecode(keys.auth);
  if (uaPublicRaw.length !== 65 || uaPublicRaw[0] !== 4) {
    throw new Error('Invalid p256dh subscription key');
  }
  if (authSecret.length !== 16) {
    throw new Error('Invalid auth subscription key');
  }

  const uaPublicKey = await subtle.importKey(
    'raw',
    uaPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const asKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const asPublicRaw = new Uint8Array(await subtle.exportKey('raw', asKeys.publicKey));
  const ecdhSecret = new Uint8Array(
    await subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeys.privateKey, 256)
  );

  const keyInfo = concatBytes([te.encode('WebPush: info\0'), uaPublicRaw, asPublicRaw]);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  // Single record: plaintext + 0x02 last-record padding delimiter.
  const padded = concatBytes([plaintext, new Uint8Array([2])]);
  const aesKey = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  const header = new Uint8Array(16 + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublicRaw.length;
  return concatBytes([header, asPublicRaw, ciphertext]);
}

/**
 * Build the HTTP request for one push message (exported for tests).
 * @param {object} subscription { endpoint, p256dh, auth }
 * @param {object} payload notification JSON for the service worker
 * @param {string|object} vapidPrivateJwk JSON JWK string or object
 * @param {object} [options] { ttl, urgency, adminContact }
 */
export async function buildWebPushRequest(subscription, payload, vapidPrivateJwk, options = {}) {
  const jwk = typeof vapidPrivateJwk === 'string' ? JSON.parse(vapidPrivateJwk) : vapidPrivateJwk;
  if (jwk?.kty !== 'EC' || jwk?.crv !== 'P-256' || !jwk?.d) {
    throw new Error('Invalid VAPID private JWK (need EC P-256 with d)');
  }
  const body = await encryptAes128Gcm(
    { p256dh: subscription.p256dh, auth: subscription.auth },
    te.encode(JSON.stringify(payload))
  );
  const authorization = await buildVapidAuthorization(
    jwk,
    subscription.endpoint,
    options.adminContact || DEFAULT_ADMIN_CONTACT
  );
  return {
    endpoint: subscription.endpoint,
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl ?? 86400),
      Urgency: options.urgency || 'high',
    },
    body,
  };
}

/**
 * @param {object} subscription
 * @param {string} subscription.endpoint
 * @param {string} subscription.p256dh
 * @param {string} subscription.auth
 * @param {object} payload Notification JSON for the service worker
 * @param {string|object} vapidPrivateJwk JSON JWK string or object
 */
export async function sendEquiposWebPush(subscription, payload, vapidPrivateJwk) {
  const { endpoint, headers, body } = await buildWebPushRequest(
    subscription,
    payload,
    vapidPrivateJwk,
    { ttl: 86400, urgency: 'high', adminContact: DEFAULT_ADMIN_CONTACT }
  );
  const res = await fetch(endpoint, { method: 'POST', headers, body });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
