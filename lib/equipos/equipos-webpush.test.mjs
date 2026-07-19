import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebPushRequest } from './equipos-webpush.mjs';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Synthetic browser-side subscription (UA ECDH keypair + auth secret). */
async function makeBrowserSubscription() {
  const uaKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const uaPublicRaw = new Uint8Array(await subtle.exportKey('raw', uaKeys.publicKey));
  const authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return {
    uaKeys,
    uaPublicRaw,
    authSecret,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      p256dh: base64UrlEncode(uaPublicRaw),
      auth: base64UrlEncode(authSecret),
    },
  };
}

async function makeVapidJwk() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  return { ...jwk, alg: 'ES256' };
}

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

/** Decrypt an aes128gcm push body exactly as a browser push service client would (RFC 8291). */
async function decryptAsBrowser(browser, body) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  assert.equal(idlen, 65, 'keyid must be the 65-byte AS public key');
  assert.ok(rs >= body.length - 21 - idlen, 'record size must cover the single record');
  const asPublicRaw = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);

  const asPublicKey = await subtle.importKey(
    'raw',
    asPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await subtle.deriveBits({ name: 'ECDH', public: asPublicKey }, browser.uaKeys.privateKey, 256)
  );
  const keyInfo = new Uint8Array([
    ...te.encode('WebPush: info\0'),
    ...browser.uaPublicRaw,
    ...asPublicRaw,
  ]);
  const ikm = await hkdf(browser.authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext)
  );
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  assert.equal(plain[end], 2, 'last record must use the 0x02 padding delimiter');
  return new TextDecoder().decode(plain.slice(0, end));
}

test('builds aes128gcm request the browser can decrypt back to the payload', async () => {
  const browser = await makeBrowserSubscription();
  const jwk = await makeVapidJwk();
  const payload = { title: 'Lumify libre', body: 'Es tu turno.', tag: 'lumify_return' };

  const req = await buildWebPushRequest(browser.subscription, payload, jwk);

  assert.equal(req.endpoint, browser.subscription.endpoint);
  assert.equal(req.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(req.headers['Content-Type'], 'application/octet-stream');
  assert.equal(req.headers.TTL, '86400');
  assert.equal(req.headers.Urgency, 'high');

  const text = await decryptAsBrowser(browser, req.body);
  assert.deepEqual(JSON.parse(text), payload);
});

test('accepts the private JWK as a JSON string (as stored in env vars)', async () => {
  const browser = await makeBrowserSubscription();
  const jwk = await makeVapidJwk();
  const req = await buildWebPushRequest(browser.subscription, { title: 'x' }, JSON.stringify(jwk));
  const text = await decryptAsBrowser(browser, req.body);
  assert.deepEqual(JSON.parse(text), { title: 'x' });
});

test('VAPID authorization carries a valid ES256 JWT for the endpoint origin', async () => {
  const browser = await makeBrowserSubscription();
  const jwk = await makeVapidJwk();
  const req = await buildWebPushRequest(browser.subscription, { title: 'x' }, jwk);

  const match = /^vapid t=([^,]+), k=(.+)$/.exec(req.headers.Authorization);
  assert.ok(match, 'Authorization must be `vapid t=<jwt>, k=<key>`');
  const [, jwt, k] = match;

  const [header, claims, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(base64UrlDecode(header))), {
    typ: 'JWT',
    alg: 'ES256',
  });
  const parsedClaims = JSON.parse(new TextDecoder().decode(base64UrlDecode(claims)));
  assert.equal(parsedClaims.aud, 'https://fcm.googleapis.com');
  // Apple rejects fake-TLD contacts (403 BadJwtToken); sub must be a real https/mailto URL.
  assert.equal(parsedClaims.sub, 'https://rmas-lista-de-espera.rmas-workersdev.workers.dev');
  assert.ok(parsedClaims.exp > Date.now() / 1000, 'exp must be in the future');
  assert.ok(parsedClaims.exp <= Date.now() / 1000 + 24 * 60 * 60, 'exp must be ≤ 24h');

  const publicKey = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const valid = await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    base64UrlDecode(signature),
    te.encode(`${header}.${claims}`)
  );
  assert.ok(valid, 'JWT signature must verify with the VAPID public key');

  // k= must be the uncompressed public point matching the JWK.
  const kBytes = base64UrlDecode(k);
  assert.equal(kBytes.length, 65);
  assert.equal(kBytes[0], 4);
  assert.deepEqual(kBytes.slice(1, 33), base64UrlDecode(jwk.x));
  assert.deepEqual(kBytes.slice(33, 65), base64UrlDecode(jwk.y));
});

test('rejects malformed subscription keys and JWKs', async () => {
  const browser = await makeBrowserSubscription();
  const jwk = await makeVapidJwk();

  await assert.rejects(
    buildWebPushRequest({ ...browser.subscription, p256dh: base64UrlEncode(new Uint8Array(31)) }, { title: 'x' }, jwk),
    /Invalid p256dh/
  );
  await assert.rejects(
    buildWebPushRequest({ ...browser.subscription, auth: base64UrlEncode(new Uint8Array(8)) }, { title: 'x' }, jwk),
    /Invalid auth/
  );
  await assert.rejects(
    buildWebPushRequest(browser.subscription, { title: 'x' }, { kty: 'EC', crv: 'P-256' }),
    /Invalid VAPID private JWK/
  );
});

test('rejects payloads over the 3993-byte plaintext budget', async () => {
  const browser = await makeBrowserSubscription();
  const jwk = await makeVapidJwk();
  const payload = { pad: 'x'.repeat(4000) };
  await assert.rejects(buildWebPushRequest(browser.subscription, payload, jwk), /too large/);
});
