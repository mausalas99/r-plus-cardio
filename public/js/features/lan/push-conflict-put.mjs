/**
 * LAN clinical-ops PUT request/response helpers (push-conflict).
 */
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import {
  prepareClinicalOpsForLanSync,
  getCachedClinicalOpsSnapshot,
} from '../../clinical-ops-lan.mjs';
import { lanClient, getLanClientId } from './runtime.mjs';
import { bridge } from './push-bridge.mjs';
import { CLINICAL_OPS_HANDLED } from './push-helpers.mjs';
import {
  resolveClinicalOps409,
  applyClinicalOpsPutSuccess,
  ensureClinicalOpsPushRevision,
} from './push-conflict-ops.mjs';

function clinicalOpsPutBody(rid, snap, clientId, bases) {
  return {
    snapshot: snap,
    baseRevision: bases && bases.revision != null ? bases.revision : 0,
    clientId: clientId || getLanClientId(),
  };
}

function clinicalOpsPutFetch(rid, snap, clientId, bases) {
  return lanClient.fetch('/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/clinical-ops', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clinicalOpsPutBody(rid, snap, clientId, bases)),
  });
}

function parseClinicalOpsPutResponse(resp, rid, b, bases) {
  if (!resp) return Promise.resolve(false);
  if (resp.status === 409) {
    return resp.json().catch(function () { return {}; }).then(function (conflictBody) {
      return resolveClinicalOps409(rid, b, conflictBody);
    });
  }
  if (!resp.ok) return Promise.resolve(false);
  return resp.json().then(function (body) {
    return applyClinicalOpsPutSuccess(rid, b, body, bases);
  });
}

function retryClinicalOpsPutAfter409(rid, b, snap, clientId) {
  return prepareClinicalOpsForLanSync().then(function () {
    var fresh = getCachedClinicalOpsSnapshot() || snap;
    return ensureClinicalOpsPushRevision(rid).then(function () {
      var basesRetry = getHostBundleBases(rid);
      return clinicalOpsPutFetch(rid, fresh, clientId, basesRetry).then(function (retryResp) {
        return parseClinicalOpsPutResponse(retryResp, rid, b, basesRetry);
      });
    });
  });
}

function handleClinicalOpsPut409(rid, b, snap, clientId, conflictBody) {
  return resolveClinicalOps409(rid, b, conflictBody).then(function (handled) {
    if (handled !== CLINICAL_OPS_HANDLED) return handled;
    return retryClinicalOpsPutAfter409(rid, b, snap, clientId);
  });
}

/**
 * PUT clinical-ops snapshot; on 409 align with host and retry once.
 * @returns {Promise<boolean|string>}
 */
export function putClinicalOpsSnapshotToHost(roomId, snapshot, clientId) {
  var rid = String(roomId || '').trim();
  var snap = snapshot && typeof snapshot === 'object' ? snapshot : null;
  if (!rid || !snap) return Promise.resolve(false);
  var b = bridge();
  if (typeof b.isLanSessionConfiguredForRest !== 'function' || !b.isLanSessionConfiguredForRest()) {
    return Promise.resolve(false);
  }

  return ensureClinicalOpsPushRevision(rid).then(function () {
    var bases = getHostBundleBases(rid);
    return clinicalOpsPutFetch(rid, snap, clientId, bases)
      .then(function (resp) {
        if (!resp) return false;
        if (resp.status === 409) {
          return resp.json().catch(function () { return {}; }).then(function (conflictBody) {
            return handleClinicalOpsPut409(rid, b, snap, clientId, conflictBody);
          });
        }
        return parseClinicalOpsPutResponse(resp, rid, b, bases);
      })
      .catch(function () {
        return false;
      });
  });
}
