'use strict';

const { WebSocketServer } = require('ws');
const {
  addInternoRoomClient,
  removeInternoRoomClient,
} = require('./interno-router-broadcast.js');

const AUTH_TIMEOUT_MS = 3000;

/** @param {import('ws').WebSocket} ws @param {string} sala */
function authenticateInternoWs(ws, sala) {
  clearTimeout(ws.__authTimer);
  ws.__authenticated = true;
  ws.__sala = sala;
  addInternoRoomClient(sala, ws);
  ws.send(JSON.stringify({ type: 'auth-ok', sala }));
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {() => import('better-sqlite3').Database|null} getDb
 * @param {() => Promise<object>} loadEsm
 */
async function handleInternoWsMessage(ws, msg, getDb, loadEsm) {
  if (msg?.type !== 'auth') {
    if (!ws.__authenticated) ws.close(4001, 'auth_required');
    return;
  }

  const mod = await loadEsm();
  const sala = mod.normalizeInternoSala(msg.sala);
  const token = String(msg.token || '').trim();
  const db = typeof getDb === 'function' ? getDb() : null;
  if (!sala || !token || !db || !mod.verifySalaInternoToken(db, token, sala)) {
    ws.close(4001, 'auth_failed');
    return;
  }
  authenticateInternoWs(ws, sala);
}

/** @param {import('http').Server} httpServer @param {() => import('better-sqlite3').Database|null} getDb @param {() => Promise<object>} loadEsm */
function attachInternoWs(httpServer, getDb, loadEsm) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const u = new URL(req.url || '', 'http://localhost');
      if (u.pathname !== '/api/interno/v1/ws') return;

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.__authenticated = false;
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
        await handleInternoWsMessage(ws, msg, getDb, loadEsm);
      } catch {
        ws.close(4002, 'bad_message');
      }
    });

    ws.on('close', () => {
      if (ws.__sala) removeInternoRoomClient(ws.__sala, ws);
    });
  });
}

module.exports = { attachInternoWs, AUTH_TIMEOUT_MS };
