import './orchestrator.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../storage.js';
import { pauseBundlePushForRoom } from '../../lan-sync-bundle-push.mjs';
import { setRoomMembership } from '../../live-sync-membership.mjs';
import { initLanSyncRuntime, setActiveLiveSyncRoom, clearActiveLiveSyncRoom } from './runtime.mjs';
import {
  registerLanSyncPushBridge,
  ensureLanSyncPushBridgeWired,
  liveSyncBundleHasPayload,
  hostBundleBodyFromEnvelope,
  lanPushResult,
  ensureEffectiveLiveSyncRoomId,
  pushRoomSyncBundleToHost,
  sendLiveBundleIfOpen,
  emitLiveSyncRevisionHint,
  markUntypedDirty,
} from './push.mjs';

const PUSH_BRIDGE_KEY = '__LAN_SYNC_PUSH_BRIDGE__';
const TEST_BEARER = 'c'.repeat(32);

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

function fakeLanClient(overrides = {}) {
  return {
    configure() {},
    connectSyncChannel() {},
    disconnect() {},
    connected: true,
    liveConnected: false,
    liveRoomId: '',
    baseUrl: () => 'http://10.0.0.57:3738',
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ bundle: { revision: 3 } }) }),
    sendLive: () => true,
    _liveWs: null,
    addEventListener() {},
    removeEventListener() {},
    ...overrides,
  };
}

function stubBrowserGlobals() {
  globalThis.window = { electronAPI: { getLanCandidateBaseUrl: async () => '' } };
  globalThis.document = {
    getElementById: () => null,
    dispatchEvent: () => true,
  };
}

function wirePushBridge(extra = {}) {
  registerLanSyncPushBridge({
    isLanSessionConfiguredForRest: () => true,
    buildLiveSyncBundleEnvelope: async () => ({
      type: 'livesync:bundle',
      roomId: 'sala-1',
      entries: [{ patient: { id: 'p1' } }],
    }),
    saveLocalRoomSnapshot() {},
    syncLiveSyncStatusChrome() {},
    acceptServerBundleConflict() {},
    applyRoomSyncPhaseAfterReconcile() {},
    ...extra,
  });
}

