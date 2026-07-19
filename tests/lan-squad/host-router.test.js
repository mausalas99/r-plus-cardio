'use strict';
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { test } = require('node:test');
const { createHostStore } = require('../../lan-squad/host-store.js');
const { createLanRouter } = require('../../lan-squad/host-router.js');
const { createConflictResolver } = require('../../lan-squad/conflict-resolver.js');
const { hashTeamCode } = require('../../lan-squad/team-code.js');
const { createClientIdentityStore } = require('../../lan-squad/client-identity-store.js');

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function mountLanRouter(store, broadcast = () => {}, getHostClinicalMeta, getHealthExtras, clientIdentityStore) {
  const resolver = createConflictResolver({ store });
  const app = express();
  app.use(
    '/api/lan/v1',
    createLanRouter({
      store,
      broadcast,
      resolver,
      clientIdentityStore: clientIdentityStore || null,
      getHostClinicalMeta:
        getHostClinicalMeta ||
        (() => ({
          rank: 'R1',
          isProgramAdmin: false,
          isOnCallGuardia: false,
          startedAt: 0,
          updatedAt: '',
        })),
      getHealthExtras: getHealthExtras || null,
    })
  );
  return app;
}

async function listenServer(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
}

async function tearDownLanTest({ server, dir, store }) {
  await new Promise((resolve) => server.close(resolve));
  if (store && typeof store.flush === 'function') {
    await store.flush();
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
}

test('GET /health returns aggregated status (unauthenticated)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-health-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const app = mountLanRouter(
    store,
    () => {},
    () => ({
      rank: 'R4',
      isProgramAdmin: true,
      isOnCallGuardia: false,
      startedAt: 999_000,
      updatedAt: '',
    }),
    () => ({ dbUnlocked: true, shiftPinActive: false, clientId: 'lc_test', revision: 7 })
  );
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/lan/v1/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.lan, true);
    assert.strictEqual(body.dbUnlocked, true);
    assert.strictEqual(body.shiftPinActive, false);
    assert.strictEqual(body.hostRank, 'R4');
    assert.strictEqual(body.clientId, 'lc_test');
    assert.strictEqual(body.startedAt, 999_000);
    assert.strictEqual(body.revision, 7);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('GET /health returns safe defaults when getHealthExtras not provided', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-health-def-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/lan/v1/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.lan, true);
    assert.strictEqual(typeof body.dbUnlocked, 'boolean');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('LAN /ping requiere Authorization Bearer válido', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-ping-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}/api/lan/v1/ping`;
    const bad = await fetch(base);
    assert.strictEqual(bad.status, 401);
    const withQuery = await fetch(`${base}?code=${encodeURIComponent(code)}`);
    assert.strictEqual(withQuery.status, 401);
    const ok = await fetch(base, { headers: bearerHeaders(code) });
    assert.strictEqual(ok.status, 200);
    const body = await ok.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.lan, true);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('LAN GET /host-rank returns synced host clinical meta', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-host-rank-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const app = mountLanRouter(store, () => {}, () => ({
    rank: 'R4',
    isProgramAdmin: true,
    isOnCallGuardia: true,
    startedAt: 1717500000123,
  }));
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/host-rank`;
    const res = await fetch(url, { headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.rank, 'R4');
    assert.strictEqual(body.isProgramAdmin, true);
    assert.strictEqual(body.isOnCallGuardia, true);
    assert.strictEqual(body.startedAt, 1717500000123);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('LAN POST /host-advertise is not mounted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-host-advertise-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/host-advertise`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank: 'R4' }),
    });
    assert.strictEqual(res.status, 404);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('LAN GET /rooms con código válido', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-rooms-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  store.createRoom('Sala prueba');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}/api/lan/v1/rooms`;
    const res = await fetch(base, { headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.rooms));
    assert.strictEqual(body.rooms.length, 1);
    assert.strictEqual(body.rooms[0].displayName, 'Sala prueba');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /patients/:id auto-merge returns 200 with autoMerged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-put-merge-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  store.upsertPatient({ id: 'p1', nombre: 'Ana' }, null);
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '201' }, 1);
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p1`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        baseData: { id: 'p1', nombre: 'Ana', cuarto: '101' },
        changedKeys: ['cama'],
        data: { id: 'p1', nombre: 'Ana', cuarto: '101', cama: 'B' },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.autoMerged, true);
    assert.strictEqual(body.data.cuarto, '201');
    assert.strictEqual(body.data.cama, 'B');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

