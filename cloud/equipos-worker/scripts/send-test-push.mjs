#!/usr/bin/env node
/** Local dev: send one waitlist push using D1 subscription + .dev.vars VAPID. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sendEquiposWebPush } from '../../../lib/equipos/equipos-webpush.mjs';
import { buildEquiposPushPayload } from '../../../lib/equipos/equipos-push-messages.mjs';
import { EQUIPOS_PWA_CLOUD_URL } from '../../../lib/equipos/equipos-pwa-urls.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadVapidJwk() {
  const raw = readFileSync(join(root, '.dev.vars'), 'utf8');
  const line = raw.split('\n').find((l) => l.startsWith('EQUIPOS_VAPID_PRIVATE_JWK='));
  if (!line) throw new Error('EQUIPOS_VAPID_PRIVATE_JWK missing in .dev.vars');
  return line.slice('EQUIPOS_VAPID_PRIVATE_JWK='.length).trim();
}

function loadSubscription() {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'rplus-equipos',
      '--local',
      '--command',
      'SELECT endpoint, p256dh, auth, reporter_name FROM equipos_push_subscriptions LIMIT 1;',
      '--json',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const parsed = JSON.parse(out);
  const row = parsed?.[0]?.results?.[0];
  if (!row?.endpoint) throw new Error('No push subscription in local D1');
  return row;
}

const sub = loadSubscription();
const jwk = loadVapidJwk();
const payload = buildEquiposPushPayload('lumify_return', {
  deviceType: 'lumify',
  position: 1,
  isNext: true,
  chargePct: 80,
  appUrl: EQUIPOS_PWA_CLOUD_URL,
});

const result = await sendEquiposWebPush(sub, payload, jwk);
console.log(
  `[equipos-push-test] waiter=${sub.reporter_name} ok=${result.ok} status=${result.status} gone=${result.gone}`
);