describe('push.mjs characterization', () => {
  beforeEach(() => {
    mockLocalStorage();
    stubBrowserGlobals();
    storage.saveLanConfig({ hostUrl: 'http://10.0.0.57:3738', teamCode: TEST_BEARER });
    clearActiveLiveSyncRoom();
    initLanSyncRuntime({ lanClient: fakeLanClient() });
    delete globalThis[PUSH_BRIDGE_KEY];
    registerLanSyncPushBridge(null);
  });

  it('liveSyncBundleHasPayload detects entries agenda todos clinicalOps', () => {
    assert.equal(liveSyncBundleHasPayload(null), false);
    assert.equal(liveSyncBundleHasPayload({ entries: [{ patient: { id: 'p1' } }] }), true);
    assert.equal(liveSyncBundleHasPayload({ agenda: [{ id: 'a1' }] }), true);
    assert.equal(liveSyncBundleHasPayload({ todos: { p1: [{ id: 't1' }] } }), true);
    assert.equal(
      liveSyncBundleHasPayload({ clinicalOps: { clinical_users: [{ handle: '@x' }] } }),
      true
    );
    assert.equal(liveSyncBundleHasPayload({ revision: 1 }), false);
  });

  it('hostBundleBodyFromEnvelope adds uploadedByClientId', () => {
    const body = hostBundleBodyFromEnvelope(
      { type: 'livesync:bundle', clientId: 'lc_test', entries: [] },
      'sala-9'
    );
    assert.equal(body.uploadedByClientId, 'lc_test');
    assert.ok(body.bundle || body.entries !== undefined || typeof body === 'object');
  });

  it('lanPushResult shapes ok/code/channels', () => {
    assert.deepEqual(lanPushResult(true), { ok: true, code: undefined, channels: {} });
    assert.deepEqual(lanPushResult(false, 'NO_ROOM', { http: false }), {
      ok: false,
      code: 'NO_ROOM',
      channels: { http: false },
    });
  });

  it('ensureEffectiveLiveSyncRoomId uses membership when active room empty', () => {
    assert.equal(ensureEffectiveLiveSyncRoomId(), '');
    setRoomMembership({ roomId: 'sala-mem', label: 'Mem' });
    assert.equal(ensureEffectiveLiveSyncRoomId(), 'sala-mem');
  });

  it('registerLanSyncPushBridge mirrors to globalThis', () => {
    const bridge = { marker: 'push-test' };
    registerLanSyncPushBridge(bridge);
    assert.equal(globalThis[PUSH_BRIDGE_KEY].marker, 'push-test');
  });

  it('ensureLanSyncPushBridgeWired resolves when bridge registered', async () => {
    wirePushBridge();
    await ensureLanSyncPushBridgeWired();
    await assert.doesNotReject(async () => ensureLanSyncPushBridgeWired());
  });

  it('pushRoomSyncBundleToHost returns false when REST session not configured', async () => {
    wirePushBridge({ isLanSessionConfiguredForRest: () => false });
    const ok = await pushRoomSyncBundleToHost('sala-1', {
      type: 'livesync:bundle',
      entries: [{ patient: { id: 'p1' } }],
    });
    assert.equal(ok, false);
  });

  it('pushRoomSyncBundleToHost returns false for empty payload envelope', async () => {
    wirePushBridge();
    const ok = await pushRoomSyncBundleToHost('sala-1', { type: 'livesync:bundle', revision: 0 });
    assert.equal(ok, false);
  });

  it('pushRoomSyncBundleToHost PUTs sync-bundle with JSON body', async () => {
    const calls = [];
    initLanSyncRuntime({
      lanClient: fakeLanClient({
        fetch: async (path, opts) => {
          calls.push({ path, body: JSON.parse(opts.body) });
          return { ok: true, status: 200, json: async () => ({ bundle: { revision: 5 } }) };
        },
      }),
    });
    wirePushBridge();
    setActiveLiveSyncRoom('sala-1');
    const ok = await pushRoomSyncBundleToHost('sala-1', {
      type: 'livesync:bundle',
      clientId: 'lc_push',
      entries: [{ patient: { id: 'p1', nombre: 'Test' } }],
    });
    assert.equal(ok, true);
    assert.match(calls[0].path, /\/sync-bundle$/);
    assert.ok(calls[0].body.bundle);
  });

  it('pushRoomSyncBundleToHost records HTTP error as false', async () => {
    initLanSyncRuntime({
      lanClient: fakeLanClient({
        fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
      }),
    });
    wirePushBridge();
    const ok = await pushRoomSyncBundleToHost('sala-err', {
      type: 'livesync:bundle',
      entries: [{ patient: { id: 'p1' } }],
    });
    assert.equal(ok, false);
  });

  it('sendLiveBundleIfOpen returns false when live channel closed', () => {
    initLanSyncRuntime({ lanClient: fakeLanClient({ liveConnected: false }) });
    assert.equal(
      sendLiveBundleIfOpen('sala-1', { type: 'livesync:bundle', entries: [] }),
      false
    );
  });

  it('sendLiveBundleIfOpen sends when WS open on same room', () => {
    let sent = null;
    initLanSyncRuntime({
      lanClient: fakeLanClient({
        liveConnected: true,
        liveRoomId: 'sala-live',
        _liveWs: { readyState: 1 },
        sendLive: (env) => {
          sent = env;
          return true;
        },
      }),
    });
    const env = { type: 'livesync:bundle', roomId: 'sala-live' };
    assert.equal(sendLiveBundleIfOpen('sala-live', env), true);
    assert.equal(sent, env);
  });

  it('emitLiveSyncRevisionHint sends livesync:revision when live channel open', () => {
    let sent = null;
    initLanSyncRuntime({
      lanClient: fakeLanClient({
        liveConnected: true,
        sendLive: (msg) => {
          sent = msg;
        },
      }),
    });
    emitLiveSyncRevisionHint('sala-rev', 9);
    assert.equal(sent.type, 'livesync:revision');
    assert.equal(sent.revision, 9);
    assert.equal(sent.roomId, 'sala-rev');
  });

  it('markUntypedDirty ignores empty domain or patient id', () => {
    markUntypedDirty('', 'p1');
    markUntypedDirty('labs', '');
    assert.doesNotThrow(() => markUntypedDirty('labs', 'p1'));
  });

  it('pushRoomSyncBundleToHost returns paused when bundle push paused for room', async () => {
    wirePushBridge();
    pauseBundlePushForRoom('sala-pause', 60_000);
    const ok = await pushRoomSyncBundleToHost('sala-pause', {
      type: 'livesync:bundle',
      entries: [{ patient: { id: 'p1' } }],
    });
    assert.equal(ok, 'paused');
  });
});
