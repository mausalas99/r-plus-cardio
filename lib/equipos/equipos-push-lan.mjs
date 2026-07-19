import { newEquiposId, normalizeEquiposDeviceType } from './equipos-constants.mjs';
import { buildEquiposPushPayload } from './equipos-push-messages.mjs';
import { EQUIPOS_PWA_LAN_URL } from './equipos-pwa-urls.mjs';
import { waitlistRowsForBypassNotify } from './equipos-queue-custody.mjs';
import { sendEquiposWebPush } from './equipos-webpush.mjs';

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} deviceType
 */
export function listWaitlistRowsSync(db, deviceType) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  return db
    .prepare(
      `SELECT reporter_name, rotation, position FROM equipos_waitlist
       WHERE device_type = ? ORDER BY position ASC`
    )
    .all(d);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} deviceType
 * @param {string} name
 * @param {string} rot
 */
export function listPushSubsForWaiterSync(db, deviceType, name, rot) {
  const d = normalizeEquiposDeviceType(deviceType);
  if (!d) return [];
  return db
    .prepare(
      `SELECT id, endpoint, p256dh, auth FROM equipos_push_subscriptions
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .all(d, name, rot);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} subId
 */
export function deletePushSubSync(db, subId) {
  db.prepare(`DELETE FROM equipos_push_subscriptions WHERE id = ?`).run(subId);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} input
 */
export function upsertPushSubscriptionSync(db, input) {
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id FROM equipos_push_subscriptions WHERE endpoint = ? AND device_type = ?`
    )
    .get(input.endpoint, input.deviceType);

  if (existing?.id) {
    db.prepare(
      `UPDATE equipos_push_subscriptions SET
        p256dh = ?, auth = ?, reporter_name = ?, rotation = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.p256dh, input.auth, input.reporterName, input.rotation, now, existing.id);
    return { id: existing.id, updated: true };
  }

  const id = newEquiposId();
  db.prepare(
    `INSERT INTO equipos_push_subscriptions (
      id, endpoint, p256dh, auth, reporter_name, rotation, device_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.endpoint,
    input.p256dh,
    input.auth,
    input.reporterName,
    input.rotation,
    input.deviceType,
    now,
    now
  );
  return { id, updated: false };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} input
 */
export function removePushSubscriptionSync(db, input) {
  const res = db
    .prepare(
      `DELETE FROM equipos_push_subscriptions
       WHERE endpoint = ? AND device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .run(input.endpoint, input.deviceType, input.reporterName, input.rotation);
  return res.changes > 0;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} deviceType
 * @param {string} reporterName
 * @param {string} rotation
 */
export function clearPushSubsForWaiterSync(db, deviceType, reporterName, rotation) {
  db.prepare(
    `DELETE FROM equipos_push_subscriptions
     WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
  ).run(deviceType, reporterName, rotation);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'device_available'|'lumify_return'|'malfunction'|'missing_material'|'waitlist_next'|'queue_bypass'} kind
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistSync(db, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = listWaitlistRowsSync(db, ctx.deviceType);
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
      appUrl: EQUIPOS_PWA_LAN_URL,
    });
    const subs = listPushSubsForWaiterSync(db, ctx.deviceType, row.reporter_name, row.rotation);
    for (const sub of subs) {
      try {
        const result = await sendEquiposWebPush(sub, payload, vapidPrivateJwk);
        if (result.gone) {
          deletePushSubSync(db, sub.id);
          pruned += 1;
        } else if (result.ok) {
          sent += 1;
        }
      } catch (_e) {
        void _e;
      }
    }
  }

  return { sent, pruned };
}

/**
 * Notify waitlist positions #1 and #2 when a device is returned / becomes available.
 * @param {import('better-sqlite3').Database} db
 * @param {'device_available'|'lumify_return'} kind
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistTopTwoKindSync(db, kind, ctx, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = listWaitlistRowsSync(db, ctx.deviceType);
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
      appUrl: EQUIPOS_PWA_LAN_URL,
    });
    const subs = listPushSubsForWaiterSync(db, ctx.deviceType, row.reporter_name, row.rotation);
    for (const sub of subs) {
      try {
        const result = await sendEquiposWebPush(sub, payload, vapidPrivateJwk);
        if (result.gone) {
          deletePushSubSync(db, sub.id);
          pruned += 1;
        } else if (result.ok) {
          sent += 1;
        }
      } catch (_e) {
        void _e;
      }
    }
  }
  return { sent, pruned };
}

/**
 * Alert everyone still in the waitlist that someone took the device out of turn.
 * @param {import('better-sqlite3').Database} db
 * @param {object} ctx
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposQueueBypassSync(db, ctx, vapidPrivateJwk) {
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
      appUrl: EQUIPOS_PWA_LAN_URL,
    });
    const subs = listPushSubsForWaiterSync(db, ctx.deviceType, row.reporter_name, row.rotation);
    for (const sub of subs) {
      try {
        const result = await sendEquiposWebPush(sub, payload, vapidPrivateJwk);
        if (result.gone) {
          deletePushSubSync(db, sub.id);
          pruned += 1;
        } else if (result.ok) {
          sent += 1;
        }
      } catch (_e) {
        void _e;
      }
    }
  }
  return { sent, pruned };
}

/**
 * Notify only the person at the front of the waitlist (e.g. after someone cedes turn).
 * @param {import('better-sqlite3').Database} db
 * @param {string} deviceType
 * @param {string} vapidPrivateJwk
 */
export async function notifyEquiposWaitlistHeadSync(db, deviceType, vapidPrivateJwk) {
  if (!vapidPrivateJwk) return { sent: 0, pruned: 0 };
  const waitlist = listWaitlistRowsSync(db, deviceType);
  if (!waitlist.length) return { sent: 0, pruned: 0 };

  const row = waitlist[0];
  const payload = buildEquiposPushPayload('waitlist_next', {
    deviceType,
    isNext: true,
    appUrl: EQUIPOS_PWA_LAN_URL,
  });
  let sent = 0;
  let pruned = 0;
  const subs = listPushSubsForWaiterSync(db, deviceType, row.reporter_name, row.rotation);
  for (const sub of subs) {
    try {
      const result = await sendEquiposWebPush(sub, payload, vapidPrivateJwk);
      if (result.gone) {
        deletePushSubSync(db, sub.id);
        pruned += 1;
      } else if (result.ok) {
        sent += 1;
      }
    } catch (_e) {
      void _e;
    }
  }
  return { sent, pruned };
}
