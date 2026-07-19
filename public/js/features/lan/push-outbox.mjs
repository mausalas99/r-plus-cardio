/**
 * LAN live-sync outbox drain and periodic flush.
 */
import { drainOutbox } from '../../live-sync-outbox.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import {
  getLiveSyncOutboxFlushTimer,
  setLiveSyncOutboxFlushTimer,
  LIVE_SYNC_OUTBOX_FLUSH_MS,
} from './runtime.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import {
  sortOutboxItems,
  drainOutboxFromIndex,
} from './push-outbox-drain.mjs';

export function flushLiveSyncOutbox(roomId) {
  return ensureLanSyncPushBridgeWired().then(function () {
    return flushLiveSyncOutboxBody(roomId);
  });
}

function flushLiveSyncOutboxBody(roomId) {
  var b = bridge();
  var rid = String(roomId || '').trim();
  if (!rid || typeof b.isLanSessionConfiguredForRest !== 'function' || !b.isLanSessionConfiguredForRest()) {
    return Promise.resolve();
  }
  return drainOutbox(rid).then(function (items) {
    if (!items || !items.length) return;
    return drainOutboxFromIndex(rid, sortOutboxItems(items), 0);
  });
}

export function scheduleLiveSyncOutboxFlush() {
  if (getLiveSyncOutboxFlushTimer()) return;
  setLiveSyncOutboxFlushTimer(
    setInterval(function () {
      var m = getRoomMembership();
      if (!m || !m.roomId) return;
      flushLiveSyncOutbox(m.roomId);
    }, LIVE_SYNC_OUTBOX_FLUSH_MS)
  );
}

export function stopLiveSyncOutboxFlush() {
  var timer = getLiveSyncOutboxFlushTimer();
  if (timer) clearInterval(timer);
  setLiveSyncOutboxFlushTimer(null);
}
