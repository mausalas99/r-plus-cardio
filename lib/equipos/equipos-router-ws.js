'use strict';

const { WebSocketServer } = require('ws');
const { addEquiposClient, removeEquiposClient } = require('./equipos-router-broadcast.js');

const AUTH_TIMEOUT_MS = 3000;

async function loadEquiposEsm() {
  return import('./equipos-db.mjs');
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {() => import('better-sqlite3').Database|null} getDb
 */
async function handleEquiposWsMessage(ws, msg, getDb) {
  if (msg?.type !== 'auth') {
    if (!ws.__equiposAuth) ws.close(4001, 'auth_required');
    return;
  }
  const mod = await loadEquiposEsm();
  const token = String(msg.token || '').trim();
  const db = typeof getDb === 'function' ? getDb() : null;
  if (!token || !db || !mod.verifyEquiposToken(db, token)) {
    ws.close(4001, 'auth_failed');
    return;
  }
  clearTimeout(ws.__authTimer);
  ws.__equiposAuth = true;
  addEquiposClient(ws);
  ws.send(JSON.stringify({ type: 'auth-ok' }));
}

/** @param {import('http').Server} httpServer @param {() => import('better-sqlite3').Database|null} getDb */
function attachEquiposWs(httpServer, getDb) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const u = new URL(req.url || '', 'http://localhost');
      if (u.pathname !== '/api/equipos/v1/ws') return;

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.__equiposAuth = false;
        ws.__authTimer = setTimeout(() => {
          try {
            ws.terminate();
          } catch (_e) {
            void _e;
          }
        }, AUTH_TIMEOUT_MS);
        wss.emit('connection', ws, req);
      });
    } catch {
      try {
        socket.destroy();
      } catch (_e) {
        void _e;
      }
    }
  });

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        await handleEquiposWsMessage(ws, msg, getDb);
      } catch {
        ws.close(4002, 'bad_message');
      }
    });
    ws.on('close', () => removeEquiposClient(ws));
  });
}

module.exports = { attachEquiposWs, loadEquiposEsm };
