'use strict';

const express = require('express');
const { hashTeamCode } = require('./team-code.js');
const { createBearerAuthMiddleware } = require('./bearer-auth.js');
const { resolveHostUrlForClient } = require('./lan-request-host.js');
const { getLanDbManager } = require('../lib/db/lan-db-bridge.cjs');
const { createAuthFailureLockout } = require('./auth-failure-lockout.js');
const { handleAuthExchange } = require('./auth-router-exchange.js');

function auditLanSecurity(eventType, meta = {}) {
  const dbManager = getLanDbManager();
  if (!dbManager || !dbManager.isUnlocked()) return;
  dbManager
    .withTransaction((_db, { audit }) => {
      audit('desktop-host', eventType, meta);
    })
    .catch(() => {});
}

function mountBeaconRoute(r, shiftPinStore) {
  r.get('/beacon', (_req, res) => {
    const shift = shiftPinStore && typeof shiftPinStore.getStatus === 'function'
      ? shiftPinStore.getStatus()
      : null;
    res.json({
      ok: true,
      lan: true,
      shiftPinActive: !!shift,
    });
  });
}

function mountWardHostHintsRoute(r, wardHostRegistry, bearerAuth) {
  r.get('/auth/ward-host-hints', bearerAuth, (_req, res) => {
    if (!wardHostRegistry || typeof wardHostRegistry.getHintsForExchange !== 'function') {
      return res.json({ hostUrls: [], prefixes: [] });
    }
    try {
      res.json(wardHostRegistry.getHintsForExchange());
    } catch (e) {
      console.error('[auth/ward-host-hints]', e && e.message);
      res.status(500).json({ error: 'ward_host_hints_failed' });
    }
  });
}

function mountShiftPinRoutes(r, shiftPinStore, bearerAuth) {
  r.get('/auth/shift-pin', bearerAuth, (_req, res) => {
    if (!shiftPinStore) {
      return res.status(503).json({ error: 'shift_pin_unavailable' });
    }
    try {
      const body = shiftPinStore.ensure();
      auditLanSecurity('lan.shift_pin.ensure', {});
      res.json(body);
    } catch (e) {
      console.error('[auth/shift-pin]', e && e.message);
      res.status(500).json({ error: 'shift_pin_failed' });
    }
  });

  r.post('/auth/shift-pin/regenerate', bearerAuth, (_req, res) => {
    if (!shiftPinStore || typeof shiftPinStore.regenerate !== 'function') {
      return res.status(503).json({ error: 'shift_pin_unavailable' });
    }
    try {
      const body = shiftPinStore.regenerate();
      auditLanSecurity('lan.shift_pin.regenerate', {});
      res.json(body);
    } catch (e) {
      console.error('[auth/shift-pin/regenerate]', e && e.message);
      res.status(500).json({ error: 'shift_pin_failed' });
    }
  });
}

function mountTicketRoute(r, ticketStore, bearerAuth, getHostUrl) {
  r.post('/auth/tickets', bearerAuth, (req, res) => {
    try {
      const { ticketId, pin, expiresAt } = ticketStore.mint();
      auditLanSecurity('lan.ticket.mint', {});
      const hostUrl = resolveHostUrlForClient(req, getHostUrl);
      res.json({
        ticketId,
        pin,
        expiresAt,
        joinUrl: `${hostUrl}/join/${ticketId}`,
      });
    } catch (e) {
      console.error('[auth/tickets]', e && e.message);
      res.status(500).json({ error: 'ticket_mint_failed' });
    }
  });
}

function createAuthRouter({
  ticketStore,
  shiftPinStore,
  wardHostRegistry,
  getHostToken,
  getHostUrl,
  getRequiresMigrationNotice,
  authFailureLockout = createAuthFailureLockout(),
  clientIdentityStore = null,
}) {
  const r = express.Router();
  const getState = () => ({ teamCodeHash: hashTeamCode(getHostToken()) });
  const bearerAuth = createBearerAuthMiddleware(getState, {
    onAuthFail: () => auditLanSecurity('lan.auth.fail', { reason: 'invalid_token' }),
  });

  const exchangeDeps = {
    ticketStore,
    shiftPinStore,
    wardHostRegistry,
    getHostToken,
    getHostUrl,
    authFailureLockout,
    clientIdentityStore,
    auditLanSecurity,
  };

  mountBeaconRoute(r, shiftPinStore);
  mountWardHostHintsRoute(r, wardHostRegistry, bearerAuth);
  mountShiftPinRoutes(r, shiftPinStore, bearerAuth);
  mountTicketRoute(r, ticketStore, bearerAuth, getHostUrl);

  r.post('/auth/exchange', express.json(), (req, res) => {
    handleAuthExchange(req, res, exchangeDeps);
  });

  r.get('/host-status', bearerAuth, (_req, res) => {
    res.json({
      ok: true,
      requiresMigrationNotice: Boolean(getRequiresMigrationNotice()),
      lan: true,
    });
  });

  return r;
}

module.exports = { createAuthRouter, auditLanSecurity };