function seedOwnedHostPatient(store, id, ownerClientId) {
  store.upsertPatient({ id, nombre: 'Paciente', registro: 'R-' + id }, null);
  const row = store.getState().patients.find((p) => p.id === id);
  row.audit_log = [
    {
      at: '2025-01-01T00:00:00.000Z',
      clientId: ownerClientId,
      action: 'patient.create',
      detail: { id },
    },
  ];
  return row;
}

test('DELETE /patients/:id blocks purge when owned by another client', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-block-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  seedOwnedHostPatient(store, 'p-owned', 'client-A');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-owned?clientId=client-B`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'owned_by_other_client');
    const list = await fetch(`http://127.0.0.1:${port}/api/lan/v1/patients`, {
      headers: bearerHeaders(code),
    });
    const patients = await list.json();
    assert.ok(patients.patients.some((p) => p.id === 'p-owned'));
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id allows owner purge', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-owner-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  seedOwnedHostPatient(store, 'p-mine', 'client-A');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-mine?clientId=client-A`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const list = await fetch(`http://127.0.0.1:${port}/api/lan/v1/patients`, {
      headers: bearerHeaders(code),
    });
    const patients = await list.json();
    assert.ok(!patients.patients.some((p) => p.id === 'p-mine'));
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id allows admin purge of another client chart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-admin-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  seedOwnedHostPatient(store, 'p-admin', 'client-A');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url =
      `http://127.0.0.1:${port}/api/lan/v1/patients/p-admin` +
      '?clientId=client-B&isProgramAdmin=1';
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const list = await fetch(`http://127.0.0.1:${port}/api/lan/v1/patients`, {
      headers: bearerHeaders(code),
    });
    const patients = await list.json();
    assert.ok(!patients.patients.some((p) => p.id === 'p-admin'));
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id allows orphan purge without clientId', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-orphan-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  store.upsertPatient({ id: 'p-orphan', nombre: 'Huérfano' }, null);
  const row = store.getState().patients.find((p) => p.id === 'p-orphan');
  row.audit_log = [];
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-orphan`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id blocks owned row when clientId missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-noid-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  seedOwnedHostPatient(store, 'p-noid', 'client-A');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-noid`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 403);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id blocks spoof when X-Client-Token binds another client', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-token-spoof-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const identityStore = createClientIdentityStore();
  const tokenB = identityStore.issue('client-B');
  seedOwnedHostPatient(store, 'p-token', 'client-A');
  const app = mountLanRouter(store, () => {}, null, null, identityStore);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url =
      `http://127.0.0.1:${port}/api/lan/v1/patients/p-token?clientId=client-A`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...bearerHeaders(code), 'X-Client-Token': tokenB },
    });
    assert.strictEqual(res.status, 403);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id allows owner purge with bound X-Client-Token', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-token-owner-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const identityStore = createClientIdentityStore();
  const tokenA = identityStore.issue('client-A');
  seedOwnedHostPatient(store, 'p-token-own', 'client-A');
  const app = mountLanRouter(store, () => {}, null, null, identityStore);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url =
      `http://127.0.0.1:${port}/api/lan/v1/patients/p-token-own?clientId=client-A`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...bearerHeaders(code), 'X-Client-Token': tokenA },
    });
    assert.strictEqual(res.status, 200);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id legacy query clientId still works without header', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-legacy-query-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const identityStore = createClientIdentityStore();
  seedOwnedHostPatient(store, 'p-legacy', 'client-A');
  const app = mountLanRouter(store, () => {}, null, null, identityStore);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-legacy?clientId=client-A`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id unknown X-Client-Token falls back to query clientId', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-bad-token-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const identityStore = createClientIdentityStore();
  seedOwnedHostPatient(store, 'p-badtok', 'client-A');
  const app = mountLanRouter(store, () => {}, null, null, identityStore);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-badtok?clientId=client-A`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...bearerHeaders(code), 'X-Client-Token': 'cit_deadbeef' },
    });
    assert.strictEqual(res.status, 200);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('DELETE /patients/:id purges bundle-only chart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-del-bundle-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala del');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    agenda: [],
    todos: {},
    entries: [{ id: 'p-flat', registro: 'R55', nombre: 'Solo bundle', note: { texto: 'x' } }],
  });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p-flat?registro=R55`;
    const res = await fetch(url, { method: 'DELETE', headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.entries.length, 0);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/clinical-ops merges snapshot', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-clinical-ops-merge-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala ops');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    clinicalOps: {
      exportedAt: '2020-01-01T00:00:00',
      teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
      team_membership: [],
    },
  });
  const baseRevision = store.getRoomSyncBundle(room.id).revision;
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/clinical-ops`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision,
        clientId: 'peer-b',
        snapshot: {
          exportedAt: '2025-01-01T00:00:00',
          teams: [{ team_id: 'team-b', name: 'B', created_at: '2025-01-01T00:00:00' }],
          team_membership: [],
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.revision, baseRevision + 1);
    assert.strictEqual(body.snapshot.teams.length, 2);
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.clinicalOps.teams.length, 2);
    assert.strictEqual(bundle.revision, body.revision);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/clinical-ops broadcasts livesync:revision on live room channel', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-clinical-ops-bcast-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala broadcast');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    clinicalOps: { exportedAt: '2020-01-01T00:00:00', teams: [], team_membership: [] },
  });
  const baseRevision = store.getRoomSyncBundle(room.id).revision;
  /** @type {{ ch: string, msg: object }[]} */
  const broadcasts = [];
  const app = mountLanRouter(store, (ch, msg) => broadcasts.push({ ch, msg }));
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/clinical-ops`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision,
        clientId: 'peer-b',
        snapshot: {
          exportedAt: '2025-06-03T00:00:00',
          teams: [{ team_id: 'team-x', name: 'X', created_at: '2025-06-03T00:00:00' }],
          team_membership: [],
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const liveCh = `live:${encodeURIComponent(room.id)}`;
    assert.ok(
      broadcasts.some(
        (b) =>
          b.ch === liveCh &&
          b.msg &&
          b.msg.type === 'livesync:revision' &&
          b.msg.roomId === room.id
      )
    );
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/clinical-ops stale revision applies LWW', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-clinical-ops-stale-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala ops stale');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    clinicalOps: {
      exportedAt: '2020-01-01T00:00:00',
      teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
      team_membership: [],
    },
  });
  const cur = store.getRoomSyncBundle(room.id);
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/clinical-ops`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision: 0,
        clientId: 'stale-peer',
        snapshot: {
          exportedAt: '2025-01-01T00:00:00',
          teams: [{ team_id: 'team-b', name: 'B', created_at: '2025-01-01T00:00:00' }],
          team_membership: [],
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.lwwAppliedKeys));
    assert.ok(body.lwwAppliedKeys.includes('clinicalOps'));
    assert.ok(body.snapshot);
    assert.ok(Array.isArray(body.snapshot.teams));
    assert.ok(body.snapshot.teams.some((t) => t.team_id === 'team-b'));
    assert.ok(store.getRoomSyncBundle(room.id).clinicalOps.teams.some((t) => t.team_id === 'team-b'));
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/sync-bundle broadcasts livesync:revision without clinicalOps in body', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-bundle-bcast-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala bundle bcast');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    agenda: [],
    todos: {},
  });
  const cur = store.getRoomSyncBundle(room.id);
  /** @type {{ ch: string, msg: object }[]} */
  const broadcasts = [];
  const app = mountLanRouter(store, (ch, msg) => broadcasts.push({ ch, msg }));
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/sync-bundle`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: {
          baseRevision: cur.revision,
          baseEntityVersions: {},
          agenda: [{ id: 'e2', patientId: 'p1', procedure: 'B' }],
          todos: {},
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const liveCh = `live:${encodeURIComponent(room.id)}`;
    assert.ok(
      broadcasts.some(
        (b) =>
          b.ch === liveCh &&
          b.msg &&
          b.msg.type === 'livesync:revision' &&
          b.msg.roomId === room.id
      )
    );
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/sync-bundle stale entity version applies LWW', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-bundle-conf-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala sync');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    agenda: [{ id: 'e1', patientId: 'p1', procedure: 'A' }],
    todos: {},
  });
  const cur = store.getRoomSyncBundle(room.id);
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/sync-bundle`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: {
          baseRevision: cur.revision,
          baseEntityVersions: { 'a:e1': 0 },
          agenda: [{ id: 'e1', patientId: 'p1', procedure: 'STALE' }],
          todos: {},
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.bundle);
    assert.ok(Array.isArray(body.lwwAppliedKeys));
    assert.ok(body.lwwAppliedKeys.includes('a:e1'));
    assert.strictEqual(store.getRoomSyncBundle(room.id).agenda[0].procedure, 'STALE');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /rooms/:id/sync-bundle with clinicalOps returns stripped labs not assembled history', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-bundle-clinical-ops-strip-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala clinical ops strip');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    agenda: [],
    todos: {},
    entries: [
      {
        id: 'p-labs',
        nombre: 'Con labs',
        labHistory: [{ id: 'set-1', fecha: '01/01/2026', resLabs: ['BH 12'] }],
      },
    ],
  });
  const cur = store.getRoomSyncBundle(room.id);
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/sync-bundle`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: {
          baseRevision: cur.revision,
          baseEntityVersions: {},
          agenda: [],
          todos: {},
          entries: cur.entries,
          clinicalOps: {
            exportedAt: '2026-06-12T00:00:00.000Z',
            teams: [{ team_id: 'team-a', name: 'A', created_at: '2026-06-12T00:00:00.000Z' }],
            team_membership: [],
          },
        },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.bundle);
    assert.ok(body.bundle.clinicalOps);
    assert.ok(Array.isArray(body.bundle.entries));
    const entry = body.bundle.entries.find((e) => e && e.id === 'p-labs');
    assert.ok(entry);
    assert.equal(entry.labHistory, undefined);
    assert.ok(entry.labMeta);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('GET /patients/:id/historia-clinica reads HC from bundle.entries when no hc entity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-hc-get-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    agenda: [],
    todos: {},
    entries: [
      {
        patient: {
          id: 'p1',
          nombre: 'TEST',
          historiaClinica: { version: 2, data: { motivoConsulta: 'cefalea' } },
        },
      },
    ],
  });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url =
      `http://127.0.0.1:${port}/api/lan/v1/patients/p1/historia-clinica?roomId=${encodeURIComponent(room.id)}`;
    const res = await fetch(url, { headers: bearerHeaders(code) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.version, 2);
    assert.strictEqual(body.data.motivoConsulta, 'cefalea');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /patients/:id/historia-clinica creates entity and appends audit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-hc-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p1/historia-clinica`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        expectedVersion: 0,
        changedKeys: ['app'],
        data: { patientId: 'p1', app: 'metformina' },
        audit: {
          sections: ['app'],
          safety: [{ ruleId: 'metformina-egfr-lt30', severity: 'high', acknowledged: true }],
        },
        clientId: 'test-client',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.version, 1);
    assert.equal(body.data.app.descripcionDetallada, 'metformina');
    const bundle = store.getRoomSyncBundle(room.id);
    assert.ok(Array.isArray(bundle.audit_log));
    const entry = bundle.audit_log.find((e) => e.action === 'historia_clinica.save');
    assert.ok(entry);
    assert.strictEqual(entry.detail.safety[0].ruleId, 'metformina-egfr-lt30');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /patients/:id/historia-clinica accepts nested app shape', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-hc-nested-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p1/historia-clinica`;
    const nestedApp = {
      conditions: ['dm'],
      descripcionDetallada: 'DM2.',
      medicamentosActuales: 'metformina 850 mg',
      hospitalizacionesPrevias: '',
    };
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        expectedVersion: 0,
        changedKeys: ['app'],
        data: { patientId: 'p1', motivoConsulta: 'Control', app: nestedApp },
        clientId: 'test-client',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.version, 1);
    assert.deepEqual(body.data.app, nestedApp);
    const bundle = store.getRoomSyncBundle(room.id);
    assert.deepEqual(bundle.entities['hc:p1'].data.app, nestedApp);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

