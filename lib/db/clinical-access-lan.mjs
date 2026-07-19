import { canManageTeamRoster } from './clinical-privileges.mjs';
import {
  isLanDirectoryPendingUsername,
  isLanRegisteredClinicalUser,
  isValidUsernameFormat,
  normalizeUsername,
} from './clinical-username.mjs';
import { getClinicalProfile, listClinicalUsers } from './clinical-access-users.mjs';
/**
 * Users visible in the LAN directory: everyone who registered (@usuario or nombre clínico),
 * plus teammates synced from LAN who only appear via membership stubs.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function listLanDirectoryUsers(db) {
  const deletedIds = new Set(getLanDeletedUserIds(db));
  const onActiveTeam = db
    .prepare(
      `SELECT 1 AS ok FROM team_membership tm
       JOIN teams t ON t.team_id = tm.team_id
       WHERE tm.user_id = ? AND t.archived_at IS NULL
       LIMIT 1`
    )
    .pluck(true);

  /** @type {Map<string, object>} */
  const byId = new Map();

  for (const row of listClinicalUsers(db)) {
    const handle = normalizeUsername(row?.username || '');
    const uid = String(row.user_id || '');
    if (!uid || deletedIds.has(uid)) continue;

    if (isLanRegisteredClinicalUser(row)) {
      const claimed =
        isValidUsernameFormat(handle) && !isLanDirectoryPendingUsername(handle);
      byId.set(uid, {
        ...row,
        username: handle,
        lanDirectoryPending: !claimed,
      });
      continue;
    }

    const onTeam = !!onActiveTeam.get(uid);
    if (!onTeam) continue;

    byId.set(uid, {
      ...row,
      username: handle,
      lanDirectoryPending: true,
    });
  }

  return [...byId.values()].sort((a, b) => {
    const ha = normalizeUsername(a.username || '');
    const hb = normalizeUsername(b.username || '');
    if (ha && hb) return ha.localeCompare(hb);
    if (ha) return -1;
    if (hb) return 1;
    return String(a.clinical_name || '').localeCompare(String(b.clinical_name || ''), 'es');
  });
}

const META_LAN_DELETED_USER_IDS = 'lan_clinical_users_deleted';
const META_LAN_RESOLVED_GUARDIAS = 'lan_guardias_resolved';
const META_LAN_MEMBERSHIP_REMOVALS = 'lan_team_membership_removals';
const META_LAN_MEMBERSHIP_REJOINS = 'lan_team_membership_rejoins';
const META_LAN_ARCHIVED_TEAMS = 'lan_teams_archived';

/** @param {import('better-sqlite3').Database} db */
export function getLanMembershipRemovals(db) {
  const raw =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_LAN_MEMBERSHIP_REMOVALS)?.value ??
    '[]';
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        team_id: String(row?.team_id || '').trim(),
        user_id: String(row?.user_id || '').trim(),
        removed_at: String(row?.removed_at || '').trim(),
      }))
      .filter((row) => row.team_id && row.user_id && row.removed_at);
  } catch {
    return [];
  }
}

/** @param {import('better-sqlite3').Database} db @param {object[]} rows */
export function persistLanMembershipRemovals(db, rows) {
  const map = new Map();
  for (const row of rows || []) {
    const teamId = String(row?.team_id || '').trim();
    const userId = String(row?.user_id || '').trim();
    const removedAt = String(row?.removed_at || '').trim();
    if (!teamId || !userId || !removedAt) continue;
    const key = `${teamId}\0${userId}`;
    const prev = map.get(key);
    if (!prev || removedAt >= String(prev.removed_at || '')) {
      map.set(key, { team_id: teamId, user_id: userId, removed_at: removedAt });
    }
  }
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_LAN_MEMBERSHIP_REMOVALS, JSON.stringify([...map.values()]));
}

/** @param {import('better-sqlite3').Database} db @param {string} teamId @param {string} userId */
export function recordLanMembershipRemoval(db, teamId, userId) {
  const tid = String(teamId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  const next = getLanMembershipRemovals(db).filter(
    (row) => !(row.team_id === tid && row.user_id === uid)
  );
  next.push({ team_id: tid, user_id: uid, removed_at: new Date().toISOString() });
  persistLanMembershipRemovals(db, next);
}

/** @param {import('better-sqlite3').Database} db */
export function getLanMembershipRejoins(db) {
  const raw =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_LAN_MEMBERSHIP_REJOINS)?.value ??
    '[]';
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        team_id: String(row?.team_id || '').trim(),
        user_id: String(row?.user_id || '').trim(),
        joined_at: String(row?.joined_at || '').trim(),
      }))
      .filter((row) => row.team_id && row.user_id && row.joined_at);
  } catch {
    return [];
  }
}

