/** Prime LAN module graph (panel→orchestrator cycle) before room direct import. */
import './orchestrator.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../../storage.js';
import { setRoomMembership, clearRoomMembership } from '../../live-sync-membership.mjs';
import { RoomSyncPhase, getRoomSyncPhase, clearRoomSyncPhase } from '../../lan-sync-state.mjs';
import {
  initLanSyncRuntime,
  setActiveLiveSyncRoom,
  clearActiveLiveSyncRoom,
  getLiveSyncPushTimer,
  setLiveSyncPushTimer,
  getLiveSyncRevisionReconcileTimer,
  setLiveSyncRevisionReconcileTimer,
} from './runtime.mjs';
import { registerLanSyncPushBridge } from './push.mjs';
import { stopLiveSyncOutboxFlush } from './push-outbox.mjs';
import { stopLiveSyncReconnectLoop } from './room-host-failover.mjs';
import {
  registerLanSyncRoomBridge,
  ensureLanSyncRoomBridgeWired,
  buildLiveSyncHelloPayload,
  enrichLiveSyncHelloPayload,
  stopSurrogateFailoverTimer,
  applyRoomSyncPhaseAfterReconcile,
  waitForLiveChannelOpen,
  joinLanRoom,
  shouldApplyCommandBroadcast,
  updateCommandSeqState,
} from './room.mjs';

const ROOM_BRIDGE_KEY = '__LAN_SYNC_ROOM_BRIDGE__';
const PUSH_BRIDGE_KEY = '__LAN_SYNC_PUSH_BRIDGE__';
const TEST_BEARER = 'd'.repeat(32);

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
  const listeners = {};
  return {
    configure() {},
    connectSyncChannel() {},
    connectLiveChannel() {},
    disconnect() {},
    disconnectLiveChannel() {},
    connected: true,
    liveConnected: false,
    liveRoomId: '',
    baseUrl: () => 'http://10.0.0.57:3738',
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    sendLive() {},
    addEventListener(ev, cb) {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(cb);
    },
    removeEventListener(ev, cb) {
      listeners[ev] = (listeners[ev] || []).filter((fn) => fn !== cb);
    },
    _emit(ev, detail) {
      (listeners[ev] || []).forEach((cb) => cb({ detail }));
    },
    ...overrides,
  };
}

function stubBrowserGlobals() {
  globalThis.window = {
    electronAPI: { getLanCandidateBaseUrl: async () => 'http://10.0.0.57:3738' },
  };
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    dispatchEvent: () => true,
  };
}

function wirePushBridge(extra = {}) {
  registerLanSyncPushBridge({
    isLanSessionConfiguredForRest: () => true,
    buildLiveSyncBundleEnvelope: async () => ({
      type: 'livesync:bundle',
      roomId: 'sala-1',
      entries: [],
    }),
    saveLocalRoomSnapshot() {},
    buildLiveSyncLocalMergeSource: () => ({}),
    mergeLiveSyncFullBundles: () => ({}),
    applyLiveSyncMerged: async () => {},
    applyLiveSyncDeltas: async () => {},
    reapplyLanPatientEntries: async () => {},
    applyRoomSyncPhaseAfterReconcile() {},
    fetchAndApplyClinicalOpsFromHost: async () => false,
    syncLiveSyncStatusChrome() {},
    acceptServerBundleConflict() {},
    acceptServerClinicalOpsConflict() {},
    renderLanPanel() {},
    showToast() {},
    ...extra,
  });
}

function teardownLanSyncTestTimers() {
  stopSurrogateFailoverTimer();
  stopLiveSyncReconnectLoop();
  stopLiveSyncOutboxFlush();
  const pushTimer = getLiveSyncPushTimer();
  if (pushTimer) clearTimeout(pushTimer);
  setLiveSyncPushTimer(null);
  const reconcileTimer = getLiveSyncRevisionReconcileTimer();
  if (reconcileTimer) clearTimeout(reconcileTimer);
  setLiveSyncRevisionReconcileTimer(null);
}

function wireRoomBridge(extra = {}) {
  const toasts = [];
  registerLanSyncRoomBridge({
    runtime: {
      showToast: (msg, kind) => toasts.push({ msg, kind }),
      renderProcedureAgendaPanel() {},
      renderPatientList() {},
    },
    initLanClientFromStorage() {},
    patchLanPanelJoinButtons() {},
    renderLanPanel() {},
    rememberLanRoomJoined() {},
    collectPatientIdsForLiveSync: () => [],
    collectPatientEntriesForLanSync: () => [],
    ...extra,
  });
  return { toasts };
}

