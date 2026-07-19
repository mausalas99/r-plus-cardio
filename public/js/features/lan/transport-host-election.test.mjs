/** Host election + pin override guards. */
import './orchestrator.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../storage.js';
import { initLanSyncRuntime } from './runtime.mjs';
import { setPinnedHostUrl, getPinnedHostUrl } from '../../lan-host-pin.mjs';
import {
  applyPinnedHostOverride,
  registerLanSyncTransportDeps,
} from './transport.mjs';

const TEST_BEARER = 'c'.repeat(32);
const OWN_URL = 'http://10.0.0.57:3738';
const REMOTE_PIN = 'http://10.0.0.99:3738';

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

function seedClinicalProfile() {
  globalThis.localStorage.setItem(
    'rpc-settings',
    JSON.stringify({
      clinicalRank: 'R4',
      clinicalProgramAdmin: true,
      clinicalSala: 'Sala 1',
      clinicalLanProfileGateVersion: '6.6.6',
    })
  );
}

function stubBrowserGlobals() {
  globalThis.window = {
    electronAPI: {
      getLanCandidateBaseUrl: async () => OWN_URL,
      getLanEffectiveTeamCode: async () => ({ ok: true, code: TEST_BEARER }),
      getLanGuestBearer: async () => ({ ok: false }),
    },
  };
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    body: { appendChild: () => {}, classList: { contains: () => false } },
    dispatchEvent: () => true,
  };
  globalThis.confirm = () => true;
}

function fakeLanClient() {
  return {
    configure() {},
    connectSyncChannel() {},
    disconnect() {},
    connected: false,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    baseUrl: () => '',
  };
}

describe('applyPinnedHostOverride host role guard', () => {
  beforeEach(() => {
    mockLocalStorage();
    seedClinicalProfile();
    stubBrowserGlobals();
    initLanSyncRuntime({ lanClient: fakeLanClient() });
    registerLanSyncTransportDeps({
      runtime: { showToast() {} },
      renderLanPanel: () => {},
    });
    storage.saveLanUiRole('host');
    storage.saveLanConfig({ hostUrl: OWN_URL, teamCode: TEST_BEARER });
    setPinnedHostUrl(REMOTE_PIN);
  });

  it('repins remote pin locally instead of joining remote host when uiRole is host', async () => {
    const ok = await applyPinnedHostOverride(TEST_BEARER, { quiet: true, boot: true });
    assert.equal(ok, true);
    assert.equal(storage.getLanUiRole(), 'host');
    assert.equal(getPinnedHostUrl(), OWN_URL);
  });

  it('joins remote pin when uiRole is client', async () => {
    storage.saveLanUiRole('client');
    globalThis.fetch = async () => ({ ok: true, status: 200 });
    let joinedUrl = '';
    initLanSyncRuntime({
      lanClient: {
        configure(cfg) {
          joinedUrl = cfg.hostUrl;
        },
        connectSyncChannel() {},
        disconnect() {},
        connected: false,
        fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
        baseUrl: () => joinedUrl,
      },
    });
    registerLanSyncTransportDeps({
      runtime: { showToast() {} },
      renderLanPanel: () => {},
    });
    const ok = await applyPinnedHostOverride(TEST_BEARER, { quiet: true, boot: true });
    assert.equal(ok, true);
    assert.equal(storage.getLanUiRole(), 'client');
    assert.equal(storage.getLanConfig().hostUrl, REMOTE_PIN);
  });
});
