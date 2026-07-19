/** Per-room LAN live-sync phase (IM-04). */

export const RoomSyncPhase = Object.freeze({
  offline: 'offline',
  configured: 'configured',
  joining: 'joining',
  catching_up: 'catching_up',
  live: 'live',
  degraded: 'degraded',
});

const VALID_PHASES = new Set(Object.values(RoomSyncPhase));

/** @type {Map<string, { phase: string, meta: unknown }>} */
const phaseByRoom = new Map();

/** @type {Set<(detail: { roomId: string, phase: string, meta: unknown }) => void>} */
const listeners = new Set();

function notify(roomId, phase, meta) {
  const detail = { roomId, phase, meta: meta ?? null };
  listeners.forEach(function (cb) {
    try {
      cb(detail);
    } catch (_e) { void _e; }
  });
}

/**
 * @param {string} [roomId]
 * @returns {string}
 */
export function getRoomSyncPhase(roomId) {
  const id = roomId != null ? String(roomId).trim() : '';
  if (!id) return RoomSyncPhase.offline;
  const entry = phaseByRoom.get(id);
  return entry ? entry.phase : RoomSyncPhase.offline;
}

/**
 * @param {string} roomId
 * @param {string} phase
 * @param {unknown} [meta]
 */
export function setRoomSyncPhase(roomId, phase, meta) {
  const id = String(roomId || '').trim();
  const p = String(phase || '').trim();
  if (!id || !VALID_PHASES.has(p)) return;
  const prev = phaseByRoom.get(id);
  const nextMeta = meta ?? null;
  if (prev && prev.phase === p && prev.meta === nextMeta) return;
  phaseByRoom.set(id, { phase: p, meta: nextMeta });
  notify(id, p, nextMeta);
}

/**
 * @param {string} roomId
 */
export function clearRoomSyncPhase(roomId) {
  const id = String(roomId || '').trim();
  if (!id || !phaseByRoom.has(id)) return;
  phaseByRoom.delete(id);
  notify(id, RoomSyncPhase.offline, null);
}

/**
 * @param {(detail: { roomId: string, phase: string, meta: unknown }) => void} cb
 * @returns {() => void}
 */
export function subscribeRoomSyncPhase(cb) {
  if (typeof cb !== 'function') return function () {};
  listeners.add(cb);
  return function unsubscribe() {
    listeners.delete(cb);
  };
}
