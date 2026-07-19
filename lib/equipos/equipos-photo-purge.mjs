import fs from 'node:fs';
import path from 'node:path';
import { clearEquiposPhotoReferences } from './equipos-actions.mjs';
import { equiposPhotoRetentionCutoffIso } from './equipos-constants.mjs';

/**
 * Delete equipos photos older than {@link EQUIPOS_PHOTO_RETENTION_DAYS}.
 * Runs on the 06:00 UTC schedule; retention is age-based, not queue-idle.
 *
 * @param {string} photosDir
 * @param {() => import('better-sqlite3').Database | null} getDb
 * @param {number} [nowMs]
 */
export function purgeExpiredEquiposPhotos(photosDir, getDb, nowMs = Date.now()) {
  const db = typeof getDb === 'function' ? getDb() : null;
  if (!db) return { skipped: true, reason: 'no_db' };
  const cutoff = equiposPhotoRetentionCutoffIso(nowMs);
  const expired = db
    .prepare(`SELECT id, file_path FROM equipos_photos WHERE captured_at < ?`)
    .all(cutoff);
  if (!expired.length) {
    return { purged: true, removed: 0, cutoff };
  }
  if (fs.existsSync(photosDir)) {
    for (const row of expired) {
      const filePath = row.file_path || path.join(photosDir, `${row.id}.jpg`);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_e) {
        void _e;
      }
    }
  }
  const ids = expired.map((row) => row.id);
  clearEquiposPhotoReferences(db, ids);
  return { purged: true, removed: ids.length, cutoff };
}

/** @deprecated Use purgeExpiredEquiposPhotos */
export function purgeEquiposPhotosIfIdle(photosDir, getDb) {
  return purgeExpiredEquiposPhotos(photosDir, getDb);
}

/** @param {number} [nowMs] */
export function msUntilNextUtcSixAm(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6, 0, 0, 0)
  );
  if (next.getTime() <= nowMs) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - nowMs;
}

/**
 * @param {string} photosDir
 * @param {() => import('better-sqlite3').Database | null} getDb
 */
export function scheduleEquiposPhotoPurge(photosDir, getDb) {
  const run = () => {
    try {
      purgeExpiredEquiposPhotos(photosDir, getDb);
    } catch (e) {
      console.error('[equipos-purge]', e && e.message ? e.message : e);
    }
    setTimeout(run, 24 * 60 * 60 * 1000);
  };
  setTimeout(run, msUntilNextUtcSixAm());
}
