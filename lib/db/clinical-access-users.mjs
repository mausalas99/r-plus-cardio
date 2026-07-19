import crypto from 'node:crypto';
import { verifyAdminAccessCode } from '../admin-access-code.mjs';
import {
  isValidUsernameFormat,
  normalizeUsername,
} from './clinical-username.mjs';
/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ clientId: string, rank?: string, clinicalName?: string, sala?: string }} opts
 */
export function ensureClinicalUser(db, { clientId, rank = 'R1', clinicalName, sala }) {
  const username = String(clientId || 'local-device').slice(0, 64);
  const allowed = new Set(['R1', 'R2', 'R3', 'R4', 'Admin']);
  const safeRank = allowed.has(rank) ? rank : 'R1';

  const existing = db
    .prepare(
      'SELECT user_id, username, rank, public_key, encrypted_private_key FROM users WHERE username = ?'
    )
    .get(username);

  if (existing) {
    const row = db
      .prepare(
        'SELECT user_id, username, rank, public_key, encrypted_private_key, is_program_admin FROM users WHERE user_id = ?'
      )
      .get(existing.user_id);
    // Update clinical_name and sala if provided
    if (clinicalName != null || sala != null) {
      const sets = [];
      const vals = [];
      if (clinicalName != null) { sets.push('clinical_name = ?'); vals.push(clinicalName); }
      if (sala != null) { sets.push('sala = ?'); vals.push(sala); }
      vals.push(existing.user_id);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`).run(...vals);
    }
    return {
      userId: row.user_id,
      username: row.username,
      rank: row.rank,
      isProgramAdmin: row.is_program_admin === 1,
      publicKeyPem: row.public_key,
      privateKeyPem: row.encrypted_private_key,
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, username, 'local-device', safeRank, publicKey, privateKey,
    clinicalName || null,
    sala || null
  );

  return {
    userId,
    username,
    rank: safeRank,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}

/** @param {object} row */
function mapClinicalUserRow(row) {
  return {
    userId: row.user_id,
    username: row.username,
    rank: row.rank,
    isProgramAdmin: row.is_program_admin === 1,
    publicKeyPem: row.public_key,
    privateKeyPem: row.encrypted_private_key,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} username
 */
export function findClinicalUserByUsername(db, username) {
  const handle = normalizeUsername(username);
  if (!isValidUsernameFormat(handle)) return null;
  const row = db
    .prepare(
      `SELECT user_id, username, rank, public_key, encrypted_private_key, is_program_admin
       FROM users WHERE username = ?`
    )
    .get(handle);
  return row ? mapClinicalUserRow(row) : null;
}

/**
 * Prefer a previously bound clinical identity (user id / LAN handle) over a fresh device row.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   clientId: string,
 *   rank?: string,
 *   clinicalName?: string,
 *   sala?: string,
 *   preferredUserId?: string,
 *   preferredUsername?: string,
 * }} opts
 */
export function resolveBootstrapClinicalUser(db, opts) {
  const preferredUsername = opts.preferredUsername
    ? normalizeUsername(String(opts.preferredUsername))
    : '';
  if (preferredUsername && isValidUsernameFormat(preferredUsername)) {
    const byHandle = findClinicalUserByUsername(db, preferredUsername);
    if (byHandle) return byHandle;
  }

  const preferredUserId = String(opts.preferredUserId || '').trim();
  if (preferredUserId) {
    const row = db
      .prepare(
        `SELECT user_id, username, rank, public_key, encrypted_private_key, is_program_admin
         FROM users WHERE user_id = ?`
      )
      .get(preferredUserId);
    if (row) {
      const mapped = mapClinicalUserRow(row);
      if (
        !preferredUsername ||
        normalizeUsername(mapped.username) === preferredUsername
      ) {
        return mapped;
      }
    }
  }

  return ensureClinicalUser(db, {
    clientId: opts.clientId,
    rank: opts.rank,
    clinicalName: opts.clinicalName,
    sala: opts.sala,
  });
}

/**
 * Attach session to an existing LAN username (no device-row fallback).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} username
 */
export function attachClinicalIdentityByUsername(db, username) {
  const handle = normalizeUsername(username);
  if (!isValidUsernameFormat(handle)) {
    throw new Error('Usuario inválido.');
  }
  const user = findClinicalUserByUsername(db, handle);
  if (!user) {
    throw new Error('No encontramos ese usuario en esta base de datos.');
  }
  return user;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} [userId]
 */
/**
 * @param {import('better-sqlite3').Database} db
 */
export function listClinicalUsers(db) {
  return db
    .prepare(
      `SELECT user_id, username, rank, clinical_name, sala, last_activity_at FROM users ORDER BY username`
    )
    .all();
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @param {string} [atIso]
 */
export function touchClinicalUserActivity(db, userId, atIso) {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  const iso = String(atIso || new Date().toISOString()).trim();
  const result = db
    .prepare(
      `UPDATE users SET last_activity_at = CASE
         WHEN last_activity_at IS NULL OR last_activity_at < ? THEN ?
         ELSE last_activity_at
       END
       WHERE user_id = ?`
    )
    .run(iso, iso, uid);
  return result.changes > 0;
}

export function getClinicalProfile(db, userId) {
  return db.prepare(
    'SELECT user_id, username, rank, clinical_name, sala, is_program_admin FROM users WHERE user_id = ?'
  ).get(userId) || null;
}

export function claimUsername(db, { userId, username }) {
  const uid = String(userId || '');
  const handle = normalizeUsername(username);
  if (!uid) throw new Error('Usuario no válido.');
  if (!isValidUsernameFormat(handle)) {
    throw new Error('Usuario inválido. Usa 3–32 caracteres: a-z, 0-9, _.');
  }
  const taken = db
    .prepare('SELECT user_id FROM users WHERE username = ? AND user_id != ?')
    .get(handle, uid);
  if (taken) throw new Error('Ese usuario ya está en uso.');
  db.prepare('UPDATE users SET username = ? WHERE user_id = ?').run(handle, uid);
  touchClinicalUserActivity(db, uid);
  return getClinicalProfile(db, uid);
}

function parseProgramAdminFlag(isProgramAdmin) {
  if (isProgramAdmin === undefined || isProgramAdmin === null) return null;
  return isProgramAdmin === true || isProgramAdmin === 1 || isProgramAdmin === '1' ? 1 : 0;
}

function assertAdminPromotionAllowed(db, userId, adminFlag, adminAccessCode) {
  if (adminFlag !== 1) return;
  const currentAdmin = db
    .prepare('SELECT is_program_admin FROM users WHERE user_id = ?')
    .get(userId);
  if (currentAdmin?.is_program_admin === 1) return;
  if (!verifyAdminAccessCode(adminAccessCode)) {
    throw new Error('Código de administración incorrecto.');
  }
}

function updateExistingClinicalProfile(db, userId, fields) {
  const { clinicalName, rank, sala, adminFlag } = fields;
  if (adminFlag !== null) {
    db.prepare(`
      UPDATE users SET clinical_name = @clinicalName, rank = @rank, sala = @sala,
        is_program_admin = @isProgramAdmin
      WHERE user_id = @userId
    `).run({
      userId,
      clinicalName: clinicalName || null,
      rank,
      sala: sala || null,
      isProgramAdmin: adminFlag,
    });
    return;
  }
  db.prepare(`
    UPDATE users SET clinical_name = @clinicalName, rank = @rank, sala = @sala
    WHERE user_id = @userId
  `).run({ userId, clinicalName: clinicalName || null, rank, sala: sala || null });
}

function insertClinicalProfile(db, userId, fields) {
  const { rank, clinicalName, sala } = fields;
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala)
    VALUES (@userId, @username, '', @rank, '', '', @clinicalName, @sala)
  `).run({ userId, username: userId, rank, clinicalName: clinicalName || null, sala: sala || null });
}

export function upsertClinicalProfile(
  db,
  { userId, clinicalName, rank, sala, username, isProgramAdmin, adminAccessCode }
) {
  const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
  const fields = { clinicalName, rank, sala, adminFlag: parseProgramAdminFlag(isProgramAdmin) };

  if (existing) {
    assertAdminPromotionAllowed(db, userId, fields.adminFlag, adminAccessCode);
    updateExistingClinicalProfile(db, userId, fields);
    if (username != null && String(username).trim()) {
      claimUsername(db, { userId, username });
    }
    touchClinicalUserActivity(db, userId);
  } else {
    insertClinicalProfile(db, userId, fields);
    touchClinicalUserActivity(db, userId);
  }
  return getClinicalProfile(db, userId);
}

export function findUserByPublicKey(db, publicKeyPem) {
  return db
    .prepare('SELECT user_id, username, rank, public_key FROM users WHERE public_key = ?')
    .get(publicKeyPem);
}

export function resolveClinicalUserByUsername(db, { username }) {
  const handle = normalizeUsername(username);
  if (!handle) return null;
  const exact = db
    .prepare(
      `SELECT user_id, username, rank, clinical_name FROM users WHERE username = ? COLLATE NOCASE`
    )
    .get(handle);
  if (exact) return exact;
  const prefix = db
    .prepare(
      `SELECT user_id, username, rank, clinical_name FROM users WHERE username LIKE ? LIMIT 5`
    )
    .all(`${handle}%`);
  if (prefix.length === 1) return prefix[0];
  return null;
}
