import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLiveSyncFullBundles } from './lan-merge-registry.mjs';

/** Golden: two LAN bundle sources merge like pre-registry inline merge. */
const sourceA = {
  entityVersions: { 'a:e1': 2, 't:p1:t1': 1 },
  agenda: [
    {
      id: 'e1',
      patientId: 'p1',
      procedure: 'New',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  todos: { p1: [{ id: 't1', text: 'uno', updatedAt: '2026-05-16T08:00:00.000Z' }] },
  entries: [
    {
      patient: { id: 'p1', registro: 'R1', nombre: 'Alice', version: 2 },
      note: { texto: 'nueva nota' },
    },
  ],
  patientDeletes: [],
  clinicalOps: { teams: [{ team_id: 't1', name: 'Equipo A', updated_at: '2026-06-01T00:00:00.000Z' }] },
};

const sourceB = {
  entityVersions: { 'a:e1': 1, 't:p1:t2': 1 },
  agenda: [
    {
      id: 'e1',
      patientId: 'p1',
      procedure: 'Old',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  todos: { p1: [{ id: 't2', text: 'dos', updatedAt: '2026-05-16T09:00:00.000Z' }] },
  entries: [
    {
      patient: { id: 'p1', registro: 'R1', nombre: 'Alice', version: 1 },
      note: { texto: 'vieja nota' },
    },
  ],
  patientDeletes: [{ id: 'p9', registro: 'R9', deleted: true }],
  clinicalOps: { teams: [{ team_id: 't1', name: 'Equipo B', updated_at: '2026-05-01T00:00:00.000Z' }] },
};

describe('lan-merge-registry', () => {
  it('mergeLiveSyncFullBundles matches golden two-source merge', () => {
    const merged = mergeLiveSyncFullBundles([sourceA, sourceB]);

    assert.strictEqual(merged.agenda.length, 1);
    assert.strictEqual(merged.agenda[0].procedure, 'New');

    assert.ok(merged.todos.p1);
    assert.strictEqual(merged.todos.p1.length, 2);
    const texts = merged.todos.p1.map((t) => t.text).sort();
    assert.deepEqual(texts, ['dos', 'uno']);

    assert.ok(Array.isArray(merged.entries));
    assert.ok(merged.entries.length >= 1);
    const entry = merged.entries.find((e) => e && e.patient && e.patient.registro === 'R1');
    assert.ok(entry);
    assert.strictEqual(entry.note.texto, 'nueva nota');

    assert.ok(merged.clinicalOps && Array.isArray(merged.clinicalOps.teams));
    const team = merged.clinicalOps.teams.find((t) => t && t.team_id === 't1');
    assert.ok(team);
    assert.ok(team.name === 'Equipo A' || team.name === 'Equipo B');
  });

  it('empty sources yield empty merge shape', () => {
    const merged = mergeLiveSyncFullBundles([]);
    assert.ok(Array.isArray(merged.agenda));
    assert.ok(merged.todos && typeof merged.todos === 'object');
    assert.ok(Array.isArray(merged.entries));
  });

  it('delete patch + entry stale no reviven pendiente; local gana completion', () => {
    const merged = mergeLiveSyncFullBundles([
      {
        entityVersions: { 't:p1:t1': 5 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'host', completed: false, updatedAt: '2026-06-04T08:00:00Z' }] },
        entries: [
          {
            patient: { id: 'p1', registro: 'R1' },
            todos: [{ id: 't1', text: 'host', completed: false, updatedAt: '2026-06-04T08:00:00Z' }],
          },
        ],
      },
      {
        entityVersions: { 't:p1:t1': 5 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'local', completed: true, updatedAt: '2026-06-04T09:00:00Z' }] },
        entries: [],
        patches: [
          {
            type: 'livesync:patch',
            entity: 'todo',
            op: 'delete',
            id: 't2',
            patientId: 'p1',
            entityVersion: 2,
            updatedAt: '2026-06-04T10:00:00Z',
          },
        ],
      },
    ]);
    assert.equal(merged.todos.p1.length, 1);
    assert.equal(merged.todos.p1[0].completed, true);
    const entry = merged.entries.find((e) => e && e.patient && e.patient.id === 'p1');
    assert.ok(entry);
    assert.equal(entry.todos.length, 1);
    assert.equal(entry.todos[0].completed, true);
  });

  it('delete patch elimina pendiente aunque el host lo envíe en bundle', () => {
    const merged = mergeLiveSyncFullBundles([
      {
        entityVersions: { 't:p1:t1': 4 },
        agenda: [],
        todos: { p1: [{ id: 't1', text: 'host', updatedAt: '2026-06-04T08:00:00Z' }] },
        entries: [
          {
            patient: { id: 'p1' },
            todos: [{ id: 't1', text: 'host', updatedAt: '2026-06-04T08:00:00Z' }],
          },
        ],
      },
      {
        agenda: [],
        todos: {},
        entries: [],
        patches: [
          {
            type: 'livesync:patch',
            entity: 'todo',
            op: 'delete',
            id: 't1',
            patientId: 'p1',
            entityVersion: 5,
            updatedAt: '2026-06-04T11:00:00Z',
          },
        ],
      },
    ]);
    assert.equal(merged.todos.p1, undefined);
    assert.ok(merged.todoTouchedPatientIds.includes('p1'));
    const entry = merged.entries.find((e) => e && e.patient && e.patient.id === 'p1');
    assert.equal(entry.todos.length, 0);
  });
});
