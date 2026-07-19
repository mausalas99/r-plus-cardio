'use strict';
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { test } = require('node:test');
const { createHostStore } = require('./host-store.js');
const { createSseHub } = require('./lan-sse-hub.js');

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function listenServer(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
}

async function tearDown({ server, dir, store }) {
  await new Promise((resolve) => server.close(resolve));
  if (store && typeof store.flush === 'function') {
    await store.flush();
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
}

function mountSseRouter(store) {
  const sseHub = createSseHub();
  const app = express();
  const sseRouter = express.Router();
  sseHub.attachSseRouter(sseRouter, { getState: () => store.getState() });
  app.use('/api/lan/v1', sseRouter);
  return { app, sseHub };
}

test('authenticated SSE client receives broadcast data line', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-sse-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const { app, sseHub } = mountSseRouter(store);
  const server = http.createServer(app);
  await listenServer(server);

  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/sse?channel=sync`;
    const controller = new AbortController();
    const res = await fetch(url, {
      headers: bearerHeaders(code),
      signal: controller.signal,
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

    const payload = { type: 'livesync:hello', revision: 42, clientId: 'lc_test' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const readPromise = (async () => {
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const m = /data: (.+)\n\n/.exec(buf);
        if (m) return JSON.parse(m[1]);
      }
      return null;
    })();

    await new Promise((r) => setTimeout(r, 50));
    sseHub.broadcast('sync', payload);

    const received = await Promise.race([
      readPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('SSE broadcast timeout')), 3000)),
    ]);

    controller.abort();
    assert.deepStrictEqual(received, payload);
  } finally {
    await tearDown({ server, dir, store });
  }
});

test('unauthenticated GET /sse returns 401', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-sse-401-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const { app } = mountSseRouter(store);
  const server = http.createServer(app);
  await listenServer(server);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/lan/v1/sse`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'invalid_token');
  } finally {
    await tearDown({ server, dir, store });
  }
});