/** @param {import('better-sqlite3').Database} db @param {object[]} rows */
export function persistLanMembershipRejoins(db, rows) {
  const map = new Map();
  for (const row of rows || []) {
    const teamId = String(row?.team_id || '').trim();
    const userId = String(row?.user_id || '').trim();
    const joinedAt = String(row?.joined_at || '').trim();
    if (!teamId || !userId || !joinedAt) continue;
    const key = `${teamId}\0${userId}`;
    const prev = map.get(key);
    if (!prev || joinedAt >= String(prev.joined_at || '')) {
      map.set(key, { team_id: teamId, user_id: userId, joined_at: joinedAt });
    }
  }
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_LAN_MEMBERSHIP_REJOINS, JSON.stringify([...map.values()]));
}

/** @param {import('better-sqlite3').Database} db @param {string} teamId @param {string} userId */
export function recordLanMembershipRejoin(db, teamId, userId) {
  const tid = String(teamId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  const next = getLanMembershipRejoins(db).filter(
    (row) => !(row.team_id === tid && row.user_id === uid)
  );
  next.push({ team_id: tid, user_id: uid, joined_at: new Date().toISOString() });
  persistLanMembershipRejoins(db, next);
}

/** @param {import('better-sqlite3').Database} db @param {string} teamId @param {string} userId */
export function clearLanMembershipRejoin(db, teamId, userId) {
  const tid = String(teamId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  const next = getLanMembershipRejoins(db).filter(
    (row) => !(row.team_id === tid && row.user_id === uid)
  );
  persistLanMembershipRejoins(db, next);
}

/** @param {import('better-sqlite3').Database} db @param {string} teamId @param {string} userId */
export function clearLanMembershipRemoval(db, teamId, userId) {
  const tid = String(teamId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  const next = getLanMembershipRemovals(db).filter(
    (row) => !(row.team_id === tid && row.user_id === uid)
  );
  persistLanMembershipRemovals(db, next);
}

/** @param {import('better-sqlite3').Database} db @param {object[]} removals */
export function applyLanMembershipRemovals(db, removals) {
  const stmt = db.prepare(`DELETE FROM team_membership WHERE team_id = ? AND user_id = ?`);
  for (const row of removals || []) {
    const tid = String(row?.team_id || '').trim();
    const uid = String(row?.user_id || '').trim();
    if (!tid || !uid) continue;
    stmt.run(tid, uid);
  }
}

/** @param {import('better-sqlite3').Database} db */
/** @param {import('better-sqlite3').Database} db */
export function getLanArchivedTeams(db) {
  const raw =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_LAN_ARCHIVED_TEAMS)?.value ??
    '[]';
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        team_id: String(row?.team_id || '').trim(),
        archived_at: String(row?.archived_at || '').trim(),
      }))
      .filter((row) => row.team_id && row.archived_at);
  } catch {
    return [];
  }
}

/** @param {import('better-sqlite3').Database} db @param {object[]} rows */
export function persistLanArchivedTeams(db, rows) {
  const map = new Map();
  for (const row of rows || []) {
    const teamId = String(row?.team_id || '').trim();
    const archivedAt = String(row?.archived_at || '').trim();
    if (!teamId || !archivedAt) continue;
    const prev = map.get(teamId);
    if (!prev || archivedAt >= String(prev.archived_at || '')) {
      map.set(teamId, { team_id: teamId, archived_at: archivedAt });
    }
  }
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_LAN_ARCHIVED_TEAMS, JSON.stringify([...map.values()]));
}

/** @param {import('better-sqlite3').Database} db @param {string} teamId @param {string} [archivedAt] */
export function recordLanTeamArchive(db, teamId, archivedAt) {
  const tid = String(teamId || '').trim();
  if (!tid) return;
  const at = String(archivedAt || '').trim() || new Date().toISOString();
  const next = getLanArchivedTeams(db).filter((row) => row.team_id !== tid);
  next.push({ team_id: tid, archived_at: at });
  persistLanArchivedTeams(db, next);
}

/** @returns {Array<{ patient_id: string, guardia_id?: string, assigned_at: string }>} */
export function getLanResolvedGuardias(db) {
  const raw =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_LAN_RESOLVED_GUARDIAS)?.value ??
    '[]';
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        patient_id: String(row?.patient_id || '').trim(),
        guardia_id: row?.guardia_id ? String(row.guardia_id) : undefined,
        assigned_at: String(row?.assigned_at || '').trim(),
      }))
      .filter((row) => row.patient_id && row.assigned_at);
  } catch {
    return [];
  }
}