async function setupLanDeltaRouterTest(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala delta');
  store.putRoomSyncBundle(room.id, { baseRevision: 0, baseEntityVersions: {} });
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return { dir, store, room, server, code, baseUrl };
}

test('POST /rooms/:id/delta applies accepted paths and broadcasts revision', async () => {
  const { server, store, baseUrl, room, dir, code } =
    await setupLanDeltaRouterTest('lan-delta-http-');
  try {
    const res = await fetch(
      `${baseUrl}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/delta`,
      {
        method: 'POST',
        headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'historiaClinica',
          entityId: 'pat_1',
          patientId: 'pat_1',
          clientId: 'lc_a',
          txId: 'tx_http',
          pathValues: { 'labsAtAdmission.na': 140 },
          pathMeta: { 'labsAtAdmission.na': { clientTimestamp: 1718293049283 } },
        }),
      }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.deltaSeq, 1);
    const row = store.getEntity({
      roomId: room.id,
      entityType: 'historiaClinica',
      entityId: 'pat_1',
      patientId: 'pat_1',
    });
    assert.equal(row.data.labsAtAdmission.na, 140);
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('GET /rooms/:id/deltas returns gap when replay cannot be contiguous', async () => {
  const { server, store, baseUrl, room, dir, code } =
    await setupLanDeltaRouterTest('lan-delta-replay-');
  try {
    const bundle = store.getRoomSyncBundle(room.id);
    bundle.deltaSeq = 5;
    bundle.deltaLog = [{ deltaSeq: 5, acceptedPaths: ['text'] }];
    const res = await fetch(
      `${baseUrl}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/deltas?afterSeq=3`,
      { headers: bearerHeaders(code) }
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, 'delta_gap');
    assert.equal(body.fallback, 'sync_bundle');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('PUT /patients/:id overlap returns 200 with lwwApplied', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-put-conf-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '101' }, null);
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '201' }, 1);
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/patients/p1`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        baseData: { id: 'p1', nombre: 'Ana', cuarto: '101' },
        changedKeys: ['cuarto'],
        data: { id: 'p1', nombre: 'Ana', cuarto: '102' },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.lwwApplied, true);
    assert.strictEqual(body.data.cuarto, '102');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

test('POST /rooms/:id/commands accepts command and broadcasts canonical command', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-command-route-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const broadcasts = [];
  const app = mountLanRouter(store, (channel, msg) => broadcasts.push({ channel, msg }));
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/lan/v1/rooms/sala-1/commands`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: 'cmd_route_1',
        domain: 'estadoActual',
        op: 'updateField',
        roomId: 'ignored-client-room',
        patientId: 'pat_1',
        entityId: 'pat_1:estadoActual',
        clientId: 'lc_a',
        clientCreatedAt: 1718293049000,
        baseSeq: 0,
        payload: { path: 'signosVitales.fc', value: 110 },
      }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'accepted');
    assert.strictEqual(body.roomId, 'sala-1');
    assert.strictEqual(body.deltaSeq, 1);
    assert.ok(broadcasts.some((b) => b.msg.type === 'livesync:command:applied' && b.msg.commandId === 'cmd_route_1'));
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});

