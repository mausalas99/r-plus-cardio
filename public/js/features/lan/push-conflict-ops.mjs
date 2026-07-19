/**
 * LAN clinical-ops conflict resolution helpers (push-conflict).
 */
import { getHostBundleBases, setHostBundleBases } from '../../host-bundle-bases.mjs';
import { notifyLwwOverwrite } from '../../lan-lww-toast.mjs';
import { pauseBundlePushForRoom } from '../../lan-sync-bundle-push.mjs';
import { lanClient } from './runtime.mjs';
import { bridge } from './push-bridge.mjs';
import { CLINICAL_OPS_HANDLED } from './push-helpers.mjs';
import { emitLiveSyncRevisionHint } from './push-revision.mjs';

function lwwToastRuntime(b) {
  return { showToast: typeof b.showToast === 'function' ? b.showToast : undefined };
}

function notifyClinicalOpsLwwOverwrite(b, rid, lwwKeys) {
  if (!lwwKeys.length) return;
  notifyLwwOverwrite(lwwToastRuntime(b), {
    entityType: 'clinicalOps',
    entityId: rid,
    overwrittenKeys: lwwKeys,
  });
}

/** @returns {Promise<string>} */
export function resolveClinicalOps409(rid, b, body) {
  var opsBody = body && typeof body === 'object' ? body : {};
  if (opsBody.revision != null) {
    var prevBases = getHostBundleBases(rid) || {};
    setHostBundleBases(rid, {
      revision: opsBody.revision,
      entityVersions: prevBases.entityVersions || {},
    });
    emitLiveSyncRevisionHint(rid, opsBody.revision);
  }
  var acceptP = Promise.resolve();
  if (typeof b.acceptServerClinicalOpsConflict === 'function') {
    acceptP = Promise.resolve(
      b.acceptServerClinicalOpsConflict(rid, opsBody.snapshot, opsBody.revision)
    );
  }
  var lwwKeys = Array.isArray(opsBody.lwwAppliedKeys) ? opsBody.lwwAppliedKeys : [];
  notifyClinicalOpsLwwOverwrite(b, rid, lwwKeys);
  pauseBundlePushForRoom(rid, 45000);
  if (typeof b.syncLiveSyncStatusChrome === 'function') {
    b.syncLiveSyncStatusChrome();
  }
  return acceptP.then(function () {
    return CLINICAL_OPS_HANDLED;
  });
}

export function applyClinicalOpsPutSuccess(rid, b, body, prevBases) {
  if (body && body.revision != null) {
    var prev = prevBases || getHostBundleBases(rid) || {};
    setHostBundleBases(rid, {
      revision: body.revision,
      entityVersions: prev.entityVersions || {},
    });
    emitLiveSyncRevisionHint(rid, body.revision);
  }
  var lwwKeys = Array.isArray(body && body.lwwAppliedKeys) ? body.lwwAppliedKeys : [];
  notifyClinicalOpsLwwOverwrite(b, rid, lwwKeys);
  return true;
}

/** Align local baseRevision with host before PUT (avoids stale-revision 409). */
export function ensureClinicalOpsPushRevision(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return Promise.resolve();
  var b = bridge();
  if (typeof b.isLanSessionConfiguredForRest !== 'function' || !b.isLanSessionConfiguredForRest()) {
    return Promise.resolve();
  }
  var bases = getHostBundleBases(rid) || {};
  var localRev = Number(bases.revision || 0);
  return lanClient
    .fetch('/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/clinical-ops')
    .then(function (resp) {
      if (!resp || !resp.ok) return;
      return resp.json().then(function (body) {
        var serverRev = Number(body && body.revision != null ? body.revision : 0);
        if (localRev === serverRev) return;
        if (typeof b.acceptServerClinicalOpsConflict === 'function') {
          return b.acceptServerClinicalOpsConflict(rid, body.snapshot, serverRev);
        }
        setHostBundleBases(rid, {
          revision: serverRev,
          entityVersions: bases.entityVersions || {},
        });
      });
    })
    .catch(function () {});
}
