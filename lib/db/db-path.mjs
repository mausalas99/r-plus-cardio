import path from 'node:path';

/** @param {string} userData */
export function clinicalDbPath(userData) {
  return path.join(userData, 'rplus-clinical.db');
}

/** Plaintext bootstrap metadata (KDF salt, optional wrapped DEK) for cold-start unlock. */
export function clinicalUnlockMetaPath(userData) {
  return path.join(userData, 'rplus-clinical.meta.json');
}
