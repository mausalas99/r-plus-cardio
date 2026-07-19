'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

let pushLanMod = null;

function createPostLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited', message: 'Demasiadas solicitudes.' }),
  });
}

async function getPushLanMod() {
  if (!pushLanMod) {
    pushLanMod = await import('./equipos-push-lan.mjs');
  }
  return pushLanMod;
}

function getVapidPrivateJwk() {
  return String(process.env.EQUIPOS_VAPID_PRIVATE_JWK || '').trim();
}

function pushSubscriptionKeys(body) {
  const keys = body?.keys || {};
  return {
    endpoint: String(body?.endpoint || '').trim(),
    p256dh: String(body?.p256dh || keys.p256dh || '').trim(),
    auth: String(body?.auth || keys.auth || '').trim(),
  };
}

function parsePushSubscribeFields(mod, body) {
  const keys = pushSubscriptionKeys(body);
  return {
    deviceType: mod.normalizeEquiposDeviceType(body?.deviceType),
    name: mod.normalizeReporterName(body?.reporterName),
    rot: mod.normalizeEquiposRotation(body?.rotation),
    ...keys,
  };
}

function isReporterInEquiposWaitlist(db, deviceType, name, rot) {
  return !!db
    .prepare(
      `SELECT 1 AS x FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .get(deviceType, name, rot);
}

async function handlePushSubscribe(req, res, _ctx) {
  const push = await getPushLanMod();
  const mod = req.equiposMod;
  const fields = parsePushSubscribeFields(mod, req.body);
  if (!fields.deviceType || !fields.name || !fields.rot) {
    return res.status(400).json({ error: 'invalid_input', message: 'Datos inválidos.' });
  }
  if (!isReporterInEquiposWaitlist(req.equiposDb, fields.deviceType, fields.name, fields.rot)) {
    return res.status(400).json({
      error: 'not_in_queue',
      message: 'Debes estar en la cola para activar notificaciones.',
    });
  }
  if (!fields.endpoint || !fields.p256dh || !fields.auth) {
    return res.status(400).json({ error: 'invalid_subscription', message: 'Suscripción inválida.' });
  }
  push.clearPushSubsForWaiterSync(req.equiposDb, fields.deviceType, fields.name, fields.rot);
  const out = push.upsertPushSubscriptionSync(req.equiposDb, {
    endpoint: fields.endpoint,
    p256dh: fields.p256dh,
    auth: fields.auth,
    reporterName: fields.name,
    rotation: fields.rot,
    deviceType: fields.deviceType,
  });
  res.json({ ok: true, ...out });
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposPushRoutes(r, ctx) {
  const postLimiter = createPostLimiter();

  r.get('/push/vapid-public-key', (_req, res) => {
    const publicKey = String(process.env.EQUIPOS_VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) {
      return res.status(503).json({
        error: 'push_unconfigured',
        message: 'Notificaciones no configuradas en el anfitrión.',
      });
    }
    res.json({ ok: true, publicKey });
  });

  r.post('/push/subscribe', postLimiter, express.json({ limit: '8kb' }), ctx.authEquipos, async (req, res) => {
    try {
      await handlePushSubscribe(req, res, ctx);
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/push/unsubscribe', postLimiter, express.json({ limit: '8kb' }), ctx.authEquipos, async (req, res) => {
    try {
      const push = await getPushLanMod();
      const mod = req.equiposMod;
      const deviceType = mod.normalizeEquiposDeviceType(req.body?.deviceType);
      const name = mod.normalizeReporterName(req.body?.reporterName);
      const rot = mod.normalizeEquiposRotation(req.body?.rotation);
      const endpoint = String(req.body?.endpoint || '').trim();
      if (!deviceType || !name || !rot || !endpoint) {
        return res.status(400).json({ error: 'invalid_input', message: 'Datos inválidos.' });
      }
      const removed = push.removePushSubscriptionSync(req.equiposDb, {
        endpoint,
        deviceType,
        reporterName: name,
        rotation: rot,
      });
      res.json({ ok: true, removed });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'device_available'|'lumify_return'|'malfunction'|'missing_material'|'waitlist_next'|'queue_bypass'} kind
 * @param {object} pushCtx
 */
async function scheduleLanPush(db, kind, pushCtx) {
  const jwk = getVapidPrivateJwk();
  if (!jwk) return;
  const push = await getPushLanMod();
  void push.notifyEquiposWaitlistSync(db, kind, pushCtx, jwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'device_available'|'lumify_return'} kind
 * @param {object} pushCtx
 */
async function scheduleLanWaitlistTopTwoKindPush(db, kind, pushCtx) {
  const jwk = getVapidPrivateJwk();
  if (!jwk) {
    console.warn('[equipos-push] skipped return/waitlist push: EQUIPOS_VAPID_PRIVATE_JWK not set');
    return;
  }
  const push = await getPushLanMod();
  void push.notifyEquiposWaitlistTopTwoKindSync(db, kind, pushCtx, jwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} pushCtx
 */
async function scheduleLanQueueBypassPush(db, pushCtx) {
  const jwk = getVapidPrivateJwk();
  if (!jwk) return;
  const push = await getPushLanMod();
  void push.notifyEquiposQueueBypassSync(db, pushCtx, jwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} deviceType
 */
async function scheduleLanWaitlistHeadPush(db, deviceType) {
  const jwk = getVapidPrivateJwk();
  if (!jwk) return;
  const push = await getPushLanMod();
  void push.notifyEquiposWaitlistHeadSync(db, deviceType, jwk).catch((e) => {
    console.error('[equipos-push]', e?.message || e);
  });
}

module.exports = {
  mountEquiposPushRoutes,
  scheduleLanPush,
  scheduleLanWaitlistHeadPush,
  scheduleLanWaitlistTopTwoKindPush,
  scheduleLanQueueBypassPush,
  getVapidPrivateJwk,
};
