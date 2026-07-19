/** Prime LAN module graph (panel→orchestrator cycle) before transport direct import. */
import './orchestrator.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../storage.js';
import { initLanSyncRuntime } from './runtime.mjs';
import {
  trimStoredLanBearer,
  isLocalLoopbackLanUrl,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLanSessionConfiguredForRest,
  persistLanClientConfig,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  maybeApplyLanHostUrlSwitch,
  formatLanTicketExpiryLabel,
  lanTicketExpirySoon,
  registerLanSyncTransportDeps,
  ensureLanSyncTransportDepsWired,
  mintLanPairingTicket,
  ensureLanPairingForShare,
  lanFetchAuthed,
} from './transport.mjs';

const LAN_DEPS_KEY = '__LAN_SYNC_TRANSPORT_DEPS__';
const TEST_BEARER = 'b'.repeat(32);

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

function seedLanConfig(overrides = {}) {
  storage.saveLanConfig({
    hostUrl: 'http://10.0.0.57:3738',
    teamCode: TEST_BEARER,
    ...overrides,
  });
}

function stubBrowserGlobals() {
  globalThis.window = {
    electronAPI: {
      getLanCandidateBaseUrl: async () => 'http://10.0.0.57:3738',
      getLanEffectiveTeamCode: async () => ({ ok: false }),
      getLanGuestBearer: async () => ({ ok: false }),
    },
  };
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    body: { appendChild: () => {} },
    dispatchEvent: () => true,
  };
}

function fakeLanClient(fetchImpl) {
  return {
    configure() {},
    connectSyncChannel() {},
    disconnect() {},
    connected: false,
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}) })),
    baseUrl: () => 'http://10.0.0.57:3738',
  };
}