/** @param {import('better-sqlite3').Database} db @param {Array<{ patient_id: string, guardia_id?: string, assigned_at: string }>} rows */
function persistLanResolvedGuardias(db, rows) {
  const byPatient = new Map();
  for (const row of rows || []) {
    const pid = String(row?.patient_id || '').trim();
    if (!pid) continue;
    const at = String(row?.assigned_at || '').trim();
    if (!at) continue;
    const prev = byPatient.get(pid);
    if (!prev || at >= String(prev.assigned_at || '')) {
      byPatient.set(pid, {
        patient_id: pid,
        guardia_id: row?.guardia_id ? String(row.guardia_id) : undefined,
        assigned_at: at,
      });
    }
  }
  const next = [...byPatient.values()].sort((a, b) =>
    String(a.assigned_at).localeCompare(String(b.assigned_at))
  );
  const capped = next.length > 200 ? next.slice(next.length - 200) : next;
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_LAN_RESOLVED_GUARDIAS, JSON.stringify(capped));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ patient_id: string, guardia_id?: string, assigned_at: string }} row
 */
export function rememberLanResolvedGuardia(db, row) {
  const pid = String(row?.patient_id || '').trim();
  const at = String(row?.assigned_at || '').trim();
  if (!pid || !at) return;
  const next = getLanResolvedGuardias(db).filter((r) => String(r.patient_id) !== pid);
  next.push({
    patient_id: pid,
    guardia_id: row?.guardia_id ? String(row.guardia_id) : undefined,
    assigned_at: at,
  });
  persistLanResolvedGuardias(db, next);
}

/**
 * Union LAN entrega-resolution tombstones and apply to active rows on this device.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} incoming
 * @param {object} [localSnapshot]
 */
export function applyLanResolvedGuardiasFromSnapshot(db, incoming, localSnapshot = null) {
  const merged = persistLanResolvedGuardiasUnion(db, incoming, localSnapshot);
  let applied = 0;
  for (const row of merged) {
    const active = db
      .prepare(
        `SELECT guardia_id, assigned_at FROM active_guardias
         WHERE patient_id = ? AND status = 'Active'`
      )
      .get(row.patient_id);
    if (!active) continue;
    if (String(row.assigned_at || '') >= String(active.assigned_at || '')) {
      db.prepare(
        `UPDATE active_guardias SET status = 'Resolved', assigned_at = ? WHERE guardia_id = ?`
      ).run(row.assigned_at, active.guardia_id);
      applied += 1;
    }
  }
  return { applied, merged };
}

function collectResolvedGuardiaLists(db, incoming, localSnapshot) {
  const lists = [getLanResolvedGuardias(db)];
  if (Array.isArray(localSnapshot?.active_guardias_resolved)) {
    lists.push(localSnapshot.active_guardias_resolved);
  }
  if (Array.isArray(incoming?.active_guardias_resolved)) {
    lists.push(incoming.active_guardias_resolved);
  }
  return lists;
}

function normalizeResolvedGuardiaRow(row) {
  const patient_id = String(row?.patient_id || '').trim();
  const assigned_at = String(row?.assigned_at || '').trim();
  if (!patient_id || !assigned_at) return null;
  return {
    patient_id,
    guardia_id: row?.guardia_id ? String(row.guardia_id) : undefined,
    assigned_at,
  };
}

function mergeResolvedGuardiasByPatient(lists) {
  const byPatient = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      const normalized = normalizeResolvedGuardiaRow(row);
      if (!normalized) continue;
      const prev = byPatient.get(normalized.patient_id);
      if (!prev || normalized.assigned_at >= String(prev.assigned_at || '')) {
        byPatient.set(normalized.patient_id, normalized);
      }
    }
  }
  return [...byPatient.values()];
}

/** @param {import('better-sqlite3').Database} db @param {object} incoming @param {object} [localSnapshot] */
function persistLanResolvedGuardiasUnion(db, incoming, localSnapshot = null) {
  const lists = collectResolvedGuardiaLists(db, incoming, localSnapshot);
  const merged = mergeResolvedGuardiasByPatient(lists);
  persistLanResolvedGuardias(db, merged);
  return merged;
}

export function getLanDeletedUserIds(db) {
  const raw =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_LAN_DELETED_USER_IDS)?.value ??
    '[]';
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

/** @param {import('better-sqlite3').Database} db @param {string[]} ids */
function persistLanDeletedUserIds(db, ids) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_LAN_DELETED_USER_IDS, JSON.stringify(unique));
}

/** @param {import('better-sqlite3').Database} db @param {string} userId */
function addLanDeletedUserId(db, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const next = getLanDeletedUserIds(db);
  if (!next.includes(uid)) next.push(uid);
  persistLanDeletedUserIds(db, next);
}

