#!/usr/bin/env node
/**
 * Diagnostic: send one push to a subscription stored in REMOTE D1 and print
 * the push service's full HTTP response (status + headers + body).
 * Apple (web.push.apple.com) returns a JSON body with a `reason` code on 4xx.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildWebPushRequest } from '../../../lib/equipos/equipos-webpush.mjs';
import { buildEquiposPushPayload } from '../../../lib/equipos/equipos-push-messages.mjs';
import { EQUIPOS_PWA_CLOUD_URL } from '../../../lib/equipos/equipos-pwa-urls.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadVapidJwk() {
  const raw = readFileSync(join(root, '.dev.vars'), 'utf8');
  const line = raw.split('\n').find((l) => l.startsWith('EQUIPOS_VAPID_PRIVATE_JWK='));
  if (!line) throw new Error('EQUIPOS_VAPID_PRIVATE_JWK missing in .dev.vars');
  return line.slice('EQUIPOS_VAPID_PRIVATE_JWK='.length).trim();
}

function loadRemoteSubscription() {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'rplus-equipos',
      '--remote',
      '--command',
      "SELECT endpoint, p256dh, auth, reporter_name FROM equipos_push_subscriptions WHERE endpoint LIKE 'https://web.push.apple.com%' LIMIT 1;",
      '--json',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const parsed = JSON.parse(out);
  const row = parsed?.[0]?.results?.[0];
  if (!row?.endpoint) throw new Error('No Apple push subscription in remote D1');
  return row;
}

const sub = loadRemoteSubscription();
const jwk = loadVapidJwk();
const payload = buildEquiposPushPayload('lumify_return', {
  deviceType: 'lumify',
  position: 1,
  isNext: true,
  chargePct: 80,
  appUrl: EQUIPOS_PWA_CLOUD_URL,
});

// Default adminContact (Apple-safe). NOTE: signs with the .dev.vars key — if that
// differs from the production keypair, Apple answers 400 VapidPkHashMismatch.
const { endpoint, headers, body } = await buildWebPushRequest(sub, payload, jwk, {
  ttl: 86400,
  urgency: 'high',
});

console.log(`[test-push-remote] waiter=${sub.reporter_name}`);
console.log(`[test-push-remote] endpoint=${endpoint.slice(0, 60)}…`);
const res = await fetch(endpoint, { method: 'POST', headers, body });
const text = await res.text().catch(() => '');
console.log(`[test-push-remote] status=${res.status}`);
console.log('[test-push-remote] response headers:');
for (const [k, v] of res.headers.entries()) console.log(`  ${k}: ${v}`);
console.log(`[test-push-remote] body: ${text || '(empty)'}`);
