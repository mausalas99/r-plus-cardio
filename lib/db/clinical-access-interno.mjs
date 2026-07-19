import crypto from 'node:crypto';
const INTERNO_SALAS = ['Sala 1', 'Sala 2', 'Sala E'];

/** @param {string} sala */
export function normalizeInternoSala(sala) {
  const s = String(sala || '').trim();
  return INTERNO_SALAS.includes(s) ? s : '';
}

/** @param {import('better-sqlite3').Database} db */
export function listSalaInternoAccess(db) {
  return db
    .prepare(
      `SELECT sala, access_token, is_active, rotated_at, rotated_by
       FROM sala_interno_access ORDER BY sala`
    )
    .all();
}

/** @param {import('better-sqlite3').Database} db @param {string} sala */
export function getSalaInternoAccess(db, sala) {
  const key = normalizeInternoSala(sala);
  if (!key) return null;
  return db
    .prepare(
      `SELECT sala, access_token, is_active, rotated_at, rotated_by
       FROM sala_interno_access WHERE sala = ?`
    )
    .get(key);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} sala
 * @param {string} [userId]
 */
export function rotateSalaInternoToken(db, sala, userId) {
  const key = normalizeInternoSala(sala);
  if (!key) throw new Error('Sala inválida.');
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sala_interno_access
     SET access_token = ?, rotated_at = ?, rotated_by = ?, is_active = 1
     WHERE sala = ?`
  ).run(token, now, userId || null, key);
  return getSalaInternoAccess(db, key);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} sala
 * @param {boolean} active
 */
export function setSalaInternoActive(db, sala, active) {
  const key = normalizeInternoSala(sala);
  if (!key) throw new Error('Sala inválida.');
  db.prepare(`UPDATE sala_interno_access SET is_active = ? WHERE sala = ?`).run(
    active ? 1 : 0,
    key
  );
  return getSalaInternoAccess(db, key);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} token
 * @param {string} sala
 */
export function verifySalaInternoToken(db, token, sala) {
  const row = getSalaInternoAccess(db, sala);
  if (!row || row.is_active !== 1) return false;
  const a = String(token || '').trim();
  const b = String(row.access_token || '').trim();
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
