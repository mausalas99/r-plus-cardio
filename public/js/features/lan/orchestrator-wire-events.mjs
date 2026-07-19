/** LAN mutation registry and client event wiring (orchestrator-wire). */
import { storage } from '../../storage.js';
import { lanClient, activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import { lanMutationRegistry } from '../../lan-mutation-registry.mjs';
import { upsertHost } from '../../lan-host-registry.mjs';
import { RoomSyncPhase, getRoomSyncPhase } from '../../lan-sync-state.mjs';
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import {
  pushClinicalOpsLanNow,
  markUntypedDirty,
  scheduleUntypedSafetyBundle,
} from './push.mjs';
import { isLanSessionConfiguredForRest } from './transport.mjs';
import {
  getActiveLiveSyncRoomId,
  resumeAutoHostDetectAndReconnect,
  syncLiveSyncStatusChrome,
} from './room.mjs';
import {
  handleSyncConflict,
  wsConflictDetailToPayload,
} from './conflicts.mjs';
import { applyLiveSyncApplied } from './orchestrator-bundle-apply.mjs';
import { wireInternoHostSyncBridge, handleInternoHostSyncBroadcast } from './orchestrator-interno.mjs';

function registerPatientMutationPut(domain, pathSuffix, outboxKind, errorLabel) {
  lanMutationRegistry.registerMutationHandler(domain, async (pid, payload) => {
    const rid = getActiveLiveSyncRoomId();
    if (!rid) return;
    const res = await lanClient.fetch(
      '/api/lan/v1/patients/' + encodeURIComponent(pid) + pathSuffix,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: payload,
          expectedVersion: 0,
          clientId: getLanClientId(),
          clientTimestamp: Date.now(),
        }),
      }
    );
    if (!res || !res.ok) throw new Error(errorLabel);
  });
  lanMutationRegistry.setDomainOutboxKind(domain, outboxKind);
}

export function wireLanMutationRegistryHandlers() {
  registerPatientMutationPut('nota', '/nota', 'nota_replace', 'nota push failed');
  registerPatientMutationPut(
    'indicaciones',
    '/indicaciones',
    'indicaciones_replace',
    'indicaciones push failed'
  );

  lanMutationRegistry.registerMutationHandler('lab-history', async (pid, payload) => {
    const rid = getActiveLiveSyncRoomId();
    if (!rid) return;
    const res = await lanClient.fetch(
      '/api/lan/v1/patients/' + encodeURIComponent(pid) + '/lab-history/upsert-set',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set: payload,
          clientId: getLanClientId(),
          clientTimestamp: Number(payload && payload._clientTimestamp ? payload._clientTimestamp : Date.now()),
        }),
      }
    );
    if (!res || !res.ok) throw new Error('lab-history push failed');
  });
  lanMutationRegistry.setDomainOutboxKind('lab-history', 'lab_history_upsert');

  lanMutationRegistry.registerMutationHandler('lab-history-delete', async (pid, payload) => {
    const rid = getActiveLiveSyncRoomId();
    if (!rid) return;
    const res = await lanClient.fetch(
      '/api/lan/v1/patients/' + encodeURIComponent(pid) + '/lab-history/delete-set',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: payload && payload.setId,
          clientId: getLanClientId(),
          clientTimestamp: Number(payload && payload.clientTimestamp ? payload.clientTimestamp : Date.now()),
        }),
      }
    );
    if (!res || !res.ok) throw new Error('lab-history delete failed');
  });
  lanMutationRegistry.setDomainOutboxKind('lab-history-delete', 'lab_history_delete');

  lanMutationRegistry.registerMutationHandler('entrega', async () => {
    await pushClinicalOpsLanNow();
  });

  lanMutationRegistry.configure({
    isActive: () => !!getActiveLiveSyncRoomId() && isLanSessionConfiguredForRest(),
    getActiveRoomId: getActiveLiveSyncRoomId,
    enqueueOutbox: (roomId, item) => enqueueOutbox(roomId, item),
    markUntypedDirty,
    scheduleUntypedSafetyBundle,
  });
}

function handleLanPatchHello(data) {
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const hostUrl = String(lanClient.baseUrl() || cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (hostUrl && data.clientId && data.startedAt) {
    upsertHost({
      fingerprint: `${data.clientId}:${data.startedAt}`,
      clientId: data.clientId,
      startedAt: data.startedAt,
      currentUrl: hostUrl,
      rank: data.rank || '',
      dbUnlocked: !!data.dbUnlocked,
      shiftPinActive: !!data.shiftPinActive,
      rttMs: 0,
      lastSeenAt: Date.now(),
      source: 'heartbeat',
    });
  }
  const roomId = String(activeLiveSyncRoomId || '').trim();
  if (roomId && getRoomSyncPhase(roomId) === RoomSyncPhase.offline) {
    resumeAutoHostDetectAndReconnect();
  }
}

function handleLanPatchEvent(data) {
  if (data?.type === 'patients-updated' || data?.type === 'guardias-updated') {
    void handleInternoHostSyncBroadcast(data);
    return;
  }
  if (data?.type === 'livesync:hello') {
    handleLanPatchHello(data);
    return;
  }
  syncLiveSyncStatusChrome();
}

export function wireLanClientEventListeners() {
  lanClient.addEventListener('lan-applied', function (ev) {
    applyLiveSyncApplied(ev.detail);
  });
  lanClient.addEventListener('lan-conflict', function (ev) {
    if (!ev.detail) return;
    var payload = wsConflictDetailToPayload(ev.detail);
    if (!payload.lwwApplied && payload.serverSnapshot && payload.serverSnapshot.data) {
      payload.lwwApplied = true;
    }
    void handleSyncConflict(payload);
  });
  wireInternoHostSyncBridge();
  lanClient.addEventListener('lan-patch', function (ev) {
    handleLanPatchEvent(ev.detail);
  });
}
