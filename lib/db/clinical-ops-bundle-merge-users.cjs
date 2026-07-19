'use strict';

function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function isValidUsernameFormat(raw) {
  return /^[a-z][a-z0-9_]{2,31}$/.test(normalizeUsername(raw));
}

function peerStubUsernameForUserId(userId) {
  const compact = String(userId || '')
    .replace(/-/g, '')
    .toLowerCase();
  let base = ('peer_' + compact.slice(0, 20)).replace(/[^a-z0-9_]/g, 'x');
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(base)) {
    base = 'peer_' + (compact.slice(0, 8).replace(/[^a-z0-9]/g, 'x') || 'user');
  }
  return base;
}

function resolveIncomingClinicalUserHandle(row, byUserId) {
  const uid = String(row.user_id);
  let handle = normalizeUsername(row.username);
  if (handle && isValidUsernameFormat(handle)) return handle;
  const clinicalName = String(row.clinical_name || '').trim();
  if (!clinicalName) return '';
  const prev = byUserId.get(uid);
  const prevHandle = prev ? normalizeUsername(prev.username) : '';
  if (prevHandle && isValidUsernameFormat(prevHandle)) return prevHandle;
  if (prevHandle && /^peer_[a-z0-9_]+$/.test(prevHandle)) return prevHandle;
  return peerStubUsernameForUserId(uid);
}

function mergeClinicalUsersDeletedData(localIds, incomingIds) {
  const set = new Set();
  for (const id of localIds || []) {
    const uid = String(id || '').trim();
    if (uid) set.add(uid);
  }
  for (const id of incomingIds || []) {
    const uid = String(id || '').trim();
    if (uid) set.add(uid);
  }
  return [...set];
}

function mergeLastActivityIso(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left) return right || null;
  if (!right) return left;
  return left >= right ? left : right;
}

function mergeClinicalUserFields(prev, row, handle) {
  return {
    ...prev,
    username: handle,
    rank: row.rank ?? prev.rank,
    clinical_name: row.clinical_name ?? prev.clinical_name,
    sala: row.sala ?? prev.sala,
    is_program_admin:
      row.is_program_admin != null ? row.is_program_admin : prev.is_program_admin,
    last_activity_at: mergeLastActivityIso(prev.last_activity_at, row.last_activity_at),
  };
}

function seedClinicalUserMaps(localRows) {
  const byUsername = new Map();
  const byUserId = new Map();
  for (const row of localRows || []) {
    if (!row?.user_id) continue;
    byUserId.set(String(row.user_id), { ...row });
    const handle = normalizeUsername(row.username);
    if (handle && isValidUsernameFormat(handle)) byUsername.set(handle, { ...row });
  }
  return { byUsername, byUserId };
}

function applyIncomingClinicalUserRow(byUsername, byUserId, row) {
  const uid = String(row.user_id);
  const handle = resolveIncomingClinicalUserHandle(row, byUserId);
  if (!handle) return;

  const existingByHandle = byUsername.get(handle);
  if (existingByHandle && existingByHandle.user_id !== uid) {
    const prevByUid = byUserId.get(uid) || null;
    const mergedByUid = prevByUid
      ? mergeClinicalUserFields(prevByUid, row, prevByUid.username)
      : { ...row, username: prevByUid ? prevByUid.username : row.username };
    byUserId.set(uid, mergedByUid);
    return;
  }

  const prev = byUserId.get(uid) || existingByHandle || null;
  const merged = prev ? mergeClinicalUserFields(prev, row, handle) : { ...row, username: handle };
  byUserId.set(uid, merged);
  byUsername.set(handle, merged);
}

function mergeClinicalUsersData(localRows, incomingRows) {
  const { byUsername, byUserId } = seedClinicalUserMaps(localRows);
  for (const row of incomingRows || []) {
    if (!row?.user_id) continue;
    applyIncomingClinicalUserRow(byUsername, byUserId, row);
  }
  return [...byUserId.values()];
}

module.exports = {
  mergeClinicalUsersData,
  mergeClinicalUsersDeletedData,
};
