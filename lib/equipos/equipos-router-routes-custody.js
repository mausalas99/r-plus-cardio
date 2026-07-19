'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { broadcastEquipos } = require('./equipos-router-broadcast.js');
const { loadEquiposEsm } = require('./equipos-router-ws.js');
const { scheduleLanPush, scheduleLanWaitlistHeadPush, scheduleLanWaitlistTopTwoKindPush, scheduleLanQueueBypassPush } = require('./equipos-router-routes-push.js');

function createPostLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited', message: 'Demasiadas solicitudes.' }),
  });
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposReadRoutes(r, ctx) {
  r.get('/ping', async (_req, res) => {
    const db = ctx.getDb?.();
    let lease = null;
    if (db) {
      const mod = await loadEquiposEsm();
      const row = mod.getEquiposHostLease(db);
      if (row) {
        lease = { mode: row.mode, rank: row.holder_rank, hostUrl: row.host_url };
      }
    }
    res.json({ ok: true, equipos: true, lease });
  });

  r.get('/access/invite', async (_req, res) => {
    try {
      const db = ctx.getDb?.();
      if (!db) {
        return res.status(503).json({
          error: 'access_not_ready',
          message: 'Aún no hay enlace configurado.',
        });
      }
      const mod = await loadEquiposEsm();
      const row = mod.getEquiposProgramAccess(db);
      if (!row || row.is_active !== 1) {
        return res.status(403).json({
          error: 'access_inactive',
          message: 'La lista de espera no está activa.',
        });
      }
      const inviteToken = String(row.access_token || '').trim();
      if (!inviteToken) {
        return res.status(503).json({
          error: 'access_not_ready',
          message: 'Aún no hay enlace configurado.',
        });
      }
      res.json({ ok: true, token: inviteToken });
    } catch (e) {
      res.status(500).json({ error: 'error', message: e?.message || 'Error.' });
    }
  });

  r.get('/board', ctx.authEquipos, (req, res) => {
    const board = req.equiposMod.buildEquiposBoard(req.equiposDb);
    res.json({ ok: true, ...board });
  });

  r.get('/board/stamp', ctx.authEquipos, (req, res) => {
    const stamp = req.equiposMod.getBoardStampSync(req.equiposDb);
    res.json({ ok: true, stamp });
  });

  r.get('/reports', ctx.authEquipos, (req, res) => {
    const adminKey = String(req.headers['x-equipos-admin-key'] || '').trim();
    const expected = String(process.env.EQUIPOS_ADMIN_KEY || '').trim();
    if (!expected || adminKey !== expected) {
      return res.status(403).json({
        error: 'admin_required',
        message: 'Se requiere clave de administrador.',
      });
    }
    const since = req.equiposMod.equiposHistorySinceIso();
    const sessions = req.equiposMod.listEquiposSessionsPaged(req.equiposDb, { since, limit: 100 });
    const reports = req.equiposMod.listEquiposTeamReportsPaged(req.equiposDb, { since, limit: 100 });
    res.json({ ok: true, sessions, reports });
  });
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposCheckoutReturnRoutes(r, ctx, postLimiter, notifyBoard) {
  r.post('/checkout', postLimiter, express.json({ limit: '3mb' }), ctx.authEquipos, async (req, res) => {
    try {
      let pickupPhotoId = null;
      if (req.body?.photoBase64) {
        pickupPhotoId = await ctx.savePhotoFromBase64(req.body.photoBase64, {
          deviceType: req.body.deviceType,
          photoKind: 'pickup',
        });
      }
      const out = req.equiposMod.equiposCheckout(req.equiposDb, {
        deviceType: req.body.deviceType,
        reporterName: req.body.reporterName,
        rotation: req.body.rotation,
        pickupChargePct: req.body.pickupChargePct,
        pickupPhotoId,
        forceQueueBypass: !!req.body.forceQueueBypass,
      });
      if (out.queueBypassed && out.notifyWaitlist?.length) {
        void scheduleLanQueueBypassPush(req.equiposDb, {
          deviceType: out.deviceType,
          takerName: req.body.reporterName,
          takerRotation: req.body.rotation,
          waitlistRows: out.notifyWaitlist,
        });
      }
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/return', postLimiter, express.json({ limit: '3mb' }), ctx.authEquipos, async (req, res) => {
    try {
      let returnPhotoId = null;
      if (req.body?.photoBase64) {
        returnPhotoId = await ctx.savePhotoFromBase64(req.body.photoBase64, {
          deviceType: req.body.deviceType,
          photoKind: 'return',
        });
      }
      const out = req.equiposMod.equiposReturn(req.equiposDb, {
        deviceType: req.body.deviceType,
        reporterName: req.body.reporterName,
        rotation: req.body.rotation,
        chargePct: req.body.chargePct,
        gelEmpty: req.body.gelEmpty,
        returnPhotoId,
        adminForce: !!req.body.adminForce,
      });
      const returnKind = out.deviceType === 'lumify' ? 'lumify_return' : 'device_available';
      void scheduleLanWaitlistTopTwoKindPush(req.equiposDb, returnKind, {
        deviceType: out.deviceType,
        chargePct: req.body.chargePct != null ? Number(req.body.chargePct) : null,
      });
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposWaitlistRoutes(r, ctx, postLimiter, notifyBoard) {
  r.post('/waitlist/join', postLimiter, express.json({ limit: '16kb' }), ctx.authEquipos, (req, res) => {
    try {
      const out = req.equiposMod.equiposWaitlistJoin(req.equiposDb, req.body);
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/waitlist/leave', postLimiter, express.json({ limit: '16kb' }), ctx.authEquipos, async (req, res) => {
    try {
      req.equiposMod.equiposWaitlistLeave(req.equiposDb, req.body);
      const push = await import('./equipos-push-lan.mjs');
      const mod = req.equiposMod;
      const deviceType = mod.normalizeEquiposDeviceType(req.body?.deviceType);
      const name = mod.normalizeReporterName(req.body?.reporterName);
      const rot = mod.normalizeEquiposRotation(req.body?.rotation);
      if (deviceType && name && rot) {
        push.clearPushSubsForWaiterSync(req.equiposDb, deviceType, name, rot);
      }
      notifyBoard();
      res.json({ ok: true });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/waitlist/skip', postLimiter, express.json({ limit: '16kb' }), ctx.authEquipos, async (req, res) => {
    try {
      const out = req.equiposMod.equiposWaitlistSkip(req.equiposDb, req.body);
      const deviceType = req.equiposMod.normalizeEquiposDeviceType(req.body?.deviceType);
      if (out.wasNext && deviceType) {
        void scheduleLanWaitlistHeadPush(req.equiposDb, deviceType);
      }
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposCustodyRoutes(r, ctx) {
  const postLimiter = createPostLimiter();
  const notifyBoard = () => broadcastEquipos({ type: 'board-changed' });
  mountEquiposCheckoutReturnRoutes(r, ctx, postLimiter, notifyBoard);
  mountEquiposWaitlistRoutes(r, ctx, postLimiter, notifyBoard);
}

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function mountEquiposAlertRoutes(r, ctx) {
  const postLimiter = createPostLimiter();
  const notifyBoard = () => broadcastEquipos({ type: 'board-changed' });

  r.post('/alert', postLimiter, express.json({ limit: '3mb' }), ctx.authEquipos, async (req, res) => {
    try {
      let photoId = null;
      if (req.body?.photoBase64) {
        photoId = await ctx.savePhotoFromBase64(req.body.photoBase64, {
          deviceType: req.body.deviceType,
          photoKind: 'alert',
        });
      }
      const out = req.equiposMod.equiposCreateAlert(req.equiposDb, {
        deviceType: req.body.deviceType,
        reporterName: req.body.reporterName,
        rotation: req.body.rotation,
        kind: req.body.kind,
        message: req.body.message,
        photoId,
      });
      const alertKind = req.body.kind === 'malfunction' ? 'malfunction' : 'missing_material';
      void scheduleLanPush(req.equiposDb, alertKind, {
        deviceType: req.body.deviceType,
        message: req.body.message,
      });
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/alert/:id/ack', postLimiter, express.json({ limit: '16kb' }), ctx.authEquipos, (req, res) => {
    try {
      const reportRow = req.equiposDb
        .prepare(`SELECT device_type FROM equipos_team_reports WHERE id = ?`)
        .get(req.params.id);
      req.equiposMod.equiposAckAlert(req.equiposDb, req.params.id, req.body);
      if (reportRow?.device_type) {
        const dev = req.equiposMod.getEquiposDevice(req.equiposDb, reportRow.device_type);
        if (dev?.status === 'available') {
          void scheduleLanPush(req.equiposDb, 'device_available', {
            deviceType: reportRow.device_type,
          });
        }
      }
      notifyBoard();
      res.json({ ok: true });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

module.exports = { mountEquiposReadRoutes, mountEquiposCustodyRoutes, mountEquiposAlertRoutes, createPostLimiter };
