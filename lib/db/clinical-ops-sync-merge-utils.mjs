/** Null user FK when the referenced row is absent (tombstone / not yet merged). */
export function resolveMergeUserFk(db, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  return db.prepare(`SELECT 1 AS ok FROM users WHERE user_id = ?`).get(uid) ? uid : null;
}

export function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    if (row && row[key] != null) map.set(String(row[key]), row);
  }
  return map;
}

export function pickLastWriteRow(localRow, incomingRow, tsField) {
  if (!localRow) return incomingRow || null;
  if (!incomingRow) return localRow;
  const a = String(localRow[tsField] || '');
  const b = String(incomingRow[tsField] || '');
  return b >= a ? incomingRow : localRow;
}

function teamRowVersion(row) {
  if (!row) return '';
  const stamps = [row.archived_at, row.updated_at, row.created_at]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return stamps.sort().pop() || '';
}

export function pickTeamMergeWinner(localRow, incomingRow) {
  if (!localRow) return incomingRow || null;
  if (!incomingRow) return localRow;
  const a = teamRowVersion(localRow);
  const b = teamRowVersion(incomingRow);
  return b >= a ? incomingRow : localRow;
}

export function membershipPairKey(row) {
  const teamId = String(row?.team_id || '').trim();
  const userId = String(row?.user_id || '').trim();
  if (!teamId || !userId) return '';
  return `${teamId}\0${userId}`;
}

export function buildMembershipPairKeySet(rows) {
  const keys = new Set();
  for (const row of rows || []) {
    const key = membershipPairKey(row);
    if (key) keys.add(key);
  }
  return keys;
}

function membershipPairFromRow(row, tsField) {
  const teamId = String(row?.team_id || '').trim();
  const userId = String(row?.user_id || '').trim();
  const stampedAt = String(row?.[tsField] || '').trim();
  if (!teamId || !userId || !stampedAt) return null;
  return { teamId, userId, stampedAt, row: { team_id: teamId, user_id: userId, [tsField]: stampedAt } };
}

function mergeMembershipPairRows(localRows, incomingRows, tsField) {
  const map = new Map();
  for (const row of [...(localRows || []), ...(incomingRows || [])]) {
    const parsed = membershipPairFromRow(row, tsField);
    if (!parsed) continue;
    const key = `${parsed.teamId}\0${parsed.userId}`;
    const prev = map.get(key);
    if (!prev || parsed.stampedAt >= String(prev[tsField] || '')) {
      map.set(key, parsed.row);
    }
  }
  return [...map.values()];
}

export function mergeMembershipRemovalsRows(localRows, incomingRows) {
  return mergeMembershipPairRows(localRows, incomingRows, 'removed_at');
}

export function mergeMembershipRejoinsRows(localRows, incomingRows) {
  return mergeMembershipPairRows(localRows, incomingRows, 'joined_at');
}

export function mergeTeamsArchivedRows(localRows, incomingRows) {
  const map = new Map();
  for (const row of [...(localRows || []), ...(incomingRows || [])]) {
    const teamId = String(row?.team_id || '').trim();
    const archivedAt = String(row?.archived_at || '').trim();
    if (!teamId || !archivedAt) continue;
    const prev = map.get(teamId);
    if (!prev || archivedAt >= String(prev.archived_at || '')) {
      map.set(teamId, { team_id: teamId, archived_at: archivedAt });
    }
  }
  return [...map.values()];
}