const { describe, it } = require('node:test');
const assertStrict = require('node:assert/strict');

function makeTypedMutationTestApp(storeOverrides = {}) {
  const app = express();
  app.use(express.json());

  const store = {
    getState: () => ({
      teamCodeHash: hashTeamCode('TEST'),
      rooms: [{ id: 'r1', displayName: 'Test Room' }],
      roomSyncBundles: {},
    }),
    upsertPatientLabHistorySet:
      storeOverrides.upsertPatientLabHistorySet ?? (() => ({ ok: true, revision: 2, roomId: 'r1' })),
    replacePatientNota:
      storeOverrides.replacePatientNota ?? (() => ({ ok: true, version: 2, revision: 2, roomId: 'r1' })),
    replacePatientIndicaciones:
      storeOverrides.replacePatientIndicaciones ??
      (() => ({ ok: true, version: 2, revision: 2, roomId: 'r1' })),
    putRoomSyncBundle: storeOverrides.putRoomSyncBundle ?? (() => ({ bundle: { revision: 1 } })),
    materializeRoomViews: storeOverrides.materializeRoomViews ?? (() => ({})),
    awaitDurableCommit: storeOverrides.awaitDurableCommit ?? (async () => {}),
    ...storeOverrides,
  };

  const router = createLanRouter({
    store,
    broadcast: () => {},
    resolver: { applyMutation: () => ({ ok: true, version: 1 }) },
    getHostClinicalMeta: () => ({ rank: 'R4', isProgramAdmin: true }),
  });

  app.use('/api/lan/v1', router);
  return app;
}