describe('transport.mjs characterization', () => {
  beforeEach(() => {
    mockLocalStorage();
    stubBrowserGlobals();
    initLanSyncRuntime({ lanClient: fakeLanClient() });
    delete globalThis[LAN_DEPS_KEY];
    registerLanSyncTransportDeps(null);
  });

  it('trimStoredLanBearer trims whitespace', () => {
    assert.equal(trimStoredLanBearer('  abc  '), 'abc');
    assert.equal(trimStoredLanBearer(''), '');
  });

  it('isLocalLoopbackLanUrl detects loopback hosts', () => {
    assert.equal(isLocalLoopbackLanUrl('http://localhost:3738'), true);
    assert.equal(isLocalLoopbackLanUrl('http://127.0.0.1:3738/'), true);
    assert.equal(isLocalLoopbackLanUrl('http://10.0.0.57:3738'), false);
  });

  it('isLanElectronDesktop requires electronAPI candidate URL IPC', () => {
    delete globalThis.window;
    assert.equal(isLanElectronDesktop(), false);
    stubBrowserGlobals();
    assert.equal(isLanElectronDesktop(), true);
  });

  it('isLanRemoteJoinMode reflects storage ui role', () => {
    storage.saveLanUiRole('client');
    assert.equal(isLanRemoteJoinMode(), true);
    storage.saveLanUiRole('host');
    assert.equal(isLanRemoteJoinMode(), false);
  });

  it('isLanSessionConfiguredForRest needs hostUrl and bearer', () => {
    assert.equal(isLanSessionConfiguredForRest(), false);
    seedLanConfig();
    assert.equal(isLanSessionConfiguredForRest(), true);
    storage.saveLanConfig({ hostUrl: 'http://10.0.0.1:3738', teamCode: '' });
    assert.equal(isLanSessionConfiguredForRest(), false);
  });

  it('persistLanClientConfig writes storage and configures lan client', () => {
    const client = fakeLanClient();
    let configured = null;
    client.configure = (cfg) => {
      configured = cfg;
    };
    initLanSyncRuntime({ lanClient: client });
    const changed = persistLanClientConfig('http://10.0.0.8:3738/', TEST_BEARER);
    assert.equal(changed, true);
    assert.equal(storage.getLanConfig().hostUrl, 'http://10.0.0.8:3738');
    assert.equal(configured.hostUrl, 'http://10.0.0.8:3738');
    assert.equal(getLanTeamCodeFromConfig(), TEST_BEARER);
  });

  it('applyLanHostUrlSwitch rejects empty URL', () => {
    assert.equal(applyLanHostUrlSwitch('', TEST_BEARER), false);
    seedLanConfig();
    assert.equal(applyLanHostUrlSwitch('http://10.0.0.9:3738', TEST_BEARER), true);
  });

  it('maybeApplyLanHostUrlSwitch honors blockSwitch', () => {
    seedLanConfig();
    assert.equal(
      maybeApplyLanHostUrlSwitch('http://10.0.0.10:3738', TEST_BEARER, { blockSwitch: true }),
      false
    );
  });

  it('formatLanTicketExpiryLabel returns empty for invalid input', () => {
    assert.equal(formatLanTicketExpiryLabel(''), '');
    assert.equal(formatLanTicketExpiryLabel('not-a-date'), '');
    const label = formatLanTicketExpiryLabel('2026-06-12T18:30:00.000Z');
    assert.match(label, /\d{1,2}:\d{2}/);
  });

  it('lanTicketExpirySoon is true within one minute', () => {
    const soon = new Date(Date.now() + 30_000).toISOString();
    const later = new Date(Date.now() + 120_000).toISOString();
    assert.equal(lanTicketExpirySoon(soon), true);
    assert.equal(lanTicketExpirySoon(later), false);
  });

  it('registerLanSyncTransportDeps mirrors deps to globalThis bridge', () => {
    const deps = { runtime: { marker: 'transport-test' } };
    registerLanSyncTransportDeps(deps);
    assert.equal(globalThis[LAN_DEPS_KEY].runtime.marker, 'transport-test');
  });

  it('ensureLanSyncTransportDepsWired reads global when module deps cleared', async () => {
    const deps = { runtime: { showToast() {} } };
    registerLanSyncTransportDeps(deps);
    registerLanSyncTransportDeps(null);
    globalThis[LAN_DEPS_KEY] = deps;
    await ensureLanSyncTransportDepsWired();
    registerLanSyncTransportDeps(deps);
    await assert.doesNotReject(async () => ensureLanSyncTransportDepsWired());
  });

  it('mintLanPairingTicket throws no_host_bearer without token', async () => {
    seedLanConfig({ teamCode: 'short' });
    await assert.rejects(mintLanPairingTicket, (err) => err.code === 'no_host_bearer');
  });

  it('mintLanPairingTicket posts to auth tickets with bearer configured', async () => {
    seedLanConfig();
    const calls = [];
    initLanSyncRuntime({
      lanClient: fakeLanClient(async (path, opts) => {
        calls.push({ path, method: opts && opts.method });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ticketId: 'tkt_1',
            pin: '123456',
            expiresAt: '2026-06-12T20:00:00.000Z',
          }),
        };
      }),
    });
    const pairing = await mintLanPairingTicket();
    assert.equal(pairing.ticketId, 'tkt_1');
    assert.equal(calls[0].path, '/api/lan/v1/auth/tickets');
    assert.equal(calls[0].method, 'POST');
  });

  it('ensureLanPairingForShare throws no_host_url when share base empty', async () => {
    globalThis.window.electronAPI.getLanCandidateBaseUrl = async () => '';
    storage.saveLanConfig({ hostUrl: '', teamCode: TEST_BEARER });
    await assert.rejects(ensureLanPairingForShare, (err) => err.code === 'no_host_url');
  });

  it('lanFetchAuthed attaches X-Client-Token when stored', async () => {
    seedLanConfig();
    globalThis.localStorage.setItem('rpc-lan-client-token', 'cit_testtoken');
    const calls = [];
    initLanSyncRuntime({
      lanClient: fakeLanClient(async (path, opts) => {
        calls.push({ path, headers: opts && opts.headers });
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    });
    await lanFetchAuthed('/api/lan/v1/host-status');
    assert.equal(calls[0].headers['X-Client-Token'], 'cit_testtoken');
  });

  it('lanFetchAuthed omits X-Client-Token when not stored', async () => {
    seedLanConfig();
    const calls = [];
    initLanSyncRuntime({
      lanClient: fakeLanClient(async (path, opts) => {
        calls.push({ path, headers: opts && opts.headers });
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    });
    await lanFetchAuthed('/api/lan/v1/host-status');
    assert.equal(calls[0].headers && calls[0].headers['X-Client-Token'], undefined);
  });
});
