'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { createHostStore } = require('./host-store.js');
const { createConflictResolver } = require('./conflict-resolver.js');

test('auto-merge disjoint keys on version mismatch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-merge-'));
  const filePath = path.join(dir, 's.json');
  const store = createHostStore({ filePath, teamCodePlain: 'tok' });
  store.upsertPatient({ id: 'p1', nombre: 'Ana', version: 1 }, null);
  const resolver = createConflictResolver({ store });
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '201', expectedVersion: 1 }, 1);
  const out = resolver.applyMutation({
    entityType: 'patient',
    entityId: 'p1',
    expectedVersion: 1,
    baseData: { id: 'p1', nombre: 'Ana', cuarto: '101' },
    changedKeys: ['cama'],
    data: { id: 'p1', nombre: 'Ana', cuarto: '101', cama: 'B' },
  });
  assert.strictEqual(out.autoMerged, true);
  assert.strictEqual(out.data.cuarto, '201');
  assert.strictEqual(out.data.cama, 'B');
});

test('historiaClinica auto-merge disjoint section keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-hc-'));
  const filePath = path.join(dir, 's.json');
  const store = createHostStore({ filePath, teamCodePlain: 'tok' });
  const room = store.createRoom('Sala');
  const resolver = createConflictResolver({ store });
  store.setEntity({
    roomId: room.id,
    entityType: 'historiaClinica',
    entityId: 'p1',
    patientId: 'p1',
    version: 1,
    data: { patientId: 'p1', ficha: 'A', app: 'B' },
    deleted: false,
  });
  store.setEntity({
    roomId: room.id,
    entityType: 'historiaClinica',
    entityId: 'p1',
    patientId: 'p1',
    version: 2,
    data: { patientId: 'p1', ficha: 'X', app: 'B' },
    deleted: false,
  });
  const out = resolver.applyMutation({
    entityType: 'historiaClinica',
    entityId: 'p1',
    patientId: 'p1',
    roomId: room.id,
    expectedVersion: 1,
    baseData: { patientId: 'p1', ficha: 'A', app: 'B' },
    changedKeys: ['ahf'],
    data: { ahf: 'HTA' },
  });
  assert.strictEqual(out.autoMerged, true);
  assert.strictEqual(out.data.ficha, 'X');
  assert.strictEqual(out.data.ahf, 'HTA');
  assert.strictEqual(out.data.app, 'B');
});

test('overlap keys resolve with LWW (incoming newer wins)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-lww-'));
  const filePath = path.join(dir, 's.json');
  const store = createHostStore({ filePath, teamCodePlain: 'tok' });
  store.upsertPatient({ id: 'p1', nombre: 'Ana', cuarto: '101', lanUpdatedAt: '2026-06-03T09:00:00.000Z' }, null);
  const resolver = createConflictResolver({ store });
  store.upsertPatient({
    id: 'p1',
    nombre: 'Ana',
    cuarto: '201',
    lanUpdatedAt: '2026-06-03T09:30:00.000Z',
  }, 1);
  const out = resolver.applyMutation({
    entityType: 'patient',
    entityId: 'p1',
    expectedVersion: 1,
    baseData: { id: 'p1', nombre: 'Ana', cuarto: '101', lanUpdatedAt: '2026-06-03T09:00:00.000Z' },
    changedKeys: ['cuarto'],
    data: {
      id: 'p1',
      nombre: 'Ana',
      cuarto: '102',
      lanUpdatedAt: '2026-06-03T10:00:00.000Z',
    },
  });
  assert.strictEqual(out.lwwApplied, true);
  assert.strictEqual(out.data.cuarto, '102');
  assert.ok(out.overwrittenKeys.includes('cuarto'));
});
