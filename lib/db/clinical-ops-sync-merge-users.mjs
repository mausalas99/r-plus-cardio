import { touchClinicalUserActivity, getLanDeletedUserIds } from './clinical-access-db.mjs';
import { isValidUsernameFormat, normalizeUsername } from './clinical-username.mjs';

function isLanStubUsername(raw) {
  const handle = normalizeUsername(raw || '');
  return /^peer_[a-z0-9_]+$/.test(handle);
}

/** @param {import('better-sqlite3').Database} db @param {string} userId */
export function stubUsernameForLanUserId(db, userId) {
  const uid = String(userId || '').trim();
  const compact = uid.replace(/-/g, '').toLowerCase();
  let base = ('peer_' + compact.slice(0, 20)).replace(/[^a-z0-9_]/g, 'x');
  if (!isValidUsernameFormat(base)) base = 'peer_' + compact.slice(0, 8).replace(/[^a-z0-9]/g, 'x') || 'peer_user';
  let candidate = base;
  let n = 2;
  while (
    db.prepare(`SELECT 1 AS ok FROM users WHERE username = ? COLLATE NOCASE AND user_id <> ?`).get(
      candidate,
      uid
    )
  ) {
    candidate = base.slice(0, 28) + '_' + String(n);
    n += 1;
  }
  return candidate;
}

function resolveMergeUserHandle(db, row) {
  const uid = String(row?.user_id || '');
  let handle = normalizeUsername(row?.username || '');
  const clinicalName = String(row?.clinical_name || '').trim();
  if (handle && isValidUsernameFormat(handle)) return { uid, handle };
  if (!clinicalName) return null;

  const existingRow = db.prepare(`SELECT user_id, username FROM users WHERE user_id = ?`).get(uid);
  if (existingRow) {
    const existingHandle = normalizeUsername(existingRow.username || '');
    handle =
      isValidUsernameFormat(existingHandle) || isLanStubUsername(existingHandle)
        ? existingHandle
        : stubUsernameForLanUserId(db, uid);
  } else {
    handle = stubUsernameForLanUserId(db, uid);
  }
  return { uid, handle };
}

function applyClinicalUserRowUpdate(db, userId, row, handle) {
  db.prepare(
    `UPDATE users SET username = ?, rank = ?, clinical_name = ?, sala = ?,
     is_program_admin = COALESCE(?, is_program_admin)
     WHERE user_id = ?`
  ).run(
    handle,
    String(row.rank || 'R1'),
    row.clinical_name ?? null,
    row.sala ?? null,
    row.is_program_admin != null ? Number(row.is_program_admin) : null,
    userId
  );
  if (row.last_activity_at) {
    touchClinicalUserActivity(db, userId, String(row.last_activity_at));
  }
}

function mergeClinicalUserByHandle(db, row, handle, stats) {
  const byHandle = db
    .prepare(`SELECT user_id FROM users WHERE username = ? COLLATE NOCASE`)
    .get(handle);
  if (!byHandle) return false;
  const targetId = String(byHandle.user_id);
  if (targetId === String(row?.user_id || '')) return false;

  db.prepare(
    `UPDATE users SET rank = ?, clinical_name = ?, sala = ?,
     is_program_admin = COALESCE(?, is_program_admin)
     WHERE user_id = ?`
  ).run(
    String(row.rank || 'R1'),
    row.clinical_name ?? null,
    row.sala ?? null,
    row.is_program_admin != null ? Number(row.is_program_admin) : null,
    targetId
  );
  if (row.last_activity_at) {
    touchClinicalUserActivity(db, targetId, String(row.last_activity_at));
  }
  stats.updated += 1;
  return true;
}

export function mergeClinicalUsers(db, incomingRows) {
  const stats = { inserted: 0, updated: 0, upgradedFromStub: 0 };
  for (const row of incomingRows || []) {
    const resolved = resolveMergeUserHandle(db, row);
    if (!resolved) continue;
    const { uid, handle } = resolved;
    if (mergeClinicalUserByHandle(db, row, handle, stats)) continue;

    const existing = db
      .prepare(`SELECT user_id, username FROM users WHERE user_id = ?`)
      .get(uid);
    if (existing) {
      const wasStub = isLanStubUsername(existing.username);
      applyClinicalUserRowUpdate(db, uid, row, handle);
      stats.updated += 1;
      if (wasStub) stats.upgradedFromStub += 1;
      continue;
    }

    db.prepare(
      `INSERT INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala, is_program_admin, last_activity_at)
       VALUES (?, ?, '', ?, '', '', ?, ?, ?, ?)`
    ).run(
      uid,
      handle,
      String(row.rank || 'R1'),
      row.clinical_name ?? null,
      row.sala ?? null,
      row.is_program_admin != null ? Number(row.is_program_admin) : 0,
      row.last_activity_at ? String(row.last_activity_at) : null
    );
    stats.inserted += 1;
  }
  return stats;
}

function collectIncomingReferencedUserIds(incoming) {
  const needed = new Set();
  const add = (uid) => {
    const id = String(uid || '').trim();
    if (id) needed.add(id);
  };
  const addFromRows = (rows, field) => {
    for (const row of rows || []) add(row?.[field]);
  };
  addFromRows(incoming?.team_membership, 'user_id');
  for (const row of incoming?.teams || []) {
    add(row?.created_by);
    add(row?.leader_user_id);
  }
  addFromRows(incoming?.team_guardia_today, 'user_id');
  addFromRows(incoming?.active_guardias, 'covering_user_id');
  addFromRows(incoming?.entrega_template_user, 'user_id');
  addFromRows(incoming?.entrega_template_team, 'created_by');
  return needed;
}

/**
 * 6.5.6 peers export teams/membership but not clinical_users — stub missing user_ids
 * so FK team_membership → users does not abort the whole LAN merge.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} incoming
 * @returns {number} stubs created
 */
export function ensureStubLanUsersReferenced(db, incoming, deletedSet = null) {
  const tombstones = deletedSet || new Set(getLanDeletedUserIds(db));
  const needed = collectIncomingReferencedUserIds(incoming);
  if (!needed.size) return 0;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO users (user_id, username, password_hash, rank, public_key, encrypted_private_key, clinical_name, sala, is_program_admin)
     VALUES (?, ?, '', 'R1', '', '', NULL, NULL, 0)`
  );

  let created = 0;
  for (const uid of needed) {
    if (tombstones.has(uid)) continue;
    const exists = db.prepare(`SELECT 1 AS ok FROM users WHERE user_id = ?`).get(uid);
    if (exists) continue;
    insert.run(uid, stubUsernameForLanUserId(db, uid));
    created += 1;
  }
  return created;
}
