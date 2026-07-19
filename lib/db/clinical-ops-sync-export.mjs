import {
  getLanDeletedUserIds,
  getLanArchivedTeams,
  getLanMembershipRemovals,
  getLanMembershipRejoins,
  getLanResolvedGuardias,
} from './clinical-access-db.mjs';
import {
  isLanRegisteredClinicalUser,
  isValidUsernameFormat,
  normalizeUsername,
} from './clinical-username.mjs';
import { META_ROTATION_NUEVA_AT } from './clinical-ops-sync-constants.mjs';

function addReferencedUserId(needed, uid) {
  const id = String(uid || '').trim();
  if (id) needed.add(id);
}

function addUserIdsFromRows(needed, rows, field) {
  for (const row of rows || []) addReferencedUserId(needed, row?.[field]);
}

function collectMembershipReferencedUserIds(_db, rows) {
  const needed = new Set();
  addUserIdsFromRows(needed, rows?.team_membership, 'user_id');
  for (const row of rows?.teams || []) {
    addReferencedUserId(needed, row?.created_by);
    addReferencedUserId(needed, row?.leader_user_id);
  }
  addUserIdsFromRows(needed, rows?.team_guardia_today, 'user_id');
  addUserIdsFromRows(needed, rows?.active_guardias, 'covering_user_id');
  addUserIdsFromRows(needed, rows?.entrega_template_user, 'user_id');
  addUserIdsFromRows(needed, rows?.entrega_template_team, 'created_by');
  return needed;
}

/** Export for LAN directorio: claimed @usuario or saved nombre clínico (sala optional). */
function shouldExportClinicalUserForLan(row, deletedIds) {
  const uid = String(row?.user_id || '').trim();
  if (!uid || deletedIds.has(uid)) return false;
  return isLanRegisteredClinicalUser(row);
}

function appendMembershipReferencedUsers(db, clinicalUsers, deletedIds, refs) {
  const exportedIds = new Set(
    (clinicalUsers || []).map((row) => String(row?.user_id || '').trim()).filter(Boolean)
  );
  const select = db.prepare(
    `SELECT user_id, username, rank, clinical_name, sala, is_program_admin, created_at
     FROM users WHERE user_id = ?`
  );
  let added = 0;
  for (const uid of refs) {
    if (exportedIds.has(uid) || deletedIds.has(uid)) continue;
    const row = select.get(uid);
    if (!row) continue;
    const handle = normalizeUsername(row?.username || '');
    const clinicalName = String(row?.clinical_name || '').trim();
    if (!isValidUsernameFormat(handle) && !clinicalName) continue;
    clinicalUsers.push({
      ...row,
      username: isValidUsernameFormat(handle) ? handle : handle || uid.slice(0, 8),
    });
    exportedIds.add(uid);
    added += 1;
  }
  return added;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function exportClinicalOpsSnapshot(db) {
  const rotationNuevaAt =
    db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_ROTATION_NUEVA_AT)?.value ??
    null;
  const deletedIds = new Set(getLanDeletedUserIds(db));
  const team_membership = db.prepare(`SELECT * FROM team_membership`).all();
  const teams = db.prepare(`SELECT * FROM teams ORDER BY name`).all();
  const team_guardia_today = db.prepare(`SELECT * FROM team_guardia_today`).all();
  const active_guardias = db
    .prepare(`SELECT * FROM active_guardias WHERE status = 'Active' ORDER BY assigned_at`)
    .all();
  const entrega_template_user = db
    .prepare(`SELECT * FROM entrega_template_user ORDER BY created_at`)
    .all();
  const entrega_template_team = db
    .prepare(`SELECT * FROM entrega_template_team ORDER BY created_at`)
    .all();

  const clinical_users = db
    .prepare(
      `SELECT user_id, username, rank, clinical_name, sala, is_program_admin, created_at, last_activity_at
       FROM users ORDER BY username`
    )
    .all()
    .filter((row) => shouldExportClinicalUserForLan(row, deletedIds));

  const refs = collectMembershipReferencedUserIds(db, {
    team_membership,
    teams,
    team_guardia_today,
    active_guardias,
    entrega_template_user,
    entrega_template_team,
  });
  appendMembershipReferencedUsers(db, clinical_users, deletedIds, refs);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    rotationNuevaAt,
    clinical_users_deleted: [...deletedIds],
    teams_archived: getLanArchivedTeams(db),
    rotation_cycles: db.prepare(`SELECT * FROM rotation_cycles ORDER BY created_at`).all(),
    patient_team_assignment: db
      .prepare(`SELECT * FROM patient_team_assignment ORDER BY created_at`)
      .all(),
    team_guardia_today,
    teams,
    team_membership,
    active_guardias,
    active_guardias_resolved: getLanResolvedGuardias(db),
    clinical_users,
    team_membership_removals: getLanMembershipRemovals(db),
    team_membership_rejoins: getLanMembershipRejoins(db),
    entrega_template_user,
    entrega_template_team,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} iso
 */
export function stampRotationNuevaAt(db, iso) {
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_ROTATION_NUEVA_AT, iso);
}
