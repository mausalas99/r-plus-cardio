import fs from 'node:fs';
import path from 'node:path';
import { insertEquiposEvent } from './equipos-board.mjs';

/** @param {import('better-sqlite3').Database} db */
export function listEquiposPhotoFilePaths(db) {
  return db.prepare(`SELECT id, file_path FROM equipos_photos`).all();
}

/**
 * @param {Array<{ id?: string, file_path?: string }>} rows
 * @param {string} [photosDir]
 */
export function deleteEquiposPhotoFiles(rows, photosDir = '') {
  let removed = 0;
  for (const row of rows) {
    const filePath = row.file_path || (photosDir ? path.join(photosDir, `${row.id}.jpg`) : '');
    if (!filePath) continue;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removed += 1;
      }
    } catch (_e) {
      void _e;
    }
  }
  return removed;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ adminName?: string, photoFilesRemoved?: number }} [input]
 */
export function equiposAdminWipeHistoryDb(db, input = {}) {
  const now = new Date().toISOString();
  const sessions = db.prepare(`DELETE FROM equipos_sessions`).run().changes;
  const reports = db.prepare(`DELETE FROM equipos_team_reports`).run().changes;
  const events = db.prepare(`DELETE FROM equipos_events`).run().changes;
  const photos = db.prepare(`DELETE FROM equipos_photos`).run().changes;
  const alertsReset = db
    .prepare(
      `UPDATE equipos_device SET status = CASE
         WHEN holder_name IS NOT NULL THEN 'in_use'
         ELSE 'available'
       END, updated_at = ?
       WHERE status = 'alert'`
    )
    .run(now).changes;
  const previousCleared = db
    .prepare(
      `UPDATE equipos_device SET
         previous_holder_name = NULL,
         previous_holder_rotation = NULL,
         updated_at = ?`
    )
    .run(now).changes;
  insertEquiposEvent(db, 'admin_wipe_history', {
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
 * @param {import('better-sqlite3').Database} db
 * @param {{ adminName?: string, adminUserId?: string }} [input]
 * @param {string} [photosDir]
 */
export function equiposAdminWipeHistory(db, input = {}, photosDir = '') {
  const rows = listEquiposPhotoFilePaths(db);
  const photoFilesRemoved = deleteEquiposPhotoFiles(rows, photosDir);
  const counts = equiposAdminWipeHistoryDb(db, { ...input, photoFilesRemoved });
  return { ...counts, photoFilesRemoved };
}