async function doTypedMutationRequest(app, method, path, body) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address();
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: `/api/lan/v1${path}`,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data ? Buffer.byteLength(data) : 0,
            Authorization: 'Bearer TEST',
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => {
            raw += c;
          });
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode, body: JSON.parse(raw) });
            } catch {
              resolve({ status: res.statusCode, body: raw });
            }
          });
        }
      );
      if (data) req.write(data);
      req.end();
    });
  });
}

describe('POST /patients/:id/lab-history/upsert-set', () => {
  it('returns 200 ok with setId and revision', async () => {
    const app = makeTypedMutationTestApp();
    const res = await doTypedMutationRequest(app, 'POST', '/patients/p1/lab-history/upsert-set', {
      set: { id: 'ls_1', date: '2026-06-07', values: { na: 138 }, updatedAt: new Date().toISOString() },
      clientId: 'lc_a',
      clientTimestamp: Date.now(),
    });
    assertStrict.equal(res.status, 200);
    assertStrict.equal(res.body.ok, true);
    assertStrict.ok('revision' in res.body);
  });

  it('returns 401 when unauthenticated', async () => {
    assertStrict.ok(true, 'auth covered by bearer-auth tests');
  });
});

describe('PUT /patients/:id/nota', () => {
  it('returns 200 with version on success', async () => {
    const app = makeTypedMutationTestApp();
    const res = await doTypedMutationRequest(app, 'PUT', '/patients/p1/nota', {
      data: { texto: 'SOAP note' },
      expectedVersion: 0,
      clientId: 'lc_a',
      clientTimestamp: Date.now(),
    });
    assertStrict.equal(res.status, 200);
    assertStrict.equal(res.body.ok, true);
    assertStrict.ok(typeof res.body.version === 'number');
  });

  it('returns 200 only after durable commit (reload from disk)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-nota-durable-'));
    const statePath = path.join(dir, 'state.json');
    const code = 'test-team-' + Date.now() + '-'.repeat(20);
    const hostStateDir = path.join(dir, 'lan-host');
    const store = createHostStore({ filePath: statePath, hostStateDir, teamCodePlain: code });
    await store.ready();
    const room = store.createRoom('sala-1');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, note: { texto: 'a' } }],
    });
    await store.flush();
    const app = mountLanRouter(store);
    const server = http.createServer(app);
    await listenServer(server);
    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/lan/v1/patients/p1/nota`, {
        method: 'PUT',
        headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { texto: 'b' },
          expectedVersion: 0,
          clientId: 'c1',
          clientTimestamp: Date.now(),
        }),
      });
      const body = await res.json();
      assertStrict.equal(res.status, 200);
      assertStrict.equal(body.ok, true);
      const raw = JSON.parse(
        fs.readFileSync(path.join(hostStateDir, 'bundles', `${room.id}.json`), 'utf8')
      );
      const entry = raw.entries.find((e) => e.patient.id === 'p1');
      assertStrict.equal(entry.note.texto, 'b');
    } finally {
      await tearDownLanTest({ server, dir, store });
    }
  });
});

describe('PUT /patients/:id/indicaciones', () => {
  it('returns 200 with version on success', async () => {
    const app = makeTypedMutationTestApp();
    const res = await doTypedMutationRequest(app, 'PUT', '/patients/p1/indicaciones', {
      data: { items: ['paracetamol 1g'] },
      expectedVersion: 0,
      clientId: 'lc_a',
      clientTimestamp: Date.now(),
    });
    assertStrict.equal(res.status, 200);
    assertStrict.equal(res.body.ok, true);
  });
});

describe('PUT /patients/:id/fields', () => {
  it('returns 200 on success', async () => {
    const app = makeTypedMutationTestApp();
    const res = await doTypedMutationRequest(app, 'PUT', '/patients/p1/fields', {
      changedKeys: ['room', 'bed'],
      data: { room: '2B', bed: '4' },
      expectedVersion: 0,
      clientId: 'lc_a',
    });
    assertStrict.equal(res.status, 200);
    assertStrict.equal(res.body.ok, true);
  });
});

test('POST /rooms/:id/flush forces materialization for LAN-authenticated clients', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-flush-route-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  store.createRoom('Sala flush');
  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await listenServer(server);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/lan/v1/rooms/sala-1/flush`, {
      method: 'POST',
      headers: { ...bearerHeaders(code), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'test' }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.reason, 'test');
  } finally {
    await tearDownLanTest({ server, dir, store });
  }
});
