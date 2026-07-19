'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mergeBundlePut, emptyBundle } = require('./bundle-merge.js');

const now = () => '2026-05-30T12:00:00.000Z';

describe('bundle-merge', () => {
  it('first put creates revision 1', () => {
    const r = mergeBundlePut(
      null,
      {
        baseRevision: 0,
        baseEntityVersions: {},
        agenda: [{ id: 'e1', patientId: 'p1', procedure: 'A' }],
        todos: {},
      },
      { nowIso: now, clientId: 'c1' }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.revision, 1);
    assert.equal(r.bundle.entityVersions['a:e1'], 1);
  });

  it('disjoint todo keys auto-merge', () => {
    let bundle = emptyBundle(now());
    bundle.revision = 1;
    bundle.entityVersions = { 't:p1:t1': 1 };
    bundle.todos = { p1: [{ id: 't1', text: 'one' }] };
    const r = mergeBundlePut(
      bundle,
      {
        baseRevision: 1,
        baseEntityVersions: {},
        todos: { p1: [{ id: 't2', text: 'two' }] },
      },
      { nowIso: now, clientId: 'c2' }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.revision, 2);
    assert.equal(r.bundle.todos.p1.length, 2);
    assert.equal(r.bundle.entityVersions['t:p1:t2'], 1);
  });

  it('stale entity version applies LWW instead of conflict', () => {
    let bundle = emptyBundle(now());
    bundle.revision = 1;
    bundle.entityVersions = { 'a:e1': 2 };
    bundle.agenda = [{ id: 'e1', procedure: 'Server', updatedAt: '2026-06-03T09:00:00.000Z' }];
    const r = mergeBundlePut(
      bundle,
      {
        baseRevision: 1,
        baseEntityVersions: { 'a:e1': 1 },
        agenda: [{ id: 'e1', procedure: 'Incoming', updatedAt: '2026-06-03T10:00:00.000Z' }],
      },
      { nowIso: now }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.agenda[0].procedure, 'Incoming');
    assert.ok(Array.isArray(r.lwwAppliedKeys));
    assert.ok(r.lwwAppliedKeys.includes('a:e1'));
  });

  it('revision skew still merges when payload has keys', () => {
    let bundle = emptyBundle(now());
    bundle.revision = 5;
    bundle.entityVersions = {};
    bundle.agenda = [];
    const r = mergeBundlePut(
      bundle,
      {
        baseRevision: 1,
        baseEntityVersions: {},
        agenda: [{ id: 'e1', procedure: 'New', updatedAt: '2026-06-03T10:00:00.000Z' }],
      },
      { nowIso: now }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.agenda.length, 1);
    assert.equal(r.bundle.agenda[0].procedure, 'New');
    assert.equal(r.bundle.revision, 6);
  });

  it('partial PUT keeps todos when only agenda sent', () => {
    let bundle = emptyBundle(now());
    bundle.revision = 1;
    bundle.entityVersions = { 't:p1:t1': 1 };
    bundle.todos = { p1: [{ id: 't1', text: 'keep' }] };
    const r = mergeBundlePut(
      bundle,
      {
        baseRevision: 1,
        baseEntityVersions: { 'a:e1': 0 },
        agenda: [{ id: 'e1', procedure: 'New' }],
      },
      { nowIso: now }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.todos.p1[0].text, 'keep');
    assert.equal(r.bundle.agenda.length, 1);
  });

  it('null or absent clinicalOps preserves server roster', () => {
    const serverOps = {
      exportedAt: '2020-01-01T00:00:00',
      clinical_users: [{ user_id: 'u1', username: 'doctor_a' }],
      teams: [],
      team_membership: [],
    };
    for (const payload of [
      { baseRevision: 1, baseEntityVersions: {}, clinicalOps: null },
      { baseRevision: 1, baseEntityVersions: {}, agenda: [] },
    ]) {
      let bundle = emptyBundle(now());
      bundle.revision = 1;
      bundle.entityVersions = { clinicalOps: 1 };
      bundle.clinicalOps = { ...serverOps };
      const r = mergeBundlePut(bundle, payload, { nowIso: now, clientId: 'c2' });
      assert.equal(r.ok, true);
      assert.equal(r.bundle.clinicalOps.clinical_users.length, 1);
      assert.equal(r.bundle.clinicalOps.clinical_users[0].username, 'doctor_a');
    }
  });

  it('clinicalOps union keeps teams from both peers', () => {
    let bundle = emptyBundle(now());
    bundle.revision = 1;
    bundle.entityVersions = { clinicalOps: 1 };
    bundle.clinicalOps = {
      exportedAt: '2020-01-01T00:00:00',
      teams: [{ team_id: 'team-a', name: 'A', created_at: '2020-01-01T00:00:00' }],
      team_membership: [],
    };
    const r = mergeBundlePut(
      bundle,
      {
        baseRevision: 1,
        baseEntityVersions: { clinicalOps: 1 },
        clinicalOps: {
          exportedAt: '2025-01-01T00:00:00',
          teams: [{ team_id: 'team-b', name: 'B', created_at: '2025-01-01T00:00:00' }],
          team_membership: [],
        },
      },
      { nowIso: now, clientId: 'c2' }
    );
    assert.equal(r.ok, true);
    assert.equal(r.bundle.clinicalOps.teams.length, 2);
  });
});

