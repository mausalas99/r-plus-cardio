const USERNAME_RE = /^[a-z][a-z0-9_]{2,31}$/;

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

export function isValidUsernameFormat(raw) {
  return USERNAME_RE.test(normalizeUsername(raw));
}

/** @param {string} username @param {string} clientId */
export function isLegacyMachineUsername(username, clientId) {
  const u = String(username || '');
  const c = String(clientId || '');
  if (!u) return true;
  if (c && u === c) return true;
  return /^lc_[a-z0-9_]+$/i.test(u);
}

/** Machine or LAN-stub handle — valid syntax but not a claimed @usuario for the directory. */
export function isLanDirectoryPendingUsername(raw) {
  const handle = normalizeUsername(raw || '');
  if (!handle) return true;
  if (!isValidUsernameFormat(handle)) return true;
  if (/^lc_[a-z0-9_]+$/.test(handle)) return true;
  if (/^peer_[a-z0-9_]+$/.test(handle)) return true;
  return false;
}

/**
 * Completed clinical registration: claimed @usuario or saved nombre clínico.
 * Does not require sala or active team.
 * @param {{ username?: string, clinical_name?: string } | null | undefined} row
 */
export function isLanRegisteredClinicalUser(row) {
  const handle = normalizeUsername(row?.username || '');
  if (isValidUsernameFormat(handle) && !isLanDirectoryPendingUsername(handle)) return true;
  return !!String(row?.clinical_name || '').trim();
}
