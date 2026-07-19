import { normalizeEquiposDeviceType, normalizeEquiposRotation, normalizeReporterName } from './constants.js';
import { EquiposError } from './errors.js';
import {
  upsertPushSubscription,
  removePushSubscription,
  clearPushSubsForWaiter,
} from './push.js';

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} body */
async function assertInWaitlist(db, body) {
  const deviceType = normalizeEquiposDeviceType(body.deviceType);
  const name = normalizeReporterName(body.reporterName);
  const rot = normalizeEquiposRotation(body.rotation);
  if (!deviceType || !name || !rot) {
    throw new EquiposError('invalid_input', 'Datos inválidos.');
  }
  const row = await db
    .prepare(
      `SELECT 1 AS x FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(deviceType, name, rot)
    .first();
  if (!row) {
    throw new EquiposError('not_in_queue', 'Debes estar en la cola para activar notificaciones.');
  }
  return { deviceType, name, rot };
}

/**
 * @param {Request} req
 * @param {import('@cloudflare/workers-types').ExecutionContext} env
 * @param {object} body
 */
export async function handlePushSubscribe(req, env, body) {
  const db = env.DB;
  const { deviceType, name, rot } = await assertInWaitlist(db, body);
  const endpoint = String(body.endpoint || '').trim();
  const p256dh = String(body.p256dh || body.keys?.p256dh || '').trim();
  const auth = String(body.auth || body.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !auth) {
    throw new EquiposError('invalid_subscription', 'Suscripción push inválida.');
  }
  await clearPushSubsForWaiter(db, { deviceType, reporterName: name, rotation: rot });
  const out = await upsertPushSubscription(db, {
    endpoint,
    p256dh,
    auth,
    reporterName: name,
    rotation: rot,
    deviceType,
  });
  return { ok: true, ...out };
}

/** @param {import('@cloudflare/workers-types').ExecutionContext} env @param {object} body */
export async function handlePushUnsubscribe(env, body) {
  const db = env.DB;
  const deviceType = normalizeEquiposDeviceType(body.deviceType);
  const name = normalizeReporterName(body.reporterName);
  const rot = normalizeEquiposRotation(body.rotation);
  const endpoint = String(body.endpoint || '').trim();
  if (!deviceType || !name || !rot || !endpoint) {
    throw new EquiposError('invalid_input', 'Datos inválidos.');
  }
  const removed = await removePushSubscription(db, {
    endpoint,
    deviceType,
    reporterName: name,
    rotation: rot,
  });
  return { ok: true, removed };
}

/** @param {import('@cloudflare/workers-types').ExecutionContext} env @param {object} body */
export async function handlePushLeaveCleanup(env, body) {
  const db = env.DB;
  const deviceType = normalizeEquiposDeviceType(body.deviceType);
  const name = normalizeReporterName(body.reporterName);
  const rot = normalizeEquiposRotation(body.rotation);
  if (!deviceType || !name || !rot) return { ok: true };
  await clearPushSubsForWaiter(db, { deviceType, reporterName: name, rotation: rot });
  return { ok: true };
}

/** @param {import('@cloudflare/workers-types').ExecutionContext} env */
export function getVapidPublicKey(env) {
  const key = String(env.EQUIPOS_VAPID_PUBLIC_KEY || '').trim();
  if (!key) return null;
  return { ok: true, publicKey: key };
}
