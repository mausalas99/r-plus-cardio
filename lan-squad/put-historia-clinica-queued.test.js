'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHostStore } = require('./host-store.js');
const { createConflictResolver } = require('./conflict-resolver.js');

describe('putHistoriaClinicaQueued', () => {
  it('mutation and audit commit in one queue transaction', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-queue-'));
    const filePath = path.join(dir, 'state.json');
    const hostStateDir = path.join(dir, 'lan-host');
    const store = createHostStore({ filePath, hostStateDir, teamCodePlain: 'tok' });
    await store.ready();
    const room = store.createRoom('Sala');
    const resolver = createConflictResolver({ store });
    await store.flush();

    const mutation = {
      entityType: 'historiaClinica',
      entityId: 'p1',
      patientId: 'p1',
      roomId: room.id,
      expectedVersion: 0,
      changedKeys: ['app'],
      data: { patientId: 'p1', app: 'metformina' },
    };
    const out = await store.putHistoriaClinicaQueued(resolver, mutation, {
      at: '2026-05-30T00:00:00.000Z',
      clientId: 'c1',
      action: 'historia_clinica.save',
      detail: { patientId: 'p1', safety: [{ ruleId: 'x', acknowledged: true }] },
    });
    assert.strictEqual(out.version, 1);
    const bundle = store.getRoomSyncBundle(room.id);
    assert.strictEqual(bundle.entities['hc:p1'].data.app, 'metformina');
    const entry = bundle.audit_log.find((e) => e.action === 'historia_clinica.save');
    assert.ok(entry);
    assert.strictEqual(entry.detail.entityVersion, 1);
    assert.strictEqual(entry.detail.safety[0].ruleId, 'x');

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(hostStateDir, 'bundles', `${room.id}.json`), 'utf8')
    );
    assert.strictEqual(onDisk.entities['hc:p1'].data.app, 'metformina');
    assert.ok(onDisk.audit_log.some((e) => e.action === 'historia_clinica.save'));
  });
});
