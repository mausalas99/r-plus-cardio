'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const WebSocket = require('ws');
const { createHostStore } = require('./host-store.js');
const { createConflictResolver } = require('./conflict-resolver.js');
const { attachWsHub, AUTH_TIMEOUT_MS } = require('./ws-hub.js');

function closeWs(ws) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once('close', resolve);
    try {
      ws.close();
    } catch {
      resolve();
      return;
    }
    setTimeout(resolve, 500);
  });
}

async function rmDirSafe(dir) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const retryable = err && (err.code === 'ENOTEMPTY' || err.code === 'EBUSY' || err.code === 'EPERM');
      if (!retryable || attempt === 9) throw err;
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
}

async function shutdownWsTest(httpServer, sockets, dir) {
  await Promise.all((sockets || []).map((ws) => closeWs(ws)));
  await new Promise((resolve) => httpServer.close(resolve));
  await rmDirSafe(dir);
}

function listen(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
}

async function connectAuthedLiveWs(port, token, channel = 'live:test-room') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/lan/v1/ws?channel=${encodeURIComponent(channel)}`);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  ws.send(JSON.stringify({ type: 'auth', token }));
  await new Promise((r) => setTimeout(r, 50));
  return ws;
}

function waitForMessage(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(t);
        ws.off('message', onMessage);
        resolve(msg);
      }
    };
    ws.on('message', onMessage);
  });
}

test('WebSocket requires auth frame; invalid token terminates', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ws-auth-'));
  const filePath = path.join(dir, 'state.json');
  const token = 'b'.repeat(64);
  const store = createHostStore({ filePath, teamCodePlain: token });
  const httpServer = http.createServer();
  attachWsHub(httpServer, { getState: () => store.getState() });
  await listen(httpServer);
  const { port } = httpServer.address();
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/lan/v1/ws?channel=sync`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    ws.send(JSON.stringify({ type: 'auth', token: 'wrong-token' }));
    await new Promise((resolve) => {
      ws.on('close', resolve);
      setTimeout(resolve, AUTH_TIMEOUT_MS + 200);
    });
    assert.notStrictEqual(ws.readyState, WebSocket.OPEN);
  } finally {
    await shutdownWsTest(httpServer, [], dir);
  }
});

