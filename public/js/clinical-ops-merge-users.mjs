/** Clinical user merge helpers (extracted for complexity budget). */

function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function isValidUsernameFormat(raw) {
  return /^[a-z][a-z0-9_]{2,31}$/.test(normalizeUsername(raw));
}

export function mergeClinicalUsersDeletedData(localIds, incomingIds) {
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

function mergeUserProfileFields(prev, row) {
  return {
    ...prev,
    rank: row.rank ?? prev.rank,
    clinical_name: row.clinical_name ?? prev.clinical_name,
    sala: row.sala ?? prev.sala,
    is_program_admin:
      row.is_program_admin != null ? row.is_program_admin : prev.is_program_admin,
  };
}

function mergeIncomingUserHandleConflict(byUserId, row, handle, uid) {
  const prevByUid = byUserId.get(uid) || null;
  const mergedByUid = prevByUid
    ? mergeUserProfileFields(prevByUid, row)
    : { ...row, username: prevByUid ? prevByUid.username : row.username };
  byUserId.set(uid, mergedByUid);
}

function mergeIncomingClinicalUser(byUsername, byUserId, row) {
  if (!row?.user_id) return;
  const handle = normalizeUsername(row.username);
  if (!handle || !isValidUsernameFormat(handle)) return;
  const uid = String(row.user_id);
  const existingByHandle = byUsername.get(handle);
  if (existingByHandle && existingByHandle.user_id !== uid) {
    mergeIncomingUserHandleConflict(byUserId, row, handle, uid);
    return;
  }
  const prev = byUserId.get(uid) || existingByHandle || null;
  const merged = prev
    ? { ...mergeUserProfileFields(prev, row), username: handle }
    : { ...row, username: handle };
  byUserId.set(uid, merged);
  byUsername.set(handle, merged);
}

export function mergeClinicalUsersData(localRows, incomingRows) {
  const byUsername = new Map();
  const byUserId = new Map();
  for (const row of localRows || []) {
    if (!row?.user_id) continue;
    byUserId.set(String(row.user_id), { ...row });
    const handle = normalizeUsername(row.username);
    if (handle && isValidUsernameFormat(handle)) byUsername.set(handle, { ...row });
  }
  for (const row of incomingRows || []) {
    mergeIncomingClinicalUser(byUsername, byUserId, row);
  }
  return [...byUserId.values()];
}

export { normalizeUsername, isValidUsernameFormat };
