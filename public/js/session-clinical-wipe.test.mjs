import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  SESSION_WEB_LS_KEYS,
  wipeSessionClinicalStorage,
  shouldInstallSessionClinicalWipe,
  isSessionScopedWebClient,
} from './session-clinical-wipe.mjs';

let store = {};
const mockStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

beforeEach(() => {
  store = {
    'rpc-patients': '[]',
    'rpc-notes': '{}',
    'rplus.lan.bearer': 'token',
    theme: 'dark',
  };
  globalThis.localStorage = mockStorage;
  globalThis.window = { localStorage: mockStorage };
  delete globalThis.__RPC_MOBILE_WEB__;
  if (globalThis.document?.documentElement) {
    globalThis.document.documentElement.classList.remove('rpc-mobile-web');
  }
});

test('wipeSessionClinicalStorage removes clinical and LAN session keys', () => {
  const removed = wipeSessionClinicalStorage();
  assert.ok(removed >= 3);
  assert.equal(store['rpc-patients'], undefined);
  assert.equal(store['rplus.lan.bearer'], undefined);
  assert.equal(store.theme, 'dark');
});

test('wipeSessionClinicalStorage can skip LAN keys', () => {
  wipeSessionClinicalStorage({ includeLanSession: false });
  assert.equal(store['rpc-patients'], undefined);
  assert.equal(store['rplus.lan.bearer'], 'token');
});

test('shouldInstallSessionClinicalWipe is true for mobile web without electron API', () => {
  globalThis.__RPC_MOBILE_WEB__ = true;
  assert.equal(shouldInstallSessionClinicalWipe(), true);
});

test('shouldInstallSessionClinicalWipe is false for desktop db mode', () => {
  globalThis.__RPC_MOBILE_WEB__ = true;
  globalThis.window = {
    localStorage: mockStorage,
    electronAPI: { dbClinicalLoadAll: async () => ({ ok: true, blobs: {} }) },
  };
  assert.equal(shouldInstallSessionClinicalWipe(), false);
});

test('isSessionScopedWebClient is false without mobile/web clinical runtime flags', () => {
  assert.equal(isSessionScopedWebClient(), false);
});

test('isSessionScopedWebClient is true with __RPC_WEB_CLINICAL__', () => {
  globalThis.__RPC_WEB_CLINICAL__ = true;
  assert.equal(isSessionScopedWebClient(), true);
  delete globalThis.__RPC_WEB_CLINICAL__;
});

test('SESSION_WEB_LS_KEYS includes bearer', () => {
  assert.ok(SESSION_WEB_LS_KEYS.includes('rplus.lan.bearer'));
});
