'use strict';
const { createBearerAuthMiddleware } = require('./bearer-auth.js');

const KEEP_ALIVE_INTERVAL_MS = 20_000;

function createSseHub() {
  /** @type {Map<string, Set<{ res: import('http').ServerResponse, channel: string }>>} */
  const clients = new Map();

  function broadcast(channel, obj) {
    const name = String(channel || 'sync').trim() || 'sync';
    const set = clients.get(name);
    if (!set || set.size === 0) return;
    const line = `data: ${JSON.stringify(obj)}\n\n`;
    for (const client of set) {
      try {
        client.res.write(line);
      } catch {
        /* client disconnected */
      }
    }
  }

  function attachSseRouter(router, { getState }) {
    const bearerAuth = createBearerAuthMiddleware(getState);

    router.get('/sse', bearerAuth, (req, res) => {
      const channel = String(req.query.channel || 'sync').trim() || 'sync';

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      if (!clients.has(channel)) clients.set(channel, new Set());
      const client = { res, channel };
      clients.get(channel).add(client);

      const keepAlive = setInterval(() => {
        try {
          res.write(':\n\n');
        } catch {
          clearInterval(keepAlive);
        }
      }, KEEP_ALIVE_INTERVAL_MS);
      if (typeof keepAlive.unref === 'function') keepAlive.unref();

      req.on('close', () => {
        clearInterval(keepAlive);
        const set = clients.get(channel);
        if (set) {
          set.delete(client);
          if (set.size === 0) clients.delete(channel);
        }
      });
    });
  }

  return { attachSseRouter, broadcast };
}

module.exports = { createSseHub };
