/** Preserved for parity with clinical-ops-bundle-merge rotation_cycles DB apply path. */
export function mergeRotationCycles(db, localRows, incomingRows) {
  const upsert = db.prepare(
    `INSERT INTO rotation_cycles
       (cycle_id, month_end_at, preview_days, preview_start_at, effective_at, archived_at, created_by, created_at)
     VALUES (@cycle_id, @month_end_at, @preview_days, @preview_start_at, @effective_at, @archived_at, @created_by, @created_at)
     ON CONFLICT(cycle_id) DO UPDATE SET
       archived_at = COALESCE(excluded.archived_at, rotation_cycles.archived_at),
       month_end_at = excluded.month_end_at,
       preview_days = excluded.preview_days,
       preview_start_at = excluded.preview_start_at,
       effective_at = excluded.effective_at`
  );
  const byId = new Map();
  for (const row of localRows) {
    if (row && row.cycle_id) byId.set(String(row.cycle_id), row);
  }
  for (const row of incomingRows) {
    if (row && row.cycle_id) byId.set(String(row.cycle_id), row);
  }
  for (const row of byId.values()) upsert.run(row);
}
