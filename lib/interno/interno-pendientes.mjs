import { completeActiveGuardiaPendiente } from '../db/clinical-access-db.mjs';

/**
 * Mark a pendiente item complete on the patient's active guardia row.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} patientId
 * @param {string} itemId
 * @param {object|null|undefined} completedBy
 * @returns {{ ok: true, item: object } | { ok: false, error: string }}
 */
export function patchGuardiaPendienteComplete(db, patientId, itemId, completedBy) {
  const pid = String(patientId || '').trim();
  const iid = String(itemId || '').trim();
  if (!pid || !iid) return { ok: false, error: 'invalid_params' };

  const row = db
    .prepare(
      `SELECT guardia_id FROM active_guardias
       WHERE patient_id = ? AND status = 'Active' LIMIT 1`
    )
    .get(pid);
  if (!row) return { ok: false, error: 'guardia_not_found' };

  const item = completeActiveGuardiaPendiente(db, {
    patientId: pid,
    itemId: iid,
    completedBy,
  });
  if (!item) return { ok: false, error: 'item_not_found' };

  return { ok: true, item };
}
