import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  TOKEN_KEY,
  loadAccessToken,
  persistAccessToken,
  clearAccessToken,
  readTokenFromCookieHeader,
  readTokenFromUrl,
  fetchCloudInviteToken,
} from './equipos-token.mjs';

describe('equipos-token', () => {
  /** @type {Record<string, string>} */
  let store;

  beforeEach(() => {
    store = {};
    globalThis.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
    globalThis.sessionStorage = {
      getItem: () => null,
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
    globalThis.document = { cookie: '' };
    globalThis.location = { search: '', protocol: 'https:' };
    if (globalThis.window) globalThis.window.location = globalThis.location;
  });

  it('readTokenFromCookieHeader parses rpc-equipos-token', () => {
    assert.equal(
      readTokenFromCookieHeader('foo=1; rpc-equipos-token=abc123; bar=2'),
      'abc123'
    );
  });

  it('readTokenFromUrl parses t query param', () => {
    assert.equal(readTokenFromUrl('?t=url-token-hex'), 'url-token-hex');
  });

  it('persistAccessToken mirrors URL token into storage', () => {
    persistAccessToken('url-token-hex');
    assert.equal(store[TOKEN_KEY], 'url-token-hex');
  });

  it('loadAccessToken falls back to cookie when storage empty', () => {
    globalThis.document.cookie = 'rpc-equipos-token=cookie-token-hex';
    assert.equal(loadAccessToken(), 'cookie-token-hex');
    assert.equal(store[TOKEN_KEY], 'cookie-token-hex');
  });

  it('persistAccessToken writes cookie and storage', () => {
    persistAccessToken('saved-token');
    assert.equal(store[TOKEN_KEY], 'saved-token');
    assert.match(globalThis.document.cookie, /rpc-equipos-token=saved-token/);
  });

  it('fetchCloudInviteToken persists token from invite endpoint', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, 'https://rmas-lista-de-espera.example/api/equipos/v1/access/invite');
      return {
        ok: true,
        json: async () => ({ ok: true, token: 'cloud-invite-token' }),
      };
    };
    const token = await fetchCloudInviteToken('https://rmas-lista-de-espera.example');
    assert.equal(token, 'cloud-invite-token');
    assert.equal(store[TOKEN_KEY], 'cloud-invite-token');
  });

  it('clearAccessToken removes storage and cookie', () => {
    persistAccessToken('stale-token');
    clearAccessToken();
    assert.equal(store[TOKEN_KEY], undefined);
    assert.match(globalThis.document.cookie, /max-age=0/);
  });

  it('fetchCloudInviteToken returns empty on inactive invite', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      json: async () => ({ error: 'access_inactive' }),
    });
    assert.equal(await fetchCloudInviteToken('https://example.test'), '');
  });
});
