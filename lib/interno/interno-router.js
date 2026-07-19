'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { loadInternoRouterEsm } = require('./interno-router-esm.js');
const { broadcastInterno } = require('./interno-router-broadcast.js');
const { readInternoBoard } = require('./interno-router-board.js');
const { createInternoAuthMiddleware } = require('./interno-router-auth.js');
const {
  createInternoBoardGetHandler,
  createInternoQrGetHandler,
} = require('./interno-router-handlers-read.js');
const { createInternoPendientePatchHandler } = require('./interno-router-handlers-pendientes.js');
const { createInternoVitalsPostHandler } = require('./interno-router-handlers-vitals.js');
const { attachInternoWs } = require('./interno-router-ws.js');

/**
 * @param {{
 *   store: { getState: () => { patients: object[] }, upsertPatient: (p: object, v: number) => object },
 *   getDb: () => import('better-sqlite3').Database | null,
 *   broadcastSync?: (name: string, obj: object) => void,
 *   onHostSync?: (obj: object) => void,
 *   httpServer?: import('http').Server,
 * }} deps
 */
function createInternoRouter(deps) {
  const r = express.Router();
  const postLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited' }),
  });

  const ctx = {
    getDb: deps.getDb,
    store: deps.store,
    broadcastSync: deps.broadcastSync,
    onHostSync: deps.onHostSync,
    loadEsm: loadInternoRouterEsm,
    readBoard: (sala) => readInternoBoard(ctx, sala),
    broadcastInterno,
  };

  const authInterno = createInternoAuthMiddleware(ctx);

  r.get('/ping', (_req, res) => {
    res.json({ ok: true, interno: true, board: 'v2' });
  });

  r.get('/qr.svg', createInternoQrGetHandler(ctx));
  r.get('/board', authInterno, createInternoBoardGetHandler(ctx));

  r.patch(
    '/patients/:patientId/pendientes/:itemId',
    postLimiter,
    express.json({ limit: '16kb' }),
    authInterno,
    createInternoPendientePatchHandler(ctx)
  );

  r.post(
    '/vitals',
    postLimiter,
    express.json({ limit: '64kb' }),
    authInterno,
    createInternoVitalsPostHandler(ctx)
  );

  if (deps.httpServer) {
    attachInternoWs(deps.httpServer, deps.getDb, loadInternoRouterEsm);
  }

  return r;
}

module.exports = { createInternoRouter, broadcastInterno };
