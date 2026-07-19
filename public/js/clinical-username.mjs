/** Renderer mirror of lib/db/clinical-username.mjs */
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

/**
 * Whether @usuario must be claimed on the current session row before profile save.
 * @param {string} currentHandle
 * @param {string} desiredHandle
 * @param {string} [clientId]
 */
export function shouldClaimClinicalUsername(currentHandle, desiredHandle, clientId) {
  const current = normalizeUsername(currentHandle);
  const desired = normalizeUsername(desiredHandle);
  if (current !== desired) return true;
  if (!isValidUsernameFormat(current)) return true;
  if (isLegacyMachineUsername(current, String(clientId || ''))) return true;
  if (/^local_[a-z0-9_]+$/.test(current)) return true;
  return false;
}
