import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../storage.js';
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import { upsertHost, evictStale, _resetRegistryForTest, listHosts } from '../../lan-host-registry.mjs';
import {
  setActiveLiveSyncRoom,
  clearActiveLiveSyncRoom,
} from './runtime.mjs';
import {
  purgeLanPatientFromHost,
  rememberPatientDeleteTombstone,
  clearPatientDeleteTombstoneForAdmit,
  listPatientDeleteTombstones,
  clearPatientDeleteTombstones,
  acceptServerBundleConflict,
  profiledMergeLiveSyncFullBundles,
  buildEstadoActualCommand,
} from './orchestrator.mjs';

const TEST_BEARER = 'e'.repeat(32);
const LIVE_SYNC_ENTITIES_LS = 'rpc-lan-live-entities';

function mockLocalStorage() {
  const data = {};
  globalThis.localStorage = {
    getItem(k) {
      return data[k] ?? null;
    },
    setItem(k, v) {
      data[k] = v;
    },
    removeItem(k) {
      delete data[k];
    },
    key() {
      return null;
    },
    length: 0,
  };
  return data;
}

function seedLanSession() {
  storage.saveLanConfig({ hostUrl: 'http://10.0.0.57:3738', teamCode: TEST_BEARER });
  setActiveLiveSyncRoom('sala-orch', 'Orch');
  localStorage.setItem('rpc-lan-client-id', 'lc_local');
}

function otherOwnerRow(pid) {
  return {
    id: pid,
    registro: 'REG-1',
    audit_log: [{ action: 'patient.create', clientId: 'lc_other' }],
  };
}