describe('room.mjs characterization', () => {
  beforeEach(() => {
    teardownLanSyncTestTimers();
    mockLocalStorage();
    stubBrowserGlobals();
    storage.saveLanConfig({ hostUrl: 'http://10.0.0.57:3738', teamCode: TEST_BEARER });
    clearActiveLiveSyncRoom();
    clearRoomMembership();
    clearRoomSyncPhase('sala-1');
    initLanSyncRuntime({ lanClient: fakeLanClient() });
    delete globalThis[ROOM_BRIDGE_KEY];
    delete globalThis[PUSH_BRIDGE_KEY];
    registerLanSyncRoomBridge(null);
    registerLanSyncPushBridge(null);
    wirePushBridge();
  });

  afterEach(() => {
    teardownLanSyncTestTimers();
    initLanSyncRuntime({ lanClient: fakeLanClient() });
    clearActiveLiveSyncRoom();
    clearRoomMembership();
    registerLanSyncRoomBridge(null);
    registerLanSyncPushBridge(null);
    delete globalThis[ROOM_BRIDGE_KEY];
    delete globalThis[PUSH_BRIDGE_KEY];
  });

  it('buildLiveSyncHelloPayload includes client and room metadata', () => {
    localStorage.setItem('rpc-lan-client-id', 'lc_room');
    const payload = buildLiveSyncHelloPayload('sala-hello');
    assert.equal(payload.type, 'livesync:hello');
    assert.equal(payload.roomId, 'sala-hello');
    assert.equal(payload.clientId, 'lc_room');
    assert.equal(payload.capabilities.deltaSync, 1);
  });

  it('enrichLiveSyncHelloPayload adds hostUrl when canHost', async () => {
    storage.saveLanUiRole('host');
    const enriched = await enrichLiveSyncHelloPayload({ canHost: true });
    assert.equal(enriched.hostUrl, 'http://10.0.0.57:3738');
  });

  it('registerLanSyncRoomBridge mirrors deps to globalThis', () => {
    const bridge = { marker: 'room-test' };
    registerLanSyncRoomBridge(bridge);
    assert.equal(globalThis[ROOM_BRIDGE_KEY].marker, 'room-test');
  });

  it('ensureLanSyncRoomBridgeWired resolves when bridge registered', async () => {
    wireRoomBridge();
    await ensureLanSyncRoomBridgeWired();
    await assert.doesNotReject(async () => ensureLanSyncRoomBridgeWired());
  });

  it('shouldApplyCommandBroadcast ignores stale or duplicate seq', () => {
    const state = { lastAppliedSeq: 5 };
    assert.deepEqual(shouldApplyCommandBroadcast(state, { deltaSeq: 5 }), { action: 'ignore' });
    assert.deepEqual(shouldApplyCommandBroadcast(state, { deltaSeq: 7 }), {
      action: 'catch_up',
      afterSeq: 5,
    });
    assert.deepEqual(shouldApplyCommandBroadcast(state, { deltaSeq: 6 }), { action: 'apply' });
  });

  it('updateCommandSeqState advances lastAppliedSeq', () => {
    const next = updateCommandSeqState({ lastAppliedSeq: 2 }, { deltaSeq: 3, commandId: 'cmd-1' });
    assert.equal(next.lastAppliedSeq, 3);
    assert.equal(next.lastAckedCommandId, 'cmd-1');
  });

  it('applyRoomSyncPhaseAfterReconcile sets live when WS connected', () => {
    wireRoomBridge();
    setActiveLiveSyncRoom('sala-1', 'Sala');
    initLanSyncRuntime({
      lanClient: fakeLanClient({ liveConnected: true, liveRoomId: 'sala-1' }),
    });
    applyRoomSyncPhaseAfterReconcile('sala-1');
    assert.equal(getRoomSyncPhase('sala-1'), RoomSyncPhase.live);
  });

  it('applyRoomSyncPhaseAfterReconcile sets degraded when WS disconnected', () => {
    wireRoomBridge();
    setRoomMembership({ roomId: 'sala-2', label: 'S2' });
    initLanSyncRuntime({ lanClient: fakeLanClient({ liveConnected: false }) });
    applyRoomSyncPhaseAfterReconcile('sala-2');
    assert.equal(getRoomSyncPhase('sala-2'), RoomSyncPhase.degraded);
  });

  it('waitForLiveChannelOpen resolves true when already connected', async () => {
    initLanSyncRuntime({
      lanClient: fakeLanClient({
        liveConnected: true,
        liveRoomId: 'sala-open',
        _liveWs: { readyState: 1 },
      }),
    });
    assert.equal(await waitForLiveChannelOpen('sala-open', 1000), true);
  });

  it('waitForLiveChannelOpen resolves on lan-live-status event', async () => {
    const client = fakeLanClient({ liveConnected: false });
    initLanSyncRuntime({ lanClient: client });
    const pending = waitForLiveChannelOpen('sala-wait', 2000);
    setTimeout(() => client._emit('lan-live-status', { connected: true, roomId: 'sala-wait' }), 20);
    assert.equal(await pending, true);
  });

  it('joinLanRoom toasts when room id empty', async () => {
    const { toasts } = wireRoomBridge();
    await joinLanRoom('', 'Sala');
    assert.equal(toasts.length, 1);
    assert.match(toasts[0].msg, /No se pudo identificar la sala/);
  });

  it('joinLanRoom toasts when LAN REST not configured', async () => {
    storage.saveLanConfig({ hostUrl: '', teamCode: '' });
    globalThis.window = {};
    const { toasts } = wireRoomBridge();
    await joinLanRoom('sala-x', 'Sala');
    assert.match(toasts[0].msg, /Primero conecta al servidor/);
  });

  it('joinLanRoom short-circuits when already in same live room', async () => {
    const { toasts } = wireRoomBridge();
    setActiveLiveSyncRoom('sala-same', 'Same');
    initLanSyncRuntime({
      lanClient: fakeLanClient({ liveConnected: true, liveRoomId: 'sala-same' }),
    });
    await joinLanRoom('sala-same', 'Same');
    assert.equal(toasts.some((t) => t.msg.includes('Ya estás en esta sala')), true);
  });
});
