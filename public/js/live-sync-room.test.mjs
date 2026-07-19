import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mergeLiveSyncBundles,
  compareIso,
  buildRoomSnapshotFromStorage,
  liveSyncDeletePatchesFromEntityMap,
} from './live-sync-room.mjs';

describe('live-sync-room merge by entity version', () => {
  it('compareIso ordena timestamps (solo desempate / UI)', () => {
    assert.ok(compareIso('2026-05-16T10:00:00.000Z', '2026-05-16T09:00:00.000Z') > 0);
    assert.strictEqual(compareIso('x', 'x'), 0);
  });

  it('gana agenda con entityVersion mayor aunque updatedAt sea más viejo', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 'a:e1': 2 },
        agenda: [
          {
            id: 'e1',
            patientId: 'p1',
            procedure: 'New',
            location: 'X',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        todos: {},
      },
      {
        entityVersions: { 'a:e1': 1 },
        agenda: [
          {
            id: 'e1',
            patientId: 'p1',
            procedure: 'Old',
            location: 'Y',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
        todos: {},
      },
    ]);
    assert.strictEqual(merged.agenda.length, 1);
    assert.strictEqual(merged.agenda[0].procedure, 'New');
  });

  it('union de todos disjuntos por id', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 't:p1:t1': 1 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'uno', updatedAt: '2026-05-16T08:00:00.000Z' }] },
      },
      {
        entityVersions: { 't:p1:t2': 1 },
        agenda: [],
        todos: { p1: [{ id: 't2', text: 'dos', updatedAt: '2026-05-16T09:00:00.000Z' }] },
      },
    ]);
    assert.strictEqual(merged.todos.p1.length, 2);
  });

  it('gana todo con entityVersion mayor', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 't:p1:t1': 1 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'viejo', updatedAt: '2026-05-16T12:00:00.000Z' }] },
      },
      {
        entityVersions: { 't:p1:t1': 2 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'nuevo', updatedAt: '2026-05-16T08:00:00.000Z' }] },
      },
    ]);
    assert.strictEqual(merged.todos.p1.length, 1);
    assert.strictEqual(merged.todos.p1[0].text, 'nuevo');
  });

  it('delete gana con entityVersion en patch', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 'a:e1': 1 },
        agenda: [
          {
            id: 'e1',
            patientId: 'p1',
            procedure: 'A',
            updatedAt: '2026-05-16T08:00:00.000Z',
          },
        ],
      },
      {
        type: 'livesync:patch',
        entity: 'agenda',
        op: 'delete',
        id: 'e1',
        entityVersion: 2,
        updatedAt: '2026-05-16T11:00:00.000Z',
      },
    ]);
    assert.strictEqual(merged.agenda.length, 0);
  });

  it('no revive todo borrado desde bundle posterior con versión menor', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 't:p1:t1': 3 },
        agenda: [],
        todos: {},
        patches: [
          {
            type: 'livesync:patch',
            entity: 'todo',
            op: 'delete',
            id: 't1',
            patientId: 'p1',
            entityVersion: 3,
            updatedAt: '2026-06-04T11:00:00Z',
          },
        ],
      },
      {
        entityVersions: { 't:p1:t1': 2 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'stale', updatedAt: '2026-06-04T08:00:00Z' }] },
      },
    ]);
    assert.equal(merged.todos.p1, undefined);
  });

  it('delete de último todo marca paciente tocado', () => {
    const merged = mergeLiveSyncBundles([
      {
        entityVersions: { 't:p1:t1': 1 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'x', updatedAt: '2026-05-16T08:00:00.000Z' }] },
      },
      {
        type: 'livesync:patch',
        entity: 'todo',
        op: 'delete',
        id: 't1',
        patientId: 'p1',
        entityVersion: 2,
        updatedAt: '2026-05-16T12:00:00.000Z',
      },
    ]);
    assert.deepEqual(merged.todos.p1, undefined);
    assert.ok(merged.todoTouchedPatientIds.includes('p1'));
  });

  it('normaliza patch con mutation envelope', () => {
    const merged = mergeLiveSyncBundles([
      { agenda: [], todos: {} },
      {
        type: 'livesync:patch',
        roomId: 'r1',
        clientId: 'c1',
        mutation: {
          entityType: 'todo',
          entityId: 't9',
          patientId: 'p1',
          expectedVersion: 0,
          version: 1,
          data: { id: 't9', text: 'from-mutation', updatedAt: '2026-05-30T10:00:00.000Z' },
        },
      },
    ]);
    assert.strictEqual(merged.todos.p1.length, 1);
    assert.strictEqual(merged.todos.p1[0].text, 'from-mutation');
  });

  it('delete de paciente en patch', () => {
    const merged = mergeLiveSyncBundles([
      {
        type: 'livesync:patch',
        entity: 'patient',
        op: 'delete',
        id: 'p9',
        registro: '12345',
        entityVersion: 1,
        updatedAt: '2026-05-16T12:00:00.000Z',
      },
    ]);
    assert.strictEqual(merged.patientDeletes.length, 1);
    assert.strictEqual(merged.patientDeletes[0].registro, '12345');
  });
});

describe('liveSyncDeletePatchesFromEntityMap', () => {
  it('emits patient delete patch from local tombstone', () => {
    const patches = liveSyncDeletePatchesFromEntityMap({
      'patient:p9': {
        version: 2,
        registro: '12345',
        _deleted: true,
        updatedAt: '2026-05-16T12:00:00.000Z',
      },
    });
    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].entity, 'patient');
    assert.strictEqual(patches[0].op, 'delete');
    assert.strictEqual(patches[0].id, 'p9');
    assert.strictEqual(patches[0].registro, '12345');
  });
});

describe('buildRoomSnapshotFromStorage', () => {
  it('excluye demo-', () => {
    const snap = buildRoomSnapshotFromStorage(
      {
        getScheduledProcedures: () => [{ id: '1', patientId: 'demo-x', procedure: 'x', location: 'y' }],
        getTodos: () => [],
      },
      ['demo-a', 'p1']
    );
    assert.strictEqual(snap.agenda.length, 0);
  });
});
