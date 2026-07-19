'use strict';

function createSyncScheduler({ hostStore, windowMs = 50 }) {
  if (!hostStore || typeof hostStore.materializeRoomViews !== 'function') {
    throw new Error('hostStore.materializeRoomViews required');
  }
  const timers = new Map();
  const reasons = new Map();

  function clear(roomId) {
    const timer = timers.get(roomId);
    if (timer) clearTimeout(timer);
    timers.delete(roomId);
  }

  function scheduleMaterialize(roomId, { reason = 'command' } = {}) {
    const rid = String(roomId || '').trim();
    if (!rid) return { ok: false, error: 'roomId_required' };
    reasons.set(rid, reason);
    if (timers.has(rid)) return { ok: true, scheduled: true };
    timers.set(rid, setTimeout(() => {
      void flush(rid, { reason: reasons.get(rid) || 'scheduled' });
    }, Number(windowMs) || 50));
    return { ok: true, scheduled: true };
  }

  async function flush(roomId, { reason = 'flush', clientId = 'host' } = {}) {
    const rid = String(roomId || '').trim();
    if (!rid) return { ok: false, error: 'roomId_required' };
    clear(rid);
    reasons.delete(rid);
    await hostStore.materializeRoomViews(rid, { deferPersist: false });
    const bundle = typeof hostStore.getRoomSyncBundle === 'function'
      ? hostStore.getRoomSyncBundle(rid)
      : null;
    const out = {
      ok: true,
      roomId: rid,
      revision: Number(bundle && bundle.revision || 0),
      latestDeltaSeq: Number(bundle && bundle.deltaSeq || 0),
      reason,
    };
    if (typeof hostStore.appendRoomBundleAudit === 'function') {
      hostStore.appendRoomBundleAudit(rid, {
        at: new Date().toISOString(),
        clientId: String(clientId || 'host'),
        action: 'sync.flush',
        detail: { reason, revision: out.revision, latestDeltaSeq: out.latestDeltaSeq },
      });
    }
    return out;
  }

  async function flushAll({ reason = 'flush-all' } = {}) {
    const rooms = [...timers.keys()];
    const out = [];
    for (const roomId of rooms) out.push(await flush(roomId, { reason }));
    return out;
  }

  function pendingRooms() {
    return [...timers.keys()];
  }

  return { scheduleMaterialize, flush, flushAll, pendingRooms };
}

module.exports = { createSyncScheduler };