/**
 * Drop FK references then remove the user row (no permission checks).
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 */
export function purgeClinicalUserFromDb(db, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  if (!db.prepare(`SELECT 1 AS ok FROM users WHERE user_id = ?`).get(uid)) return;

  db.prepare(`DELETE FROM active_guardias WHERE covering_user_id = ?`).run(uid);
  db.prepare(`DELETE FROM team_membership WHERE user_id = ?`).run(uid);
  db.prepare(`DELETE FROM team_guardia_today WHERE user_id = ?`).run(uid);
  db.prepare(`DELETE FROM entrega_template_user WHERE user_id = ?`).run(uid);
  db.prepare(`UPDATE teams SET created_by = NULL WHERE created_by = ?`).run(uid);
  db.prepare(`UPDATE teams SET leader_user_id = NULL WHERE leader_user_id = ?`).run(uid);
  db.prepare(`UPDATE rotation_cycles SET created_by = NULL WHERE created_by = ?`).run(uid);
  db.prepare(`UPDATE entrega_template_team SET created_by = NULL WHERE created_by = ?`).run(uid);
  if (tableExists(db, 'sala_interno_access')) {
    db.prepare(`UPDATE sala_interno_access SET rotated_by = NULL WHERE rotated_by = ?`).run(uid);
  }
  db.prepare(`DELETE FROM users WHERE user_id = ?`).run(uid);
  purgeLanMembershipMetaForUser(db, uid);
}

/** Drop LAN leave/rejoin meta rows for a purged or deleted user. */
export function purgeLanMembershipMetaForUser(db, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const dropUser = (rows) =>
    (rows || []).filter((row) => String(row?.user_id || '').trim() !== uid);
  persistLanMembershipRemovals(db, dropUser(getLanMembershipRemovals(db)));
  persistLanMembershipRejoins(db, dropUser(getLanMembershipRejoins(db)));
}

function tableExists(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

/**
 * Admin removes a LAN directory user on this Mac; tombstone prevents LAN merge from re-adding.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ targetUserId: string, callerUserId: string }} opts
 */
/**
 * Union LAN tombstones and purge deleted users so peers cannot re-add via merge.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} incoming
 * @param {object} [localSnapshot]
 */
export function applyLanDeletedUsersFromSnapshot(db, incoming, localSnapshot = null) {
  const localIds = Array.isArray(localSnapshot?.clinical_users_deleted)
    ? localSnapshot.clinical_users_deleted
    : getLanDeletedUserIds(db);
  const incomingIds = Array.isArray(incoming?.clinical_users_deleted)
    ? incoming.clinical_users_deleted
    : [];
  const resurrected = new Set(
    (incoming?.clinical_users || [])
      .map((row) => String(row?.user_id || '').trim())
      .filter(Boolean)
  );
  const merged = [
    ...new Set(
      [...getLanDeletedUserIds(db), ...localIds, ...incomingIds]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];
  persistLanDeletedUserIds(db, merged);
  let purged = 0;
  let resurrectedCount = 0;
  for (const uid of merged) {
    if (resurrected.has(uid)) {
      resurrectedCount += 1;
      continue;
    }
    db.prepare(`DELETE FROM team_membership WHERE user_id = ?`).run(uid);
    const had = db.prepare(`SELECT 1 AS ok FROM users WHERE user_id = ?`).get(uid);
    purgeClinicalUserFromDb(db, uid);
    if (had) purged += 1;
  }
  return { purged, resurrected: resurrectedCount };
}

export function deleteLanDirectoryUser(db, { targetUserId, callerUserId }) {
  const caller = getClinicalProfile(db, String(callerUserId || ''));
  if (!canManageTeamRoster(caller)) {
    throw new Error(
      'Solo R4, Admin o usuarios con privilegios de administración pueden eliminar usuarios LAN.'
    );
  }
  const uid = String(targetUserId || '').trim();
  const callerId = String(callerUserId || '').trim();
  if (!uid) throw new Error('Usuario no indicado.');
  if (callerId && uid === callerId) {
    throw new Error('No puedes eliminar tu propio usuario clínico en esta Mac.');
  }
  if (!db.prepare(`SELECT 1 AS ok FROM users WHERE user_id = ?`).get(uid)) {
    throw new Error('Usuario no encontrado en esta Mac.');
  }

  const memberships = db
    .prepare(`SELECT team_id FROM team_membership WHERE user_id = ?`)
    .all(uid);
  for (const row of memberships) {
    recordLanMembershipRemoval(db, String(row.team_id || ''), uid);
  }
  db.prepare(`DELETE FROM team_membership WHERE user_id = ?`).run(uid);

  addLanDeletedUserId(db, uid);
  purgeClinicalUserFromDb(db, uid);
  return { userId: uid, deleted: true };
}
