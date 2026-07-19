import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  pushBundleToHostUrl,
  runConsolidateIntoHost,
} from './lan-host-consolidation.mjs';

const TEAM = 'team-code-32-chars-minimum-xxxxxx';

describe('pushBundleToHostUrl', () => {
  /** @type {typeof globalThis.fetch} */
  let origFetch;

  beforeEach(() => {
    origFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('PUTs to winner base URL with bearer, returns false on non-2xx', async () => {
    let called = '';
    global.fetch = async (url, init) => {
      called = String(url);
      assert.equal(init.method, 'PUT');
      assert.match(called, /\/api\/lan\/v1\/rooms\/room-1\/sync-bundle$/);
      return { ok: false, status: 503 };
    };
    const ok = await pushBundleToHostUrl(
      'http://10.0.0.5:3738',
      TEAM,
      'room-1',
      { clientId: 'c1', agenda: [], todos: {}, entries: [] }
    );
    assert.equal(ok, false);
    assert.match(called, /^http:\/\/10\.0\.0\.5:3738\//);
  });
});

describe('runConsolidateIntoHost', () => {
  it('push succeeds before handoff and role switch', async () => {
    const order = [];
    const deps = {
      buildBundle: async () => ({ revision: 2, agenda: [], todos: {}, entries: [] }),
      pushBundle: async () => {
        order.push('push');
        return true;
      },
      broadcastHandoff: async () => {
        order.push('handoff');
      },
      switchToClient: async () => {
        order.push('switch');
      },
      confirmYield: async () => true,
      showToast: () => {},
      getRoomId: () => 'room-1',
    };
    const ok = await runConsolidateIntoHost(
      { winnerUrl: 'http://10.0.0.5:3738', teamCode: TEAM },
      deps
    );
    assert.equal(ok, true);
    assert.deepEqual(order, ['push', 'handoff', 'switch']);
  });

  it('push failure aborts — no handoff or switch', async () => {
    const order = [];
    const deps = {
      buildBundle: async () => ({}),
      pushBundle: async () => {
        order.push('push');
        return false;
      },
      broadcastHandoff: async () => order.push('handoff'),
      switchToClient: async () => order.push('switch'),
      confirmYield: async () => true,
      showToast: () => {},
      getRoomId: () => 'room-1',
    };
    const ok = await runConsolidateIntoHost(
      { winnerUrl: 'http://10.0.0.5:3738', teamCode: TEAM },
      deps
    );
    assert.equal(ok, false);
    assert.deepEqual(order, ['push']);
  });

  it('declined confirm keeps host', async () => {
    const deps = {
      buildBundle: async () => ({}),
      pushBundle: async () => true,
      broadcastHandoff: async () => {},
      switchToClient: async () => {},
      confirmYield: async () => false,
      showToast: () => {},
      getRoomId: () => 'room-1',
    };
    const ok = await runConsolidateIntoHost(
      { winnerUrl: 'http://10.0.0.5:3738', teamCode: TEAM, requireConfirm: true },
      deps
    );
    assert.equal(ok, false);
  });
});
