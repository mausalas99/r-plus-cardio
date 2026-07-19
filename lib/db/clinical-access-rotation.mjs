import crypto from 'node:crypto';
/** @param {Date} d */
function toStoredIso(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ monthEndAt: string, effectiveAt: string, previewDays?: number, createdBy?: string }} opts
 */
export function upsertRotationCycle(db, { monthEndAt, effectiveAt, previewDays = 2, createdBy }) {
  const effective = new Date(effectiveAt);
  const previewStart = new Date(effective);
  previewStart.setDate(previewStart.getDate() - Number(previewDays));
  const cycleId = crypto.randomUUID();
  const row = {
    cycle_id: cycleId,
    month_end_at: monthEndAt,
    preview_days: previewDays,
    preview_start_at: toStoredIso(previewStart),
    effective_at: toStoredIso(effective),
    created_by: createdBy ?? null,
  };
  db.prepare(
    `INSERT INTO rotation_cycles (cycle_id, month_end_at, preview_days, preview_start_at, effective_at, created_by)
     VALUES (@cycle_id, @month_end_at, @preview_days, @preview_start_at, @effective_at, @created_by)`
  ).run(row);
  return row;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function getActiveRotationCycle(db) {
  return db
    .prepare(
      `SELECT * FROM rotation_cycles WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 1`
    )
    .get();
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function archiveRotationAndTeams(db) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE rotation_cycles SET archived_at = ? WHERE archived_at IS NULL`).run(now);
  db.prepare(`UPDATE teams SET archived_at = ?, rotation_active = 0 WHERE archived_at IS NULL`).run(now);
  db.prepare(`DELETE FROM active_guardias`).run();
  db.prepare(`DELETE FROM team_guardia_today`).run();
}
