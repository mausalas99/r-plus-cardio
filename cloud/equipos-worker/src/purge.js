import { clearEquiposPhotoReferences } from './actions.js';
import { deletePhotoObjects } from './photos.js';
import { equiposPhotoRetentionCutoffIso } from './constants.js';

/**
 * Delete equipos photos older than retention window (admin history ~2 weeks).
 * Daily 06:00 UTC cron — age-based, not queue-idle.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {import('@cloudflare/workers-types').R2Bucket} bucket
 * @param {number} [nowMs]
 */
export async function purgeExpiredEquiposPhotos(db, bucket, nowMs = Date.now()) {
  const cutoff = equiposPhotoRetentionCutoffIso(nowMs);
  const { results } = await db
    .prepare(`SELECT id, file_path FROM equipos_photos WHERE captured_at < ?`)
    .bind(cutoff)
    .all();
  const rows = results || [];
  if (!rows.length) {
    return { purged: true, removed: 0, cutoff };
  }
  const keys = rows.map((r) => r.file_path).filter(Boolean);
  if (keys.length) await deletePhotoObjects(bucket, keys);
  const ids = rows.map((r) => r.id);
  await clearEquiposPhotoReferences(db, ids);
  return { purged: true, removed: ids.length, cutoff };
}

/** @deprecated Use purgeExpiredEquiposPhotos */
export async function purgeEquiposPhotosIfIdle(db, bucket) {
  return purgeExpiredEquiposPhotos(db, bucket);
}