test('WebSocket joins channel after valid auth frame', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ws-ok-'));
  const filePath = path.join(dir, 'state.json');
  const token = 'c'.repeat(64);
  const store = createHostStore({ filePath, teamCodePlain: token });
  const httpServer = http.createServer();
  attachWsHub(httpServer, { getState: () => store.getState() });
  await listen(httpServer);
  const { port } = httpServer.address();
  let ws;
  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}/api/lan/v1/ws?channel=live:room1`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    ws.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(ws.readyState, WebSocket.OPEN);
    const got = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 2000);
      ws.on('message', (raw) => {
        clearTimeout(t);
        resolve(JSON.parse(String(raw)));
      });
      ws.send(JSON.stringify({ type: 'ping', n: 1 }));
    });
    assert.strictEqual(got.type, 'ping');
    assert.strictEqual(got.n, 1);
  } finally {
    await shutdownWsTest(httpServer, [ws], dir);
  }
});

test('livesync:patch overlap broadcasts applied with lwwApplied', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ws-lww-'));
  const filePath = path.join(dir, 'state.json');
  const token = 'd'.repeat(64);
  const store = createHostStore({ filePath, teamCodePlain: token });
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '101' }, null);
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '201' }, 1);
  const resolver = createConflictResolver({ store });
  const httpServer = http.createServer();
  attachWsHub(httpServer, { getState: () => store.getState(), resolver });
  await listen(httpServer);
  const { port } = httpServer.address();
  const channel = 'live:conflict-room';
  let wsA;
  let wsB;
  try {
    wsA = await connectAuthedLiveWs(port, token, channel);
    wsB = await connectAuthedLiveWs(port, token, channel);

    const appliedPromise = waitForMessage(wsA, (m) => m.type === 'livesync:applied');
    const appliedBPromise = waitForMessage(wsB, (m) => m.type === 'livesync:applied');
    wsA.send(
      JSON.stringify({
        type: 'livesync:patch',
        roomId: null,
        clientId: 'client-a',
        mutation: {
          entityType: 'patient',
          entityId: 'p1',
          expectedVersion: 1,
          baseData: { id: 'p1', nombre: 'Ana', cuarto: '101' },
          changedKeys: ['cuarto'],
          data: { id: 'p1', nombre: 'Ana', cuarto: '102' },
        },
      })
    );
    const applied = await appliedPromise;
    const appliedB = await appliedBPromise;
    assert.strictEqual(applied.lwwApplied, true);
    assert.strictEqual(applied.data.cuarto, '102');
    assert.strictEqual(appliedB.lwwApplied, true);
    assert.strictEqual(appliedB.data.cuarto, '102');
  } finally {
    await shutdownWsTest(httpServer, [wsA, wsB], dir);
  }
});

test('livesync:patch disjoint merge broadcasts livesync:applied', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ws-applied-'));
  const filePath = path.join(dir, 'state.json');
  const token = 'e'.repeat(64);
  const store = createHostStore({ filePath, teamCodePlain: token });
  store.upsertPatient({ id: 'p1', nombre: 'Ana' }, null);
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '201' }, 1);
  const resolver = createConflictResolver({ store });
  const httpServer = http.createServer();
  attachWsHub(httpServer, { getState: () => store.getState(), resolver });
  await listen(httpServer);
  const { port } = httpServer.address();
  const channel = 'live:applied-room';
  let wsA;
  let wsB;
  try {
    wsA = await connectAuthedLiveWs(port, token, channel);
    wsB = await connectAuthedLiveWs(port, token, channel);
    const appliedA = waitForMessage(wsA, (m) => m.type === 'livesync:applied');
    const appliedB = waitForMessage(wsB, (m) => m.type === 'livesync:applied');
    wsA.send(
      JSON.stringify({
        type: 'livesync:patch',
        roomId: null,
        clientId: 'client-a',
        mutation: {
          entityType: 'patient',
          entityId: 'p1',
          expectedVersion: 1,
          baseData: { id: 'p1', nombre: 'Ana', cuarto: '101' },
          changedKeys: ['cama'],
          data: { id: 'p1', nombre: 'Ana', cuarto: '101', cama: 'B' },
        },
      })
    );
    const [msgA, msgB] = await Promise.all([appliedA, appliedB]);
    assert.strictEqual(msgA.type, 'livesync:applied');
    assert.strictEqual(msgB.type, 'livesync:applied');
    assert.strictEqual(msgA.autoMerged, true);
    assert.strictEqual(msgB.autoMerged, true);
    assert.strictEqual(msgA.data.cuarto, '201');
    assert.strictEqual(msgA.data.cama, 'B');
  } finally {
    await shutdownWsTest(httpServer, [wsA, wsB], dir);
  }
});

test('livesync:delta broadcasts canonical applied delta with origin txId', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ws-delta-'));
  const filePath = path.join(dir, 'state.json');
  const token = 'e'.repeat(64);
  const roomId = 'delta-room';
  const store = createHostStore({ filePath, teamCodePlain: token });
  store.createRoom('Sala delta');
  const resolver = createConflictResolver({ store });
  const httpServer = http.createServer();
  attachWsHub(httpServer, { getState: () => store.getState(), resolver });
  await listen(httpServer);
  const { port } = httpServer.address();
  const channel = `live:${roomId}`;
  let wsA;
  let wsB;
  try {
    wsA = await connectAuthedLiveWs(port, token, channel);
    wsB = await connectAuthedLiveWs(port, token, channel);
    const appliedPromise = waitForMessage(wsB, (msg) => msg.type === 'livesync:delta:applied');
    wsA.send(JSON.stringify({
      type: 'livesync:delta',
      roomId,
      clientId: 'lc_a',
      capabilities: { deltaSync: 1 },
      delta: {
        entityType: 'todo',
        entityId: 'todo_1',
        patientId: 'pat_1',
        txId: 'tx_ws',
        pathValues: { text: 'Pedir laboratorios' },
        pathMeta: { text: { clientTimestamp: 1718293049283 } },
      },
    }));

    const applied = await appliedPromise;
    assert.equal(applied.originClientId, 'lc_a');
    assert.equal(applied.txId, 'tx_ws');
    assert.equal(applied.status, 'ok');
    assert.deepEqual(applied.acceptedPaths, ['text']);
  } finally {
    await shutdownWsTest(httpServer, [wsA, wsB], dir);
  }
});
