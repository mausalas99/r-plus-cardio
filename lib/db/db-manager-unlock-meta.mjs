import fs from 'node:fs';
import { clinicalDbPath, clinicalUnlockMetaPath } from './db-path.mjs';

export function readUnlockMeta(userDataPath) {
  const filePath = clinicalUnlockMetaPath(userDataPath);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

export function writeUnlockMeta(userDataPath, data) {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(clinicalUnlockMetaPath(userDataPath), JSON.stringify(serializeUnlockMeta(data)));
}

export function removeClinicalDbFiles(userDataPath) {
  const base = clinicalDbPath(userDataPath);
  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = suffix ? base + suffix : base;
    if (!fs.existsSync(filePath)) continue;
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* file may be locked */
    }
  }
}

export function removeUnlockMetaFile(userDataPath) {
  const filePath = clinicalUnlockMetaPath(userDataPath);
  if (!fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_e) { void _e; }
}

export function serializeUnlockMeta(data) {
  const safe = { ...data };
  if (safe.wrapped_dek != null && typeof safe.wrapped_dek !== 'string') {
    if (Buffer.isBuffer(safe.wrapped_dek)) {
      safe.wrapped_dek = safe.wrapped_dek.toString('base64');
    } else {
      safe.wrapped_dek = String(safe.wrapped_dek);
    }
  }
  return safe;
}
