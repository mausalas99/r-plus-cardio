import { EquiposError } from './equipos-errors.mjs';

/** @param {string} deviceType @param {object} input */
export function parseLumifyReturnFields(deviceType, input) {
  if (deviceType !== 'lumify') return { lumifyCharge: null, gelEmpty: null };
  const pct = Number(input.chargePct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new EquiposError('charge_required', 'La carga de tablet es obligatoria al entregar.');
  }
  if (input.gelEmpty === undefined || input.gelEmpty === null) {
    throw new EquiposError('gel_required', 'Indica si el gel está vacío.');
  }
  return { lumifyCharge: Math.round(pct), gelEmpty: input.gelEmpty ? 1 : 0 };
}

/** @param {import('better-sqlite3').Database} db @param {object} session @param {object} fields */
export function closeEquiposSession(db, session, fields) {
  const now = fields.now;
  const checked = Date.parse(session.checked_out_at);
  const duration = Math.max(0, Math.round((Date.now() - checked) / 1000));
  db.prepare(
    `UPDATE equipos_sessions SET
      returned_at = ?, duration_seconds = ?, closed_reason = ?,
      lumify_charge_pct = ?, lumify_gel_empty = ?, return_photo_id = ?
     WHERE id = ?`
  ).run(
    now,
    duration,
    fields.closedReason,
    fields.lumifyCharge,
    fields.gelEmpty,
    fields.returnPhotoId,
    session.id
  );
}
