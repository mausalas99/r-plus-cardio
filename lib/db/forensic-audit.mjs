import crypto from 'node:crypto';
import { canonicalStringify } from './canonical-json.mjs';

export const GENESIS_PREVIOUS_HASH = '0'.repeat(64);

export function hashPayload(meta) {
  return crypto.createHash('sha256').update(canonicalStringify(meta || {}), 'utf8').digest('hex');
}

export function computeBlockHash(row) {
  const s = [
    String(row.id),
    row.timestamp,
    row.client_id,
    row.event_type,
    row.payload_hash,
    row.previous_hash,
  ].join('|');
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function verifyChainRows(rows) {
  let prev = GENESIS_PREVIOUS_HASH;
  for (const r of rows) {
    if (r.previous_hash !== prev) return r.id;
    const expect = computeBlockHash(r);
    if (expect !== r.current_hash) return r.id;
    prev = r.current_hash;
  }
  return null;
}

/** @param {import('better-sqlite3').Database} db */
export function appendAuditInTransaction(db, { clientId, eventType, meta }) {
  const payload_hash = hashPayload(meta);
  const prevRow = db.prepare(
    'SELECT current_hash FROM forensic_audit_chain ORDER BY id DESC LIMIT 1'
  ).get();
  const previous_hash = prevRow ? prevRow.current_hash : GENESIS_PREVIOUS_HASH;
  const timestamp = new Date().toISOString();
  const id = db.prepare(
    `INSERT INTO forensic_audit_chain
     (timestamp, client_id, event_type, payload_hash, previous_hash, current_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    timestamp,
    clientId,
    eventType,
    payload_hash,
    previous_hash,
    'pending'
  ).lastInsertRowid;
  const current_hash = computeBlockHash({
    id,
    timestamp,
    client_id: clientId,
    event_type: eventType,
    payload_hash,
    previous_hash,
  });
  db.prepare(
    'UPDATE forensic_audit_chain SET current_hash = ? WHERE id = ?'
  ).run(current_hash, id);
  return { id, current_hash };
}
