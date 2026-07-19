import { getBlob } from './clinical-blobs.mjs';
import { getActiveRotationCycle } from './clinical-access-rotation.mjs';
/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} patientId
 */
export function ensureClinicalPatientRow(db, patientId) {
  const id = String(patientId || '').trim();
  if (!id) return;
  db.prepare(`INSERT OR IGNORE INTO patients (id) VALUES (?)`).run(id);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function fetchPatientTeamAssignments(db) {
  return db
    .prepare(
      `SELECT patient_id, team_id, effective_at, created_at
       FROM patient_team_assignment
       ORDER BY created_at`
    )
    .all();
}

/**
 * Active census team for one patient (latest effective_at <= now).
 * @param {import('better-sqlite3').Database} db
 * @param {string} patientId
 * @param {string} [nowIso]
 */
export function fetchActivePatientTeamId(db, patientId, nowIso = new Date().toISOString()) {
  const pid = String(patientId || '').trim();
  if (!pid) return null;
  const row = db
    .prepare(
      `SELECT team_id
       FROM patient_team_assignment
       WHERE patient_id = ? AND effective_at <= ?
       ORDER BY effective_at DESC, created_at DESC
       LIMIT 1`
    )
    .get(pid, String(nowIso || new Date().toISOString()));
  const teamId = row?.team_id != null ? String(row.team_id).trim() : '';
  return teamId || null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ patientId: string, teamId: string, effectiveAt: string }} opts
 */
export function assignPatientToTeam(db, { patientId, teamId, effectiveAt }) {
  ensureClinicalPatientRow(db, patientId);
  db.prepare(
    `INSERT INTO patient_team_assignment (patient_id, team_id, effective_at)
     VALUES (?, ?, ?)`
  ).run(patientId, teamId, effectiveAt);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} nowIso
 */
export function fetchIncomingAssignments(db, nowIso) {
  const cycle = getActiveRotationCycle(db);
  if (!cycle) return [];
  return db
    .prepare(
      `SELECT pta.patient_id, pta.team_id, pta.effective_at, pta.created_at,
              p.id, p.interconsult_type, p.prognosis_classification, p.negativa_maniobras_firmada
       FROM patient_team_assignment pta
       JOIN patients p ON p.id = pta.patient_id
       WHERE ? >= ? AND ? < pta.effective_at`
    )
    .all(nowIso, cycle.preview_start_at, nowIso);
}

export function loadCensusPatientIdSet(db) {
  const ids = new Set();
  try {
    const raw = getBlob(db, 'patients');
    if (!raw) return ids;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return ids;
    for (const row of list) {
      const id = String(row?.id || '').trim();
      if (id) ids.add(id);
    }
  } catch (_e) { void _e; }
  return ids;
}

/** @param {Set<string>|null|undefined} censusIds @param {import('better-sqlite3').Database} db */
function resolveCensusFilter(censusIds, db) {
  if (censusIds === null) return null;
  if (censusIds instanceof Set) return censusIds;
  return loadCensusPatientIdSet(db);
}

/** @param {object} row @param {number} nowMs @param {Set<string>|null} census */
function isActiveAssignmentRow(row, nowMs, census) {
  const patientId = String(row?.patient_id || '');
  const teamId = String(row?.team_id || '');
  if (!patientId || !teamId) return null;
  if (census && !census.has(patientId)) return null;
  const effMs = new Date(row.effective_at).getTime();
  if (!Number.isFinite(effMs) || effMs > nowMs) return null;
  const createdMs = new Date(row.created_at || row.effective_at).getTime();
  return { patientId, teamId, effMs, createdMs };
}

/** @param {{ effMs: number, createdMs: number }|undefined} prev @param {{ effMs: number, createdMs: number }} next */
function isNewerAssignment(prev, next) {
  if (!prev) return true;
  if (next.effMs > prev.effMs) return true;
  return next.effMs === prev.effMs && next.createdMs >= prev.createdMs;
}

/** @param {Map<string, { teamId: string }>} bestByPatient */
function tallyTeamCounts(bestByPatient) {
  const counts = new Map();
  for (const { teamId } of bestByPatient.values()) {
    counts.set(teamId, (counts.get(teamId) || 0) + 1);
  }
  return counts;
}

/**
 * Active patient assignments per team (latest effective_at <= now per patient).
 * Counts only patients that exist in the local census blob on this device.
 * @param {import('better-sqlite3').Database} db
 * @param {string} [nowIso]
 * @param {Set<string>} [censusIds]
 * @returns {Map<string, number>}
 */
export function buildActivePatientCountByTeam(db, nowIso = new Date().toISOString(), censusIds) {
  const nowMs = new Date(nowIso).getTime();
  const census = resolveCensusFilter(censusIds, db);
  const bestByPatient = new Map();
  for (const row of fetchPatientTeamAssignments(db)) {
    const active = isActiveAssignmentRow(row, nowMs, census);
    if (!active) continue;
    const prev = bestByPatient.get(active.patientId);
    if (isNewerAssignment(prev, active)) {
      bestByPatient.set(active.patientId, active);
    }
  }
  return tallyTeamCounts(bestByPatient);
}

/**
 * LAN assignment rows per team (includes stubs without a local census chart).
 * @param {import('better-sqlite3').Database} db
 * @param {string} [nowIso]
 * @returns {Map<string, number>}
 */
export function buildLanAssignmentCountByTeam(db, nowIso = new Date().toISOString()) {
  return buildActivePatientCountByTeam(db, nowIso, /** @type {null} */ (null));
}
