/**
 * Debounced LAN bundle push and untyped safety bundles.
 */
import { isPitchPatientIsolationActive } from '../../tour-pitch-demo-seed.mjs';
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import { isBundlePushPaused } from '../../lan-sync-bundle-push.mjs';
import { buildSafetyBundleEntries } from '../../lan-safety-bundle-builder.mjs';
import { getLanClientId, getLiveSyncPushTimer, setLiveSyncPushTimer, getLiveSyncPushDebounceMs } from './runtime.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import { ensureEffectiveLiveSyncRoomId, BUNDLE_PUSH_HANDLED } from './push-helpers.mjs';
import { pushRoomSyncBundleToHost } from './push-bundle.mjs';

const UNTYPED_SAFETY_BUNDLE_DEBOUNCE_MS = 30000;

/** @type {Map<string, Set<string>>} */
const _dirtyUntypedByDomain = new Map();

/** @type {ReturnType<typeof setTimeout> | null} */
let untypedSafetyBundleTimer = null;

function getDirtyUntypedPatientIds() {
  const ids = new Set();
  for (const set of _dirtyUntypedByDomain.values()) {
    for (const pid of set) ids.add(pid);
  }
  return ids;
}

function clearUntypedDirty() {
  _dirtyUntypedByDomain.clear();
}

/** @param {string} domain @param {string} patientId */
export function markUntypedDirty(domain, patientId) {
  const dom = String(domain || '').trim();
  const pid = String(patientId || '').trim();
  if (!dom || !pid) return;
  let set = _dirtyUntypedByDomain.get(dom);
  if (!set) {
    set = new Set();
    _dirtyUntypedByDomain.set(dom, set);
  }
  set.add(pid);
}

async function buildUntypedSafetyBundleEnvelope(roomId) {
  const dirtyIds = getDirtyUntypedPatientIds();
  if (!dirtyIds.size) return null;
  await ensureLanSyncPushBridgeWired();
  const b = bridge();
  const rid = String(roomId || '').trim();
  const full = await b.buildLiveSyncBundleEnvelope(rid);
  const entries = buildSafetyBundleEntries(full.entries, dirtyIds);
  if (!entries.length) return null;
  return {
    type: 'livesync:bundle',
    roomId: rid,
    clientId: full.clientId || getLanClientId(),
    entries,
    entriesPartial: true,
  };
}

async function pushUntypedSafetyBundleNow() {
  const roomId = ensureEffectiveLiveSyncRoomId();
  if (!roomId || !getDirtyUntypedPatientIds().size) return;
  if (isBundlePushPaused(roomId)) return;
  if (isPitchPatientIsolationActive()) return;
  await ensureLanSyncPushBridgeWired();
  const b = bridge();
  const envelope = await buildUntypedSafetyBundleEnvelope(roomId);
  if (!envelope) return;
  if (!b.isLanSessionConfiguredForRest()) return;
  const pushResult = await pushRoomSyncBundleToHost(roomId, envelope);
  if (pushResult === true || pushResult === BUNDLE_PUSH_HANDLED) {
    clearUntypedDirty();
    b.saveLocalRoomSnapshot(roomId);
    return;
  }
  if (!isBundlePushPaused(roomId)) {
    clearUntypedDirty();
    void enqueueOutbox(roomId, { kind: 'bundle', payload: envelope });
  }
}

/** Debounced partial sync-bundle for untyped domains (entrega, eventualidades, …). */
export function scheduleUntypedSafetyBundle() {
  if (!getDirtyUntypedPatientIds().size) return;
  const roomId = ensureEffectiveLiveSyncRoomId();
  if (!roomId) return;
  if (isBundlePushPaused(roomId)) return;
  if (isPitchPatientIsolationActive()) return;
  if (untypedSafetyBundleTimer) clearTimeout(untypedSafetyBundleTimer);
  untypedSafetyBundleTimer = setTimeout(function () {
    untypedSafetyBundleTimer = null;
    void pushUntypedSafetyBundleNow();
  }, UNTYPED_SAFETY_BUNDLE_DEBOUNCE_MS);
}

/** Debounced room push: HTTP sync-bundle is authoritative; WS carries patches + revision hints (IM-05). */
export function scheduleLiveSyncPush() {
  var roomId = ensureEffectiveLiveSyncRoomId();
  if (!roomId) return;
  if (isBundlePushPaused(roomId)) return;
  if (isPitchPatientIsolationActive()) return;
  var prev = getLiveSyncPushTimer();
  if (prev) clearTimeout(prev);
  setLiveSyncPushTimer(
    setTimeout(function () {
      setLiveSyncPushTimer(null);
      var roomId = ensureEffectiveLiveSyncRoomId();
      if (!roomId) return;
      void (async function () {
        await ensureLanSyncPushBridgeWired();
        var b = bridge();
        var bundle = await b.buildLiveSyncBundleEnvelope(roomId);
        b.saveLocalRoomSnapshot(roomId);
        if (!b.isLanSessionConfiguredForRest()) return;
        var pushResult = await pushRoomSyncBundleToHost(roomId, bundle);
        if (
          pushResult !== true &&
          pushResult !== BUNDLE_PUSH_HANDLED &&
          !isBundlePushPaused(roomId)
        ) {
          void enqueueOutbox(roomId, { kind: 'bundle', payload: bundle });
        }
      })();
    }, getLiveSyncPushDebounceMs())
  );
}
