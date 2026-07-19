import { newEquiposId, normalizeEquiposDeviceType } from './constants.js';
import { buildEquiposPushPayload } from '../../../lib/equipos/equipos-push-messages.mjs';
import { EQUIPOS_PWA_CLOUD_URL } from '../../../lib/equipos/equipos-pwa-urls.mjs';
import { waitlistRowsForBypassNotify } from '../../../lib/equipos/equipos-queue-custody.mjs';
import { sendEquiposWebPush } from '../../../lib/equipos/equipos-webpush.mjs';

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType */
async function listWaitlistRows(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  const { results } = await db
    .prepare(
      `SELECT reporter_name, rotation, position FROM equipos_waitlist
       WHERE device_type = ? ORDER BY position ASC`
    )
    .bind(d)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType @param {string} name @param {string} rot */
async function listPushSubsForWaiter(db, deviceType, name, rot) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  const { results } = await db
    .prepare(
      `SELECT id, endpoint, p256dh, auth FROM equipos_push_subscriptions
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(d, name, rot)
    .all();
  return results || [];
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} subId */
async function deletePushSub(db, subId) {
  await db.prepare(`DELETE FROM equipos_push_subscriptions WHERE id = ?`).bind(subId).run();
}

/**
 * Send one payload to every subscription of a waiter, logging every outcome.
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Array<{id: string, endpoint: string, p256dh: string, auth: string}>} subs
 * @param {object} payload
 * @param {string} vapidPrivateJwk
 * @param {string} logCtx e.g. "lumify_return Sefagea s"
 */
async function sendPushToSubs(db, subs, payload, vapidPrivateJwk, logCtx) {
  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    try {
      const result = await sendEquiposWebPush(sub, payload, vapidPrivateJwk);
      if (result.gone) {
        await deletePushSub(db, sub.id);
        pruned += 1;
        console.warn(`[equipos-push] pruned gone sub (${result.status}) ${logCtx}`);
      } else if (result.ok) {
        sent += 1;
        console.log(`[equipos-push] sent ${result.status} ${logCtx}`);
      } else {
        console.error(`[equipos-push] send failed ${result.status} ${logCtx}`);
      }
    } catch (e) {
      console.error(`[equipos-push] send threw ${logCtx}:`, e?.message || e);
    }
  }
  return { sent, pruned };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function upsertPushSubscription(db, input) {
  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id FROM equipos_push_subscriptions WHERE endpoint = ? AND device_type = ?`)
    .bind(input.endpoint, input.deviceType)
    .first();

  if (existing?.id) {
    await db
      .prepare(
        `UPDATE equipos_push_subscriptions SET
          p256dh = ?, auth = ?, reporter_name = ?, rotation = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(input.p256dh, input.auth, input.reporterName, input.rotation, now, existing.id)
      .run();
    return { id: existing.id, updated: true };
  }

  const id = newEquiposId();
  await db
    .prepare(
      `INSERT INTO equipos_push_subscriptions (
        id, endpoint, p256dh, auth, reporter_name, rotation, device_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.endpoint,
      input.p256dh,
      input.auth,
      input.reporterName,
      input.rotation,
      input.deviceType,
      now,
      now
    )
    .run();
  return { id, updated: false };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function removePushSubscription(db, input) {
  const res = await db
    .prepare(
      `DELETE FROM equipos_push_subscriptions
       WHERE endpoint = ? AND device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(input.endpoint, input.deviceType, input.reporterName, input.rotation)
    .run();
  return (res.meta?.changes || 0) > 0;
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function clearPushSubsForWaiter(db, input) {
  await db
    .prepare(
      `DELETE FROM equipos_push_subscriptions
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(input.deviceType, input.reporterName, input.rotation)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {'device_available'|'lumify_return'|'malfunction'|'missing_material'|'waitlist_next'|'queue_bypass'} kind
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlist(db, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = await listWaitlistRows(db, ctx.deviceType);
  if (!waitlist.length) return { sent: 0, pruned: 0 };

  let sent = 0;
  let pruned = 0;

  for (let i = 0; i < waitlist.length; i++) {
    const row = waitlist[i];
    const isNext = i === 0;
    const payload = buildEquiposPushPayload(kind, {
      deviceType: ctx.deviceType,
      position: i + 1,
      isNext,
      chargePct: ctx.chargePct,
      message: ctx.message,
      appUrl: EQUIPOS_PWA_CLOUD_URL,
    });
    const subs = await listPushSubsForWaiter(db, ctx.deviceType, row.reporter_name, row.rotation);
    const out = await sendPushToSubs(db, subs, payload, vapidPrivateJwk, `${kind} ${row.reporter_name}`);
    sent += out.sent;
    pruned += out.pruned;
  }

  return { sent, pruned };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {'device_available'|'lumify_return'} kind
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistTopTwoKind(db, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) {
    console.warn(`[equipos-push] top-two ${kind} skipped: no VAPID private key`);
    return { sent: 0, pruned: 0 };
  }
  const waitlist = await listWaitlistRows(db, ctx.deviceType);
  console.log(`[equipos-push] top-two ${kind} ${ctx.deviceType} waitlist=${waitlist.length}`);
  if (!waitlist.length) return { sent: 0, pruned: 0 };

  let sent = 0;
  let pruned = 0;
  const limit = Math.min(2, waitlist.length);
  for (let i = 0; i < limit; i++) {
    const row = waitlist[i];
    const payload = buildEquiposPushPayload(kind, {
      deviceType: ctx.deviceType,
      position: i + 1,
      isNext: i === 0,
      chargePct: ctx.chargePct,
      message: ctx.message,
      appUrl: EQUIPOS_PWA_CLOUD_URL,
    });
    const subs = await listPushSubsForWaiter(db, ctx.deviceType, row.reporter_name, row.rotation);
    if (!subs.length) {
      console.log(`[equipos-push] top-two ${kind} ${row.reporter_name} (${row.rotation}) subs=0`);
      continue;
    }
    const out = await sendPushToSubs(db, subs, payload, vapidPrivateJwk, `${kind} ${row.reporter_name}`);
    sent += out.sent;
    pruned += out.pruned;
  }
  console.log(`[equipos-push] top-two ${kind} done sent=${sent} pruned=${pruned}`);
  return { sent, pruned };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {'device_available'|'lumify_return'} kind
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistHeadKind(db, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = await listWaitlistRows(db, ctx.deviceType);
  if (!waitlist.length) return { sent: 0, pruned: 0 };

  const row = waitlist[0];
  const payload = buildEquiposPushPayload(kind, {
    deviceType: ctx.deviceType,
    isNext: true,
    chargePct: ctx.chargePct,
    appUrl: EQUIPOS_PWA_CLOUD_URL,
  });
  const subs = await listPushSubsForWaiter(db, ctx.deviceType, row.reporter_name, row.rotation);
  return sendPushToSubs(db, subs, payload, vapidPrivateJwk, `${kind} ${row.reporter_name}`);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposQueueBypass(db, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const rows = waitlistRowsForBypassNotify(
    ctx.waitlistRows,
    ctx.takerName,
    ctx.takerRotation
  );
  if (!rows.length) return { sent: 0, pruned: 0 };

  let sent = 0;
  let pruned = 0;
  for (const row of rows) {
    const payload = buildEquiposPushPayload('queue_bypass', {
      deviceType: ctx.deviceType,
      takerName: ctx.takerName,
      takerRotation: ctx.takerRotation,
      appUrl: EQUIPOS_PWA_CLOUD_URL,
    });
    const subs = await listPushSubsForWaiter(db, ctx.deviceType, row.reporter_name, row.rotation);
    const out = await sendPushToSubs(db, subs, payload, vapidPrivateJwk, `queue_bypass ${row.reporter_name}`);
    sent += out.sent;
    pruned += out.pruned;
  }
  return { sent, pruned };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} deviceType
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistHead(db, deviceType, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = await listWaitlistRows(db, deviceType);
  if (!waitlist.length) return { sent: 0, pruned: 0 };

  const row = waitlist[0];
  const payload = buildEquiposPushPayload('waitlist_next', {
    deviceType,
    isNext: true,
    appUrl: EQUIPOS_PWA_CLOUD_URL,
  });
  const subs = await listPushSubsForWaiter(db, deviceType, row.reporter_name, row.rotation);
  return sendPushToSubs(db, subs, payload, vapidPrivateJwk, `waitlist_next ${row.reporter_name}`);
}

/**
 * Fire-and-forget push dispatch (never blocks API response in production).
 * Returns the task so local dev routes can await it (wrangler dev may drop waitUntil work).
 * @param {import('@cloudflare/workers-types').ExecutionContext} [execCtx]
 * @returns {Promise<unknown>}
 */
export function scheduleEquiposWaitlistHeadPush(db, execCtx, deviceType, vapidPrivateJwk) {
  const task = notifyEquiposWaitlistHead(db, deviceType, vapidPrivateJwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
  if (execCtx?.waitUntil) execCtx.waitUntil(task);
  return task;
}

/** @returns {Promise<unknown>} */
export function scheduleEquiposWaitlistTopTwoKindPush(db, execCtx, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) {
    console.warn('[equipos-push] skipped: EQUIPOS_VAPID_PRIVATE_JWK not set');
    return Promise.resolve();
  }
  const task = notifyEquiposWaitlistTopTwoKind(db, kind, ctx, vapidPrivateJwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
  if (execCtx?.waitUntil) execCtx.waitUntil(task);
  return task;
}

/** @returns {Promise<unknown>} */
export function scheduleEquiposQueueBypassPush(db, execCtx, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) {
    console.warn('[equipos-push] skipped: EQUIPOS_VAPID_PRIVATE_JWK not set');
    return Promise.resolve();
  }
  const task = notifyEquiposQueueBypass(db, ctx, vapidPrivateJwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
  if (execCtx?.waitUntil) execCtx.waitUntil(task);
  return task;
}

/**
 * Fire-and-forget push dispatch (never blocks API response in production).
 * @param {import('@cloudflare/workers-types').ExecutionContext} [execCtx]
 * @returns {Promise<unknown>}
 */
export function scheduleEquiposPush(db, execCtx, kind, ctx, vapidPrivateJwk) {
  const task = notifyEquiposWaitlist(db, kind, ctx, vapidPrivateJwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
  if (execCtx?.waitUntil) execCtx.waitUntil(task);
  return task;
}
