'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { migrateHostStateIfNeeded } = require('./migrate-host-state.js');

describe('migrate-host-state', () => {
  it('migrates v1 bundle with updatedAt to v2 entityVersions', () => {
    const state = {
      version: 1,
      teamCodeHash: 'x',
      patients: [{ id: 'p1', version: 1 }],
      rooms: [],
      roomSyncBundles: {
        r1: {
          updatedAt: '2026-05-16T08:00:00.000Z',
          agenda: [{ id: 'e1' }],
          todos: { p1: [{ id: 't1' }] },
        },
      },
    };
    const out = migrateHostStateIfNeeded(state);
    assert.equal(out.version, 2);
    const b = out.roomSyncBundles.r1;
    assert.equal(b.revision, 1);
    assert.equal(b.entityVersions['a:e1'], 1);
    assert.equal(b.entityVersions['t:p1:t1'], 1);
    assert.equal(b.committedAt, '2026-05-16T08:00:00.000Z');
  });
});