describe('entriesPartial — partial merge', () => {
  function mkServerEntry(id, overrides = {}) {
    return {
      id,
      name: 'Server Name',
      note: { texto: 'server note' },
      indicaciones: { items: ['server drug'] },
      labHistory: [{ id: 'ls_s', date: '2026-06-01', values: {} }],
      todos: [{ id: 't_s', text: 'server todo' }],
      medReceta: { meds: [] },
      vpo: { text: 'server vpo' },
      ...overrides,
    };
  }

  function mkIncomingEntry(id, overrides = {}) {
    return {
      id,
      name: 'Client Name',
      note: { texto: 'client note' },
      indicaciones: { items: ['client drug'] },
      labHistory: [{ id: 'ls_c', date: '2026-06-07', values: {} }],
      todos: [{ id: 't_c', text: 'client todo' }],
      medReceta: { meds: [{ name: 'amox' }] },
      vpo: { text: 'client vpo' },
      ...overrides,
    };
  }

  it('preserves typed fields from server when entriesPartial is true', () => {
    const serverBundle = {
      revision: 1,
      entityVersions: {},
      agenda: [], todos: {}, entries: [mkServerEntry('p1')],
      manejo: null, clinicalOps: null, committedAt: new Date().toISOString(),
    };
    const incoming = {
      baseRevision: 1,
      baseEntityVersions: {},
      entries: [mkIncomingEntry('p1')],
      entriesPartial: true,
      clientId: 'lc_a',
    };
    const result = mergeBundlePut(serverBundle, incoming, { nowIso: () => new Date().toISOString() });
    const merged = result.bundle.entries.find((e) => e.id === 'p1');
    assert.ok(merged, 'merged entry must exist');
    // typed fields: server wins
    assert.deepStrictEqual(merged.note, { texto: 'server note' }, 'note must come from server');
    assert.deepStrictEqual(merged.indicaciones, { items: ['server drug'] }, 'indicaciones from server');
    assert.deepStrictEqual(merged.labHistory, [{ id: 'ls_s', date: '2026-06-01', values: {} }], 'labHistory from server');
    // untyped fields: client wins
    assert.equal(merged.name, 'Client Name', 'name must come from client');
    assert.deepStrictEqual(merged.medReceta, { meds: [{ name: 'amox' }] }, 'medReceta from client');
  });

  it('appends new entries not found on server when entriesPartial is true', () => {
    const serverBundle = {
      revision: 1, entityVersions: {}, agenda: [], todos: {},
      entries: [mkServerEntry('p1')],
      manejo: null, clinicalOps: null, committedAt: new Date().toISOString(),
    };
    const incoming = {
      baseRevision: 1, baseEntityVersions: {},
      entries: [mkIncomingEntry('p_new')],
      entriesPartial: true,
      clientId: 'lc_a',
    };
    const result = mergeBundlePut(serverBundle, incoming, { nowIso: () => new Date().toISOString() });
    const newEntry = result.bundle.entries.find((e) => e.id === 'p_new');
    assert.ok(newEntry, 'new entry must be appended');
    assert.equal(result.bundle.entries.length, 2, 'original server entry plus new entry');
  });

  it('replaces entries wholesale when entriesPartial is NOT set (V0 behavior)', () => {
    const serverBundle = {
      revision: 1, entityVersions: {}, agenda: [], todos: {},
      entries: [mkServerEntry('p1')],
      manejo: null, clinicalOps: null, committedAt: new Date().toISOString(),
    };
    const incoming = {
      baseRevision: 1, baseEntityVersions: {},
      entries: [mkIncomingEntry('p1')],
      clientId: 'lc_a',
    };
    const result = mergeBundlePut(serverBundle, incoming, { nowIso: () => new Date().toISOString() });
    const merged = result.bundle.entries.find((e) => e.id === 'p1');
    // Without entriesPartial, client's typed fields should overwrite server's
    assert.deepStrictEqual(merged.note, { texto: 'client note' }, 'without entriesPartial, note from client');
  });
});
