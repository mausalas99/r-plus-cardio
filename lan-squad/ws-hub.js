'use strict';

const { WebSocketServer } = require('ws');
const { createDeltaResolver } = require('./delta-resolver.js');
const { createRoomRegistry, terminateUnauthenticated } = require('./ws-hub-rooms.js');
const { createMessageHandler } = require('./ws-hub-handlers.js');

const AUTH_TIMEOUT_MS = 3000;

function attachUpgradeHandler(httpServer, wss, pathName) {
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const u = new URL(req.url || '', 'http://localhost');
      if (u.pathname !== pathName) return;
      if (u.searchParams.get('code') || u.searchParams.get('token')) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      const channel = u.searchParams.get('channel') || 'sync';
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.__authenticated = false;
        ws.__channel = channel;
        ws.__authTimer = setTimeout(() => terminateUnauthenticated(ws), AUTH_TIMEOUT_MS);
        wss.emit('connection', ws, req);
      });
    } catch {
      try {
        socket.destroy();
      } catch (_e) { void _e; }
    }
  });
}

function attachConnectionHandler(wss, deps) {
  const onMessage = createMessageHandler(deps);
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => onMessage(ws, raw));
    ws.on('close', () => deps.leaveAll(ws));
  });
}

function attachWsHub(httpServer, { getState, resolver, pathName = '/api/lan/v1/ws' }) {
  const wss = new WebSocketServer({ noServer: true });
  const deltaResolver =
    resolver && resolver.store ? createDeltaResolver(resolver.store) : null;
  const { joinRoom, leaveAll, broadcast } = createRoomRegistry();

  attachUpgradeHandler(httpServer, wss, pathName);
  attachConnectionHandler(wss, {
    getState,
    resolver,
    deltaResolver,
    joinRoom,
    leaveAll,
    broadcast,
    terminateUnauthenticated,
  });

  function close() {
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch (_e) { void _e; }
    }
    return new Promise((resolve) => {
      wss.close(() => resolve());
    });
  }

  return { broadcast, close };
}

module.exports = { attachWsHub, AUTH_TIMEOUT_MS };
