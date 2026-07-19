'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { broadcastEquipos } = require('./equipos-router-broadcast.js');
const { createPostLimiter } = require('./equipos-router-routes-custody.js');
const { scheduleLanPush } = require('./equipos-router-routes-push.js');

/**
 * @param {object} r express Router
 * @param {object} ctx
 */
function requireEquiposAdminKey(req, res) {
  const adminKey = String(req.headers['x-equipos-admin-key'] || '').trim();
  const expected = String(process.env.EQUIPOS_ADMIN_KEY || '').trim();
  if (!expected || adminKey !== expected) {
    res.status(403).json({
      error: 'admin_required',
      message: 'Se requiere clave de administrador.',
    });
    return false;
  }
  return true;
}

async function parseAdminHistoryQuery(req) {
  const mod = await require('./equipos-router-ws.js').loadEquiposEsm();
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || mod.EQUIPOS_ADMIN_HISTORY_DAYS));
  const since = mod.equiposHistorySinceIso(days);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || mod.EQUIPOS_ADMIN_PAGE_SIZE));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  return { mod, days, since, limit, offset };
}

function mountEquiposAdminHistoryRoutes(r, ctx) {
  r.get('/admin/sessions', ctx.authEquipos, async (req, res) => {
    if (!requireEquiposAdminKey(req, res)) return;
    try {
      const { mod, days, since, limit, offset } = await parseAdminHistoryQuery(req);
      const sessions = mod.listEquiposSessionsPaged(req.equiposDb, {
        since,
        limit,
        offset,
        deviceType: req.query.device,
      });
      const total = mod.countEquiposSessions(req.equiposDb, { since, deviceType: req.query.device });
      res.json({ ok: true, sessions, total, since, days, limit, offset });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.get('/admin/reports-list', ctx.authEquipos, async (req, res) => {
    if (!requireEquiposAdminKey(req, res)) return;
    try {
      const { mod, days, since, limit, offset } = await parseAdminHistoryQuery(req);
      const reports = mod.listEquiposTeamReportsPaged(req.equiposDb, {
        since,
        limit,
        offset,
        deviceType: req.query.device,
      });
      const total = mod.countEquiposTeamReports(req.equiposDb, { since, deviceType: req.query.device });
      res.json({ ok: true, reports, total, since, days, limit, offset });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.get('/admin/people', ctx.authEquipos, async (req, res) => {
    if (!requireEquiposAdminKey(req, res)) return;
    try {
      const { mod, days, since } = await parseAdminHistoryQuery(req);
      const people = mod.listEquiposPeopleSummary(req.equiposDb, { since });
      res.json({ ok: true, people, since, days });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

function mountEquiposAdminPhotoRoute(r, ctx) {
  r.get('/photos/:id', ctx.authEquipos, (req, res) => {
    const headerKey = String(req.headers['x-equipos-admin-key'] || '').trim();
    const queryKey = String(req.query.ak || '').trim();
    const expected = String(process.env.EQUIPOS_ADMIN_KEY || '').trim();
    const adminKey = headerKey || queryKey;
    if (expected && adminKey === expected) {
      const row = req.equiposMod.getEquiposPhoto(req.equiposDb, req.params.id);
      if (!row || !fs.existsSync(row.file_path)) {
        return res.status(404).json({ error: 'not_found', message: 'Foto no encontrada.' });
      }
      return res.sendFile(path.resolve(row.file_path));
    }
    const row = req.equiposMod.getEquiposPhoto(req.equiposDb, req.params.id);
    if (!row || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'not_found', message: 'Foto no encontrada.' });
    }
    res.sendFile(path.resolve(row.file_path));
  });
}

function mountEquiposAdminHostRoutes(r, ctx, postLimiter, notifyBoard) {
  r.post('/host/promote-temporary', postLimiter, express.json({ limit: '8kb' }), ctx.authEquipos, (req, res) => {
    try {
      const lease = req.equiposMod.promoteEquiposTemporaryHost(req.equiposDb, {
        hostUrl: req.body.hostUrl,
        holderUserId: req.body.holderUserId,
        holderRank: req.body.holderRank,
        holderName: req.body.holderName,
        rememberedPrimaryUrl: req.body.rememberedPrimaryUrl,
      });
      notifyBoard();
      broadcastEquipos({ type: 'equipos:host-handoff', hostUrl: req.body.hostUrl });
      res.json({ ok: true, lease });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/host/merge', postLimiter, express.json({ limit: '512kb' }), ctx.authEquipos, (req, res) => {
    try {
      const out = req.equiposMod.mergeEquiposStateFromSnapshot(req.equiposDb, req.body.snapshot);
      req.equiposMod.clearEquiposTemporaryHost(req.equiposDb);
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

function mountEquiposAdminRoutes(r, ctx) {
  const postLimiter = createPostLimiter();
  const notifyBoard = () => broadcastEquipos({ type: 'board-changed' });

  mountEquiposAdminHistoryRoutes(r, ctx);
  mountEquiposAdminPhotoRoute(r, ctx);
  mountEquiposAdminHostRoutes(r, ctx, postLimiter, notifyBoard);

  r.post('/admin/purge-queue', postLimiter, express.json({ limit: '8kb' }), ctx.authEquipos, (req, res) => {
    try {
      const out = req.equiposMod.equiposAdminPurgeQueue(req.equiposDb, {
        deviceType: req.body.deviceType || 'all',
        adminUserId: req.body.adminUserId,
        adminName: req.body.adminName,
      });
      for (const row of out) {
        if (row.hadCustody || row.cleared > 0) {
          void scheduleLanPush(req.equiposDb, 'device_available', { deviceType: row.deviceType });
        }
      }
      notifyBoard();
      res.json({ ok: true, results: out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });

  r.post('/admin/wipe-history', postLimiter, express.json({ limit: '8kb' }), ctx.authEquipos, (req, res) => {
    if (!requireEquiposAdminKey(req, res)) return;
    try {
      const out = req.equiposMod.equiposAdminWipeHistory(
        req.equiposDb,
        {
          adminUserId: req.body.adminUserId,
          adminName: req.body.adminName,
        },
        ctx.photosDir || ''
      );
      notifyBoard();
      res.json({ ok: true, ...out });
    } catch (e) {
      ctx.handleEquiposErr(res, e);
    }
  });
}

module.exports = { mountEquiposAdminRoutes };
