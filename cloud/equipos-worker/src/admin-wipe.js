import { insertEquiposEvent } from './board.js';
import { deletePhotoObjects } from './photos.js';

/** @param {import('@cloudflare/workers-types').D1Database} db */
async function listEquiposPhotoFilePaths(db) {
  const { results } = await db.prepare(`SELECT id, file_path FROM equipos_photos`).all();
  return results || [];
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ adminName?: string, photoFilesRemoved?: number }} [input]
 */
async function equiposAdminWipeHistoryDb(db, input = {}) {
  const now = new Date().toISOString();
  const sessions = (await db.prepare(`DELETE FROM equipos_sessions`).run()).meta.changes;
  const reports = (await db.prepare(`DELETE FROM equipos_team_reports`).run()).meta.changes;
  const events = (await db.prepare(`DELETE FROM equipos_events`).run()).meta.changes;
  const photos = (await db.prepare(`DELETE FROM equipos_photos`).run()).meta.changes;
  const alertsReset = (
    await db
      .prepare(
        `UPDATE equipos_device SET status = CASE
           WHEN holder_name IS NOT NULL THEN 'in_use'
           ELSE 'available'
         END, updated_at = ?
         WHERE status = 'alert'`
      )
      .bind(now)
      .run()
  ).meta.changes;
  const previousCleared = (
    await db
      .prepare(
        `UPDATE equipos_device SET
           previous_holder_name = NULL,
           previous_holder_rotation = NULL,
           updated_at = ?`
      )
      .bind(now)
      .run()
  ).meta.changes;
  await insertEquiposEvent(db, 'admin_wipe_history', {
    reporterName: input.adminName || 'Admin',
    meta: {
      sessions,
      reports,
      events,
      photos,
      alertsReset,
      previousCleared,
      photoFilesRemoved: input.photoFilesRemoved ?? 0,
    },
  });
  return { sessions, reports, events, photos, alertsReset, previousCleared };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {import('@cloudflare/workers-types').R2Bucket} bucket
 * @param {{ adminName?: string, adminUserId?: string }} [input]
 */
export async function equiposAdminWipeHistory(db, bucket, input = {}) {
  const rows = await listEquiposPhotoFilePaths(db);
  const keys = rows.map((row) => row.file_path).filter(Boolean);
  if (keys.length) await deletePhotoObjects(bucket, keys);
  const counts = await equiposAdminWipeHistoryDb(db, {
    ...input,
    photoFilesRemoved: keys.length,
  });
  return { ...counts, photoFilesRemoved: keys.length };
}
