/**
 * LAN bundle and clinical-ops 409 conflict resolution.
 */
import { setHostBundleBases } from '../../host-bundle-bases.mjs';
import { notifyLwwOverwrite } from '../../lan-lww-toast.mjs';
import { pauseBundlePushForRoom } from '../../lan-sync-bundle-push.mjs';
import { getLanClientId } from './runtime.mjs';
import { BUNDLE_PUSH_HANDLED } from './push-helpers.mjs';
import {
  emitLiveSyncRevisionHint,
  scheduleReconcileFromRevisionHint,
} from './push-revision.mjs';
import { putClinicalOpsSnapshotToHost } from './push-conflict-put.mjs';

function lwwToastRuntime(b) {
  return { showToast: typeof b.showToast === 'function' ? b.showToast : undefined };
}

function notifyBundleLwwOverwrite(b, roomId, lwwAppliedKeys) {
  var keys = Array.isArray(lwwAppliedKeys) ? lwwAppliedKeys : [];
  if (!keys.length) return;
  notifyLwwOverwrite(lwwToastRuntime(b), {
    entityType: 'bundle',
    entityId: roomId,
    overwrittenKeys: keys,
  });
}

function applyServerBundleLwwLocally(rid, b, serverBundle, lwwAppliedKeys) {
  if (!serverBundle) return false;
  setHostBundleBases(rid, serverBundle);
  emitLiveSyncRevisionHint(rid, serverBundle.revision);
  if (typeof b.acceptServerBundleConflict === 'function') {
    b.acceptServerBundleConflict({
      roomId: rid,
      serverBundle: serverBundle,
      conflicts: [],
    });
  }
  notifyBundleLwwOverwrite(b, rid, lwwAppliedKeys);
  return true;
}

function finishBundle409Locally(rid, b, _opts) {
  _opts = _opts || {};
  pauseBundlePushForRoom(rid, 45000);
  scheduleReconcileFromRevisionHint(rid);
  if (typeof b.applyRoomSyncPhaseAfterReconcile === 'function') {
    b.applyRoomSyncPhaseAfterReconcile(rid);
  }
  if (typeof b.syncLiveSyncStatusChrome === 'function') {
    b.syncLiveSyncStatusChrome();
  }
  return BUNDLE_PUSH_HANDLED;
}

/**
 * @param {string} roomId
 * @param {{ snapshot: object, baseRevision?: number, clientId?: string }} payload
 */
function pushClinicalOpsPayloadToHost(roomId, payload) {
  var rid = String(roomId || '').trim();
  var snap = payload && payload.snapshot;
  if (!rid || !snap) return Promise.resolve(false);
  return putClinicalOpsSnapshotToHost(rid, snap, payload.clientId || getLanClientId());
}

export {
  applyServerBundleLwwLocally,
  finishBundle409Locally,
  notifyBundleLwwOverwrite,
  putClinicalOpsSnapshotToHost,
  pushClinicalOpsPayloadToHost,
};
