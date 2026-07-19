import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHostBundleBases,
  setHostBundleBases,
  hostBundlePutBodyFromEnvelope,
} from './host-bundle-bases.mjs';

test('host bundle bases round-trip and PUT body', () => {
  global.localStorage = {
    _d: {},
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = v;
    },
    removeItem(k) {
      delete this._d[k];
    },
  };
  setHostBundleBases('r1', { revision: 3, entityVersions: { 't:p1:t1': 2 } });
  const bases = getHostBundleBases('r1');
  assert.equal(bases.revision, 3);
  const body = hostBundlePutBodyFromEnvelope('r1', {
    clientId: 'c1',
    agenda: [],
    todos: { p1: [{ id: 't1', text: 'x' }] },
  });
  assert.equal(body.baseRevision, 3);
  assert.equal(body.baseEntityVersions['t:p1:t1'], 2);
  assert.equal('clinicalOps' in body, false);
});

test('host bundle PUT body includes clinicalOps only when snapshot present', () => {
  global.localStorage = {
    _d: {},
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = v;
    },
    removeItem(k) {
      delete this._d[k];
    },
  };
  const emptyBody = hostBundlePutBodyFromEnvelope('r1', { clientId: 'c1', agenda: [] });
  assert.equal('clinicalOps' in emptyBody, false);
  const withOps = hostBundlePutBodyFromEnvelope('r1', {
    clientId: 'c1',
    agenda: [],
    clinicalOps: { exportedAt: '2026-01-01', clinical_users: [] },
  });
  assert.ok(withOps.clinicalOps);
});
