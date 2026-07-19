'use strict';

const HEARTBEAT_INTERVAL_MS = 30_000;
let _heartbeatTimer = null;

function resolvePurgeClientIdentity(req, clientIdentityStore) {
  const headerToken = String(req.get('x-client-token') || '').trim();
  const boundClientId =
    headerToken && clientIdentityStore && typeof clientIdentityStore.resolve === 'function'
      ? clientIdentityStore.resolve(headerToken)
      : '';
  const queryClientId = String(req.query.clientId || '').trim();
  if (boundClientId && queryClientId && boundClientId !== queryClientId) {
    console.warn('[lan] purge identity mismatch', { boundClientId, queryClientId });
  }
  if (!boundClientId) {
    console.warn('[lan] purge using legacy client-asserted identity', { queryClientId });
  }
  return {
    clientId: boundClientId || queryClientId,
    isProgramAdmin: req.query.isProgramAdmin === '1',
  };
}

function startHeartbeat(broadcastFn, getMetaFn, getExtrasFn) {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    try {
      const meta = typeof getMetaFn === 'function' ? getMetaFn() : {};
      const extras = typeof getExtrasFn === 'function' ? getExtrasFn() : {};
      if (typeof broadcastFn === 'function') {
        broadcastFn('sync', {
          type: 'livesync:hello',
          clientId: String(extras.clientId || ''),
          startedAt: Number(meta.startedAt) || 0,
          revision: Number(extras.revision) || 0,
          rank: String(meta.rank || 'R1'),
          dbUnlocked: !!extras.dbUnlocked,
          shiftPinActive: !!extras.shiftPinActive,
        });
      }
    } catch (e) {
      console.error('[lan-heartbeat]', e && e.message ? e.message : e);
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof _heartbeatTimer.unref === 'function') _heartbeatTimer.unref();
}

function createBroadcastHelpers({ broadcast, sseBroadcast }) {
  function broadcastAll(channel, obj) {
    if (typeof broadcast === 'function') broadcast(channel, obj);
    if (typeof sseBroadcast === 'function') sseBroadcast(channel, obj);
  }

  function broadcastLiveRevision(roomId, revision, clientId) {
    const rid = String(roomId || '').trim();
    if (!rid) return;
    broadcastAll(`live:${encodeURIComponent(rid)}`, {
      type: 'livesync:revision',
      roomId: rid,
      revision: Number(revision || 0),
      clientId: String(clientId || 'host'),
    });
  }

  return { broadcastAll, broadcastLiveRevision };
}

module.exports = {
  HEARTBEAT_INTERVAL_MS,
  resolvePurgeClientIdentity,
  startHeartbeat,
  createBroadcastHelpers,
};
