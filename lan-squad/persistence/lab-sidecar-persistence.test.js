'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const express = require('express');
const { createHostStore } = require('../host-store.js');
const { createLanRouter } = require('../host-router.js');
const { createConflictResolver } = require('../conflict-resolver.js');
const { HOST_LAB_SET_CAP } = require('./lab-sidecar.js');
const { readMeta } = require('./json-meta-repository.js');

/** P2 stability gate: entry labMeta/sidecar decouple — exclude P2b deltaLog growth. */
function bundlePayloadByteLength(hostStateDir, roomId) {
  const onDisk = JSON.parse(
    fs.readFileSync(path.join(hostStateDir, 'bundles', `${roomId}.json`), 'utf8')
  );
  const slim = Object.assign({}, onDisk, { deltaLog: [] });
  return Buffer.byteLength(JSON.stringify(slim), 'utf8');
}

describe('lab-sidecar-persistence', () => {
  let dir;
  let filePath;
  let hostStateDir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-lab-persist-'));
    filePath = path.join(dir, 'state.json');
    hostStateDir = path.join(dir, 'lan-host');
  });

  function createStore(teamCodePlain) {
    return createHostStore({ filePath, hostStateDir, teamCodePlain });
  }

  async function seedRoom(store) {
    const room = store.createRoom('Sala 1');
    store.putRoomSyncBundle(room.id, {
      baseRevision: 0,
      baseEntityVersions: {},
      agenda: [],
      todos: {},
      entries: [{ patient: { id: 'p1' }, note: {} }],
    });
    await store.flush();
    return room;
  }

  it('25 lab upserts keep bundle entry payload stable within ±5% (excludes deltaLog)', async () => {
    const store = createStore('lab-cap-stable');
    await store.ready();
    const room = await seedRoom(store);

    for (let i = 0; i < HOST_LAB_SET_CAP; i += 1) {
      store.upsertPatientLabHistorySet(
        'p1',
        { id: 's' + i, date: '2026-06-0' + (i % 9), values: { n: i } },
        Date.now() + i
      );
      await store.flush();
    }

    const baselineBytes = bundlePayloadByteLength(hostStateDir, room.id);
    assert.ok(baselineBytes > 0);

    for (let i = HOST_LAB_SET_CAP; i < 25; i += 1) {
      store.upsertPatientLabHistorySet(
        'p1',
        { id: 's' + i, date: '2026-06-0' + (i % 9), values: { n: i } },
        Date.now() + i
      );
      await store.flush();
    }

    const finalBytes = bundlePayloadByteLength(hostStateDir, room.id);
    const delta = Math.abs(finalBytes - baselineBytes) / baselineBytes;
    assert.ok(
      delta <= 0.05,
      `bundle entry payload grew ${(delta * 100).toFixed(1)}% (${baselineBytes} → ${finalBytes})`
    );

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(hostStateDir, 'bundles', `${room.id}.json`), 'utf8')
    );
    assert.ok(!onDisk.entries[0].labHistory);
    assert.strictEqual(onDisk.entries[0].labMeta.labSetCount, HOST_LAB_SET_CAP);
    assert.ok(Array.isArray(onDisk.deltaLog) && onDisk.deltaLog.length === 25);
    assert.strictEqual(onDisk.deltaLog[24].type, 'lab_upsert');

    const sidecar = JSON.parse(
      fs.readFileSync(path.join(hostStateDir, 'labs', room.id, 'p1.json'), 'utf8')
    );
    assert.strictEqual(sidecar.orderedIds.length, HOST_LAB_SET_CAP);
  });

  it('GET /sync-bundle assembles labHistory from sidecars', async () => {
    const code = 'lab-sync-bundle-' + Date.now();
    const store = createStore(code);
    await store.ready();
    const room = await seedRoom(store);

    for (let i = 0; i < 3; i += 1) {
      store.upsertPatientLabHistorySet(
        'p1',
        { id: 'ls' + i, date: '2026-06-0' + (i + 1), values: { v: i } },
        Date.now() + i
      );
    }
    await store.flush();

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(hostStateDir, 'bundles', `${room.id}.json`), 'utf8')
    );
    assert.ok(!onDisk.entries[0].labHistory);

    const app = express();
    app.use(
      '/api/lan/v1',
      createLanRouter({
        store,
        broadcast: () => {},
        resolver: createConflictResolver({ store }),
        getHostClinicalMeta: () => ({ rank: 'R4', isProgramAdmin: true }),
      })
    );
    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
    });

    try {
      const { port } = server.address();
      const res = await fetch(
        `http://127.0.0.1:${port}/api/lan/v1/rooms/${encodeURIComponent(room.id)}/sync-bundle`,
        { headers: { Authorization: `Bearer ${code}` } }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.bundle && Array.isArray(body.bundle.entries));
      assert.strictEqual(body.bundle.entries[0].labHistory.length, 3);
      assert.strictEqual(body.bundle.entries[0].labHistory[0].id, 'ls2');
      assert.strictEqual(body.bundle.entries[0].labHistory[2].id, 'ls0');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('boot repair aligns labMeta from sidecar when bundle meta is torn', async () => {
    const store = createStore('lab-repair');
    await store.ready();
    const room = await seedRoom(store);

    store.upsertPatientLabHistorySet(
      'p1',
      { id: 'r1', date: '2026-06-08', values: { hb: 12 } },
      Date.now()
    );
    await store.flush();

    const bundlePath = path.join(hostStateDir, 'bundles', `${room.id}.json`);
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    delete bundle.entries[0].labMeta;
    fs.writeFileSync(bundlePath, JSON.stringify(bundle), 'utf8');

    const sidecarPath = path.join(hostStateDir, 'labs', room.id, 'p1.json');
    assert.ok(fs.existsSync(sidecarPath));

    const store2 = createStore('lab-repair');
    await store2.ready();

    const repairedBundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    assert.ok(repairedBundle.entries[0].labMeta);
    assert.strictEqual(repairedBundle.entries[0].labMeta.labSetCount, 1);
    assert.ok(!repairedBundle.entries[0].labHistory);

    const apiBundle = store2.getRoomSyncBundleForApi(room.id);
    assert.strictEqual(apiBundle.entries[0].labHistory.length, 1);
    assert.strictEqual(apiBundle.entries[0].labHistory[0].id, 'r1');
  });

  it('boot migration splits legacy labHistory into sidecars once', async () => {
    const store = createStore('lab-migrate');
    await store.ready();
    const room = await seedRoom(store);

    const labs = [];
    for (let i = 0; i < 5; i += 1) {
      labs.push({
        id: 'leg' + i,
        date: '2026-05-' + String(10 + i).padStart(2, '0'),
        values: {},
        _clientTimestamp: i,
      });
    }
    const bundlePath = path.join(hostStateDir, 'bundles', `${room.id}.json`);
    const bundleBefore = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    bundleBefore.entries[0].labHistory = labs;
    delete bundleBefore.entries[0].labMeta;
    fs.writeFileSync(bundlePath, JSON.stringify(bundleBefore), 'utf8');
    const sidecarPath = path.join(hostStateDir, 'labs', room.id, 'p1.json');
    if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
    assert.ok(Array.isArray(bundleBefore.entries[0].labHistory));

    const meta = await readMeta(hostStateDir);
    meta.labSidecarVersion = 0;
    fs.writeFileSync(path.join(hostStateDir, 'meta.json'), JSON.stringify(meta), 'utf8');

    const store2 = createStore('lab-migrate');
    await store2.ready();

    const bundleAfter = JSON.parse(
      fs.readFileSync(path.join(hostStateDir, 'bundles', `${room.id}.json`), 'utf8')
    );
    assert.ok(!bundleAfter.entries[0].labHistory);
    assert.ok(bundleAfter.entries[0].labMeta);
    assert.ok(fs.existsSync(path.join(hostStateDir, 'labs', room.id, 'p1.json')));

    const metaAfter = await readMeta(hostStateDir);
    assert.strictEqual(metaAfter.labSidecarVersion, 1);
  });
});
