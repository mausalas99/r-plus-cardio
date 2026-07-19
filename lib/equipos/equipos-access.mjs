import crypto from 'node:crypto';

/** @param {import('better-sqlite3').Database} db */
export function getEquiposProgramAccess(db) {
  return db
    .prepare(
      `SELECT id, access_token, is_active, rotated_at, rotated_by
       FROM equipos_program_access WHERE id = 1`
    )
    .get();
}

/** @param {import('better-sqlite3').Database} db @param {string} [userId] */
export function rotateEquiposProgramToken(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE equipos_program_access
     SET access_token = ?, rotated_at = ?, rotated_by = ?, is_active = 1
     WHERE id = 1`
  ).run(token, now, userId || null);
  return getEquiposProgramAccess(db);
}

/** @param {import('better-sqlite3').Database} db @param {boolean} active */
export function setEquiposProgramActive(db, active) {
  db.prepare(`UPDATE equipos_program_access SET is_active = ? WHERE id = 1`).run(active ? 1 : 0);
  return getEquiposProgramAccess(db);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} token
 */
export function verifyEquiposToken(db, token) {
  const row = getEquiposProgramAccess(db);
  if (!row || row.is_active !== 1) return false;
  const a = String(token || '').trim();
  const b = String(row.access_token || '').trim();
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** @param {import('better-sqlite3').Database} db */
export function getEquiposHostLease(db) {
  return db.prepare(`SELECT * FROM equipos_host_lease WHERE id = 1`).get();
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ hostUrl: string, holderUserId?: string, holderRank?: string, holderName?: string, rememberedPrimaryUrl?: string }} opts
 */
export function promoteEquiposTemporaryHost(db, opts) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE equipos_host_lease SET
      mode = 'temporary',
      host_url = ?,
      holder_user_id = ?,
      holder_rank = ?,
      holder_name = ?,
      promoted_at = ?,
      remembered_primary_url = ?,
      superseded_at = NULL
     WHERE id = 1`
  ).run(
    opts.hostUrl,
    opts.holderUserId || null,
    opts.holderRank || null,
    opts.holderName || null,
    now,
    opts.rememberedPrimaryUrl || null
  );
  return getEquiposHostLease(db);
}

/** @param {import('better-sqlite3').Database} db */
export function clearEquiposTemporaryHost(db) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE equipos_host_lease SET
      mode = 'primary',
      superseded_at = ?,
      holder_user_id = NULL,
      holder_rank = NULL,
      holder_name = NULL
     WHERE id = 1`
  ).run(now);
  return getEquiposHostLease(db);
}
