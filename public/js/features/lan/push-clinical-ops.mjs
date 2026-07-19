/**
 * LAN clinical-ops snapshot push (immediate, no debounce).
 */
import { isPitchPatientIsolationActive } from '../../tour-pitch-demo-seed.mjs';
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import {
  prepareClinicalOpsForLanSync,
  getCachedClinicalOpsSnapshot,
  isClinicalOpsLanAvailable,
} from '../../clinical-ops-lan.mjs';
import { recordClinicalOpsTrace } from '../../lan-sync-diagnostics.mjs';
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import { lanClient, getLanClientId } from './runtime.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import { ensureEffectiveLiveSyncRoomId, lanPushResult, sendLiveBundleIfOpen, CLINICAL_OPS_HANDLED } from './push-helpers.mjs';
import { putClinicalOpsSnapshotToHost } from './push-conflict.mjs';

var clinicalOpsLanPushInFlight = null;

export async function pushClinicalOpsLanNow(opts) {
  if (clinicalOpsLanPushInFlight) return clinicalOpsLanPushInFlight;
  clinicalOpsLanPushInFlight = pushClinicalOpsLanNowBody(opts).finally(function () {
    clinicalOpsLanPushInFlight = null;
  });
  return clinicalOpsLanPushInFlight;
}

function clinicalOpsUsersCount(snap) {
  return Array.isArray(snap?.clinical_users) ? snap.clinical_users.length : 0;
}

function traceClinicalOpsPush(code, roomId, snap, extra) {
  recordClinicalOpsTrace('push', Object.assign({
    roomId: roomId,
    code: code,
    usersExported: clinicalOpsUsersCount(snap),
  }, extra || {}));
}

async function validateClinicalOpsPushContext() {
  if (isPitchPatientIsolationActive()) return { ok: false, code: 'PITCH_DEMO' };
  if (!isClinicalOpsLanAvailable()) {
    recordClinicalOpsTrace('push', { code: 'NO_CLINICAL_OPS', usersExported: 0 });
    return { ok: false, code: 'NO_CLINICAL_OPS' };
  }
  await prepareClinicalOpsForLanSync();
  var snap = getCachedClinicalOpsSnapshot();
  if (!snap) {
    recordClinicalOpsTrace('push', { code: 'NO_SNAPSHOT', usersExported: 0 });
    return { ok: false, code: 'NO_SNAPSHOT' };
  }
  var roomId = ensureEffectiveLiveSyncRoomId();
  if (!roomId) {
    traceClinicalOpsPush('NO_ROOM', '', snap);
    return { ok: false, code: 'NO_ROOM' };
  }
  var b = bridge();
  if (!b.isLanSessionConfiguredForRest()) {
    traceClinicalOpsPush('NO_LAN', roomId, snap);
    return { ok: false, code: 'NO_LAN' };
  }
  return { ok: true, snap: snap, roomId: roomId, bridge: b };
}

async function pushClinicalOpsLanNowBody(_opts) {
  await ensureLanSyncPushBridgeWired();
  var ctx = await validateClinicalOpsPushContext();
  if (!ctx.ok) return lanPushResult(false, ctx.code);

  var snap = ctx.snap;
  var roomId = ctx.roomId;
  var b = ctx.bridge;

  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
  } catch (_e) { void _e; }

  var envelope = await b.buildLiveSyncBundleEnvelope(roomId);
  envelope.clinicalOps = snap;

  var bases = getHostBundleBases(roomId);
  var putResult = false;
  try {
    putResult = await putClinicalOpsSnapshotToHost(roomId, snap, getLanClientId());
  } catch {
    putResult = false;
  }
  var okHttp = putResult === true;
  var conflictHandled = putResult === CLINICAL_OPS_HANDLED;
  var pushedLive = sendLiveBundleIfOpen(roomId, envelope);
  b.saveLocalRoomSnapshot(roomId);
  if (typeof b.syncLiveSyncStatusChrome === 'function') b.syncLiveSyncStatusChrome();

  traceClinicalOpsPush(
    okHttp || pushedLive ? 'ok' : conflictHandled ? 'CONFLICT_RESOLVED' : 'QUEUED',
    roomId,
    snap,
    { http: !!okHttp, live: pushedLive }
  );

  if (okHttp || pushedLive) {
    return lanPushResult(true, undefined, { http: !!okHttp, live: pushedLive });
  }
  if (conflictHandled) {
    return lanPushResult(true, 'CONFLICT_RESOLVED', { http: true });
  }
  await enqueueOutbox(roomId, {
    kind: 'clinical_ops',
    payload: {
      snapshot: snap,
      baseRevision: bases && bases.revision != null ? bases.revision : 0,
      clientId: getLanClientId(),
    },
  });
  return lanPushResult(true, 'QUEUED', { outbox: true });
}