describe('orchestrator.mjs characterization', () => {
  beforeEach(() => {
    mockLocalStorage();
    clearActiveLiveSyncRoom();
    _resetRegistryForTest();
  });

  it('purgeLanPatientFromHost rejects demo and empty ids', async () => {
    seedLanSession();
    assert.deepEqual(await purgeLanPatientFromHost(''), { ok: false, error: 'invalid_id' });
    assert.deepEqual(await purgeLanPatientFromHost('demo-p1'), { ok: false, error: 'invalid_id' });
  });

  it('purgeLanPatientFromHost returns not_configured without active room', async () => {
    storage.saveLanConfig({ hostUrl: 'http://10.0.0.57:3738', teamCode: TEST_BEARER });
    assert.deepEqual(await purgeLanPatientFromHost('p1'), { ok: false, error: 'not_configured' });
  });

  it('purgeLanPatientFromHost returns not_configured without LAN REST session', async () => {
    setActiveLiveSyncRoom('sala-1');
    assert.deepEqual(await purgeLanPatientFromHost('p1'), { ok: false, error: 'not_configured' });
  });

  it('purgeLanPatientFromHost blocks owned_by_other_client unless force', async () => {
    seedLanSession();
    const result = await purgeLanPatientFromHost('p-owned', {
      fetchHostRow: async () => otherOwnerRow('p-owned'),
    });
    assert.deepEqual(result, { ok: false, error: 'owned_by_other_client', skipped: true });
  });

  it('purgeLanPatientFromHost bypasses ownership check with force', async () => {
    seedLanSession();
    let pushed = false;
    const result = await purgeLanPatientFromHost('p-force', {
      force: true,
      fetchHostRow: async () => otherOwnerRow('p-force'),
      pushDelete: async () => {
        pushed = true;
        return { ok: true, via: 'delete_census' };
      },
    });
    assert.equal(pushed, true);
    assert.equal(result.ok, true);
    assert.equal(result.hadHostRow, true);
  });

  it('purgeLanPatientFromHost uses registro hint when host row missing', async () => {
    seedLanSession();
    let registroUsed = '';
    const result = await purgeLanPatientFromHost('p-bundle', {
      registro: 'REG-BUNDLE',
      fetchHostRow: async () => null,
      pushDelete: async (_pid, hostRow, registro) => {
        registroUsed = registro;
        return { ok: true, via: 'delete_bundle' };
      },
    });
    assert.equal(registroUsed, 'REG-BUNDLE');
    assert.equal(result.ok, true);
    assert.equal(result.bundleOnly, true);
    assert.equal(result.hadHostRow, false);
  });

  it('purgeLanPatientFromHost propagates pushDelete failure', async () => {
    seedLanSession();
    const fail = { ok: false, error: 'host_reject_403', status: 403 };
    const result = await purgeLanPatientFromHost('p-fail', {
      fetchHostRow: async () => ({ id: 'p-fail', registro: 'R1', version: 1 }),
      pushDelete: async () => fail,
    });
    assert.deepEqual(result, fail);
  });

  it('purgeLanPatientFromHost bundleOnly skips host row fetch', async () => {
    seedLanSession();
    let fetchCalls = 0;
    await purgeLanPatientFromHost('p-only', {
      bundleOnly: true,
      registro: 'R-ONLY',
      fetchHostRow: async () => {
        fetchCalls += 1;
        return { id: 'p-only' };
      },
      pushDelete: async () => ({ ok: true, via: 'delete_bundle' }),
    });
    assert.equal(fetchCalls, 0);
  });

  it('purgeLanPatientFromHost hostOnly skips tombstone and uses census delete path', async () => {
    seedLanSession();
    let pushOpts = null;
    const result = await purgeLanPatientFromHost('p-host-only', {
      hostOnly: true,
      fetchHostRow: async () => ({ id: 'p-host-only', registro: 'REG-H', version: 2 }),
      pushDelete: async (_pid, _row, _reg, opts) => {
        pushOpts = opts;
        return { ok: true, via: 'delete_census' };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(pushOpts?.hostOnly, true);
    const map = JSON.parse(localStorage.getItem(LIVE_SYNC_ENTITIES_LS) || '{}');
    assert.equal(map['patient:p-host-only'], undefined);
  });

  it('rememberPatientDeleteTombstone writes _deleted patient entity', () => {
    rememberPatientDeleteTombstone({ id: 'p-tomb', registro: 'REG-T' });
    const map = JSON.parse(localStorage.getItem(LIVE_SYNC_ENTITIES_LS));
    const row = map['patient:p-tomb'];
    assert.equal(row._deleted, true);
    assert.equal(row.registro, 'REG-T');
  });

  it('rememberPatientDeleteTombstone ignores demo patients', () => {
    rememberPatientDeleteTombstone({ id: 'demo-x', registro: 'X' });
    assert.equal(localStorage.getItem(LIVE_SYNC_ENTITIES_LS), null);
  });

  it('clearPatientDeleteTombstoneForAdmit removes stale registro tombstones', () => {
    rememberPatientDeleteTombstone({ id: 'p-old', registro: 'REG-REUSE' });
    clearPatientDeleteTombstoneForAdmit('p-new', 'REG-REUSE');
    const map = JSON.parse(localStorage.getItem(LIVE_SYNC_ENTITIES_LS));
    assert.equal(map['patient:p-old'], undefined);
    assert.equal(map['patient:p-new'], undefined);
  });

  it('listPatientDeleteTombstones and clearPatientDeleteTombstones recover visibility', () => {
    rememberPatientDeleteTombstone({ id: 'p-a', registro: 'REG-A' });
    rememberPatientDeleteTombstone({ id: 'p-b', registro: 'REG-B' });
    assert.equal(listPatientDeleteTombstones().length, 2);
    assert.equal(clearPatientDeleteTombstones({ patientId: 'p-a' }), 1);
    assert.deepEqual(
      listPatientDeleteTombstones().map(function (r) {
        return r.id;
      }),
      ['p-b']
    );
    assert.equal(clearPatientDeleteTombstones(), 1);
    assert.equal(listPatientDeleteTombstones().length, 0);
  });

  it('acceptServerBundleConflict updates host bundle bases', () => {
    const bundle = { revision: 12, entityVersions: { 'patient:p1': 3 } };
    assert.equal(
      acceptServerBundleConflict({ roomId: 'sala-conf', serverBundle: bundle }),
      true
    );
    assert.equal(getHostBundleBases('sala-conf').revision, 12);
  });

  it('acceptServerBundleConflict rejects missing room or bundle', () => {
    assert.equal(acceptServerBundleConflict({ roomId: '', serverBundle: { revision: 1 } }), false);
    assert.equal(acceptServerBundleConflict({ roomId: 's', serverBundle: null }), false);
  });

  it('profiledMergeLiveSyncFullBundles merges multiple sources', () => {
    const merged = profiledMergeLiveSyncFullBundles([
      { revision: 1, entries: [{ patient: { id: 'a' } }] },
      { revision: 2, entries: [{ patient: { id: 'b' } }] },
    ]);
    assert.ok(Array.isArray(merged.entries));
    assert.ok(merged.entries.length >= 1);
  });

  it('host registry evictStale removes stale discovery entries', () => {
    upsertHost({
      fingerprint: 'fp-old',
      clientId: 'c1',
      startedAt: 1,
      currentUrl: 'http://10.0.0.1:3738',
      lastSeenAt: Date.now() - 120_000,
      source: 'scan',
    });
    upsertHost({
      fingerprint: 'fp-new',
      clientId: 'c2',
      startedAt: 2,
      currentUrl: 'http://10.0.0.2:3738',
      lastSeenAt: Date.now(),
      source: 'mdns',
    });
    evictStale(90_000);
    const fps = listHosts().map((h) => h.fingerprint);
    assert.deepEqual(fps, ['fp-new']);
  });

  it('buildEstadoActualCommand matches proof-domain shape', () => {
    const cmd = buildEstadoActualCommand({
      roomId: 'sala-1',
      patientId: 'p1',
      clientId: 'lc_a',
      baseSeq: 2,
      path: 'signosVitales.fc',
      value: 88,
      nowMs: () => 1,
      randomId: () => 'x',
    });
    assert.equal(cmd.domain, 'estadoActual');
    assert.equal(cmd.payload.value, 88);
  });
});
