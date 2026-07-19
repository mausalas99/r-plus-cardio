/** SQL helpers for LAN sync outbox (schema v9). */

export const LAN_OUTBOX_MAX_PER_ROOM = 50;

const VALID_KINDS = new Set([
  'bundle', 'patch', 'clinical_ops', 'delta', 'command',
  'lab_history_upsert', 'nota_replace', 'indicaciones_replace', 'patient_fields',
]);

function trimRoomId(roomId) {
  return String(roomId || '').trim();
}

function normalizeKind(kind) {
  const k = String(kind || 'bundle');
  return VALID_KINDS.has(k) ? k : 'bundle';
}

function parsePayloadJson(json) {
  if (json == null || json === '') return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ roomId: string, kind?: string, payload: unknown }} opts
 */
export function enqueueLanSyncOutbox(db, { roomId, kind, payload }) {
  const rid = trimRoomId(roomId);
  if (!rid || payload == null) return { id: null };
  const enqueuedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO lan_sync_outbox (room_id, kind, payload_json, enqueued_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(rid, normalizeKind(kind), JSON.stringify(payload), enqueuedAt);

  const count = db
    .prepare('SELECT COUNT(*) AS c FROM lan_sync_outbox WHERE room_id = ?')
    .get(rid).c;
  if (count > LAN_OUTBOX_MAX_PER_ROOM) {
    const excess = count - LAN_OUTBOX_MAX_PER_ROOM;
    db.prepare(
      `DELETE FROM lan_sync_outbox
       WHERE id IN (
         SELECT id FROM lan_sync_outbox
         WHERE room_id = ?
         ORDER BY enqueued_at ASC, id ASC
         LIMIT ?
       )`
    ).run(rid, excess);
  }
  return { id: Number(result.lastInsertRowid) };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ roomId: string }} opts
 * @returns {Array<{ id?: number, kind: string, payload: unknown, enqueuedAt: string, attempts?: number, lastError?: string|null }>}
 */
export function drainLanSyncOutbox(db, { roomId }) {
  const rid = trimRoomId(roomId);
  if (!rid) return [];
  const rows = db
    .prepare(
      `SELECT id, kind, payload_json, enqueued_at, attempts, last_error
       FROM lan_sync_outbox
       WHERE room_id = ?
       ORDER BY enqueued_at ASC, id ASC`
    )
    .all(rid);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  db.prepare(
    `DELETE FROM lan_sync_outbox WHERE id IN (${ids.map(() => '?').join(',')})`
  ).run(...ids);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: parsePayloadJson(row.payload_json),
    enqueuedAt: row.enqueued_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ roomId: string }} opts
 */
export function countLanSyncOutbox(db, { roomId }) {
  const rid = trimRoomId(roomId);
  if (!rid) return 0;
  return db
    .prepare('SELECT COUNT(*) AS c FROM lan_sync_outbox WHERE room_id = ?')
    .get(rid).c;
}
