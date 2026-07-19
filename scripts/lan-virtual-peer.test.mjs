import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createHostStore } from '../lan-squad/host-store.js';
import { createLanRouter } from '../lan-squad/host-router.js';
import { createConflictResolver } from '../lan-squad/conflict-resolver.js';
import { runLanVirtualPeer } from './lan-virtual-peer.mjs';

function mountLanRouter(store) {
  const resolver = createConflictResolver({ store });
  const app = express();
  app.use('/api/lan/v1', createLanRouter({ store, broadcast: () => {}, resolver }));
  return app;
}

async function withEphemeralHost(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-virtual-peer-'));
  const statePath = path.join(dir, 'state.json');
  const code = 'test-team-' + Date.now() + '-'.repeat(20);
  const store = createHostStore({ filePath: statePath, teamCodePlain: code });
  const room = store.createRoom('Sala virtual');
  store.putRoomSyncBundle(room.id, {
    baseRevision: 0,
    baseEntityVersions: {},
    clinicalOps: {
      exportedAt: '2026-06-05T10:00:00.000Z',
      clinical_users: [
        {
          user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          username: 'doctor_host',
          rank: 'R4',
          clinical_name: 'Host Doctor',
          sala: 'Sala virtual',
          is_program_admin: 0,
        },
      ],
      teams: [],
      team_membership: [],
    },
  });

  const app = mountLanRouter(store);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  const host = `http://127.0.0.1:${port}`;

  try {
    await fn({ host, code, roomId: room.id, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (typeof store.flush === 'function') await store.flush();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
}

describe('lan-virtual-peer harness', () => {
  it('probe lists host roster without pushing', async () => {
    await withEphemeralHost(async ({ host, code, roomId }) => {
      const out = await runLanVirtualPeer([
        '--host',
        host,
        '--code',
        code,
        '--room',
        roomId,
        '--probe',
      ]);
      assert.equal(out.mode, 'probe');
      assert.equal(out.usersBefore, 1);
      assert.deepEqual(out.handlesBefore, ['doctor_host']);
    });
  });

  it('push adds virtual @usuario to host directorio', async () => {
    await withEphemeralHost(async ({ host, code, roomId }) => {
      const out = await runLanVirtualPeer([
        '--host',
        host,
        '--code',
        code,
        '--room',
        roomId,
        '--username',
        'doctor_virtual',
      ]);
      assert.equal(out.mode, 'push');
      assert.equal(out.usersAfter, 2);
      assert.ok(out.handlesAfter.includes('doctor_host'));
      assert.ok(out.handlesAfter.includes('doctor_virtual'));
    });
  });

  it('--delta applies historiaClinica field and replays log', async () => {
    await withEphemeralHost(async ({ host, code, roomId }) => {
      const out = await runLanVirtualPeer([
        '--host',
        host,
        '--code',
        code,
        '--room',
        roomId,
        '--delta',
        '--patient',
        'pat_delta_smoke',
      ]);
      assert.equal(out.mode, 'delta');
      assert.equal(out.patientId, 'pat_delta_smoke');
      assert.ok(Number(out.deltaSeq) >= 1);
      assert.ok(Number(out.sodiumValue) >= 141);
      assert.ok(out.replayCount >= 1);
    });
  });

  it('push + churn keeps both users (no roster wipe)', async () => {
    await withEphemeralHost(async ({ host, code, roomId }) => {
      const out = await runLanVirtualPeer([
        '--host',
        host,
        '--code',
        code,
        '--room',
        roomId,
        '--username',
        'doctor_virtual',
        '--churn',
      ]);
      assert.equal(out.mode, 'push+churn');
      assert.equal(out.usersAfter, 2);
    });
  });
});
