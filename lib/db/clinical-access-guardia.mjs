import crypto from 'node:crypto';
import {
  completePendienteItem,
  normalizePendientesJson,
  serializePendientesJson,
} from '../entrega/entrega-pendientes.mjs';
import { loadCensusPatientIdSet } from './clinical-access-assignments.mjs';
import { rememberLanResolvedGuardia } from './clinical-access-lan.mjs';
const GUARDIA_VITALS_FREQ = new Set(['1h', '2h', '4h', 'Shift_Once', 'None']);

function normalizeGuardiaVitalsFrequency(raw) {
  const value = String(raw || '');
  return GUARDIA_VITALS_FREQ.has(value) ? value : 'None';
}

function resolveGuardiaId(opts, existing) {
  if (opts.guardiaId) return String(opts.guardiaId);
  if (existing?.guardia_id) return String(existing.guardia_id);
  return crypto.randomUUID();
}

function writeActiveGuardiaRow(db, { guardiaId, patientId, fields, isUpdate }) {
  const {
    coveringUserId,
    sourceTeamId,
    isCritical,
    pendientesJson,
    vitalsFrequency,
    lastVitalsCheck,
  } = fields;
  if (isUpdate) {
    db.prepare(
      `UPDATE active_guardias
       SET covering_user_id = ?,
           source_team_id = ?,
           is_critical = ?,
           pendientes_json = ?,
           vitals_frequency = ?,
           last_vitals_check = ?,
           status = 'Active'
       WHERE guardia_id = ?`
    ).run(
      coveringUserId,
      sourceTeamId,
      isCritical,
      pendientesJson,
      vitalsFrequency,
      lastVitalsCheck,
      guardiaId
    );
    return;
  }
  db.prepare(
    `INSERT INTO active_guardias (
       guardia_id, patient_id, covering_user_id, source_team_id,
       is_critical, pendientes_json, vitals_frequency, last_vitals_check, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`
  ).run(
    guardiaId,
    patientId,
    coveringUserId,
    sourceTeamId,
    isCritical,
    pendientesJson,
    vitalsFrequency,
    lastVitalsCheck
  );
}

function fetchActiveGuardiaRow(db, guardiaId) {
  return db
    .prepare(
      `SELECT guardia_id, patient_id, covering_user_id, source_team_id, is_critical,
              pendientes_json, vitals_frequency, last_vitals_check, assigned_at, status
       FROM active_guardias WHERE guardia_id = ?`
    )
    .get(guardiaId);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   patientId: string,
 *   coveringUserId: string,
 *   sourceTeamId: string,
 *   guardiaId?: string,
 *   isCritical?: number|boolean,
 *   pendientesJson?: string,
 *   vitalsFrequency?: string,
 *   lastVitalsCheck?: string,
 * }} opts
 */
export function upsertActiveGuardia(db, opts) {
  const patientId = String(opts.patientId || '');
  const coveringUserId = String(opts.coveringUserId || '');
  const sourceTeamId = String(opts.sourceTeamId || '');
  if (!patientId || !coveringUserId || !sourceTeamId) {
    throw new Error('patientId, coveringUserId, and sourceTeamId are required');
  }

  const existing = db
    .prepare(
      `SELECT guardia_id FROM active_guardias WHERE patient_id = ? AND status = 'Active' LIMIT 1`
    )
    .get(patientId);
  const guardiaId = resolveGuardiaId(opts, existing);
  const fields = {
    coveringUserId,
    sourceTeamId,
    isCritical: opts.isCritical ? 1 : 0,
    pendientesJson: opts.pendientesJson != null ? String(opts.pendientesJson) : '[]',
    vitalsFrequency: normalizeGuardiaVitalsFrequency(opts.vitalsFrequency),
    lastVitalsCheck: opts.lastVitalsCheck || new Date().toISOString(),
  };

  writeActiveGuardiaRow(db, {
    guardiaId,
    patientId,
    fields,
    isUpdate: !!(existing || opts.guardiaId),
  });
  return fetchActiveGuardiaRow(db, guardiaId);
}

export function fetchActiveGuardias(db, userId) {
  if (userId) {
    return db
      .prepare(
        `SELECT guardia_id, patient_id, covering_user_id, source_team_id, is_critical,
                pendientes_json, vitals_frequency, last_vitals_check, assigned_at, status
         FROM active_guardias
         WHERE status = 'Active' AND covering_user_id = ?`
      )
      .all(userId);
  }
  return db
    .prepare(
      `SELECT guardia_id, patient_id, covering_user_id, source_team_id, is_critical,
              pendientes_json, vitals_frequency, last_vitals_check, assigned_at, status
       FROM active_guardias
       WHERE status = 'Active'`
    )
    .all();
}

export function fetchOrphanActiveGuardias(db, userId) {
  const census = loadCensusPatientIdSet(db);
  return fetchActiveGuardias(db, userId).filter((row) => {
    const patientId = String(row?.patient_id || '').trim();
    return patientId && !census.has(patientId);
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ patientId?: string, guardiaId?: string }} opts
 */
export function resolveActiveGuardia(db, opts = {}) {
  const patientId = String(opts.patientId || '').trim();
  const guardiaId = String(opts.guardiaId || '').trim();
  const row = guardiaId
    ? db
        .prepare(
          `SELECT guardia_id, patient_id FROM active_guardias
           WHERE guardia_id = ? AND status = 'Active'`
        )
        .get(guardiaId)
    : patientId
      ? db
          .prepare(
            `SELECT guardia_id, patient_id FROM active_guardias
             WHERE patient_id = ? AND status = 'Active' LIMIT 1`
          )
          .get(patientId)
      : null;
  if (!row) return { resolved: false };

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE active_guardias SET status = 'Resolved', assigned_at = ? WHERE guardia_id = ?`
  ).run(now, row.guardia_id);
  rememberLanResolvedGuardia(db, {
    patient_id: String(row.patient_id),
    guardia_id: String(row.guardia_id),
    assigned_at: now,
  });
  return {
    resolved: true,
    guardia_id: String(row.guardia_id),
    patient_id: String(row.patient_id),
    assigned_at: now,
  };
}

export function touchActiveGuardiaVitalsCheck(db, patientId) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE active_guardias SET last_vitals_check = ? WHERE patient_id = ? AND status = 'Active'`
  ).run(now, String(patientId || ''));
}

export function completeActiveGuardiaPendiente(db, { patientId, itemId, completedBy }) {
  const pid = String(patientId || '');
  const iid = String(itemId || '');
  if (!pid || !iid) return null;

  const row = db
    .prepare(
      `SELECT guardia_id, pendientes_json FROM active_guardias
       WHERE patient_id = ? AND status = 'Active' LIMIT 1`
    )
    .get(pid);
  if (!row) return null;

  const norm = normalizePendientesJson(row.pendientes_json);
  if (!norm.items.some((it) => it.id === iid)) return null;

  const doc = completePendienteItem(row.pendientes_json, iid, completedBy);
  const item = doc.items.find((it) => it.id === iid);
  if (!item) return null;

  db.prepare(`UPDATE active_guardias SET pendientes_json = ? WHERE guardia_id = ?`).run(
    serializePendientesJson(doc),
    row.guardia_id
  );

  return item;
}
