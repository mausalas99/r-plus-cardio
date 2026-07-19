import { salaOnCallR1, resolvePatientSala } from '../../public/js/clinico-access.mjs';
import { normalizePendientesJson } from '../entrega/entrega-pendientes.mjs';

/**
 * R1 de guardia on-call for a sala (cycle + team_guardia_today overrides).
 * @param {object} scopeContext
 * @param {string} sala
 * @param {Date|string} [now]
 */
export function resolveSalaR1GuardiaUserIds(scopeContext, sala, now = new Date()) {
  const teams = scopeContext?.teams || [];
  const salaGuardiaToday = scopeContext?.salaGuardiaToday || [];
  const onCall = salaOnCallR1(teams, sala, now, salaGuardiaToday);
  return [...new Set(onCall.map((row) => String(row.user_id)).filter(Boolean))];
}

/**
 * Entrega assigns covering_user_id explicitly; host rotation snapshot can lag.
 * Accept on-call R1 or any R1 member in a team for this sala.
 * @param {string} coveringUserId
 * @param {object} scopeContext
 * @param {string} sala
 */
export function isGuardiaCoveringEligibleForInterno(coveringUserId, scopeContext, sala) {
  const uid = String(coveringUserId || '').trim();
  if (!uid) return false;
  const onCall = resolveSalaR1GuardiaUserIds(scopeContext, sala);
  if (onCall.includes(uid)) return true;
  for (const team of scopeContext?.teams || []) {
    if (String(team?.sala || '').trim() !== sala) continue;
    const member = (team.members || []).find((m) => String(m?.user_id) === uid);
    if (member && String(member.rank || '').toUpperCase() === 'R1') return true;
  }
  return false;
}

/** @param {object|null|undefined} guardia */
function patientCensusFromGuardia(guardia) {
  const doc = normalizePendientesJson(guardia?.pendientes_json);
  const census = doc?.patientCensus;
  if (!census || typeof census !== 'object') return null;
  return census;
}

/** @param {object} patient @param {object} census */
function applyCensusName(patient, census) {
  const nombre = String(census.nombre || '').trim();
  if (!nombre) return;
  const current = String(patient.nombre || patient.name || '').trim();
  if (!current || patient.nombre === 'Paciente') {
    patient.nombre = nombre;
    patient.name = nombre;
  }
}

/** @param {object} patient @param {object} census */
function applyCensusBedFields(patient, census) {
  const cuarto = String(census.cuarto || '').trim();
  const cama = String(census.cama || '').trim();
  const sala = String(census.sala || '').trim();
  if (cuarto && !String(patient.cuarto || '').trim()) patient.cuarto = cuarto;
  if (cama && !String(patient.cama || '').trim()) patient.cama = cama;
  if (sala && !String(patient.sala || '').trim()) patient.sala = sala;
}

/** @param {object} patient @param {object|null|undefined} census */
function applyPatientCensusFields(patient, census) {
  if (!patient || !census) return;
  applyCensusName(patient, census);
  applyCensusBedFields(patient, census);
}

/** @param {object|null|undefined} stored @param {object|null|undefined} census */
function resolveInternoPatientName(stored, census) {
  return (
    String(census?.nombre || stored?.nombre || stored?.name || 'Paciente').trim() || 'Paciente'
  );
}

/** @param {object|null|undefined} stored @param {object|null|undefined} team */
function resolveInternoPatientService(stored, team) {
  return stored?.servicio || stored?.service || team?.service || 'Sala';
}

/** @param {object|null|undefined} stored @param {object|null|undefined} team */
function resolveInternoPatientArea(stored, team) {
  return stored?.area || stored?.sub_area || team?.sub_area_fraction || '';
}

/** @param {object|null|undefined} census @param {object|null|undefined} stored @param {object|null|undefined} team */
function resolveInternoPatientSalaField(census, stored, team) {
  return String(census?.sala || stored?.sala || team?.sala || '').trim();
}

/** @param {object|null|undefined} stored @param {object|null|undefined} team @param {string} area */
function resolveInternoPatientSubArea(stored, team, area) {
  return stored?.sub_area || stored?.area || team?.sub_area_fraction || area;
}

/** @param {object|null|undefined} census @param {object|null|undefined} stored */
function resolveInternoPatientBedFields(census, stored) {
  return {
    cuarto: census?.cuarto || stored?.cuarto || '',
    cama: census?.cama || stored?.cama || '',
    bed_label: stored?.bed_label || '',
  };
}

/** @param {object} guardia @param {object|null|undefined} stored @param {object|null|undefined} team @param {object|null|undefined} census */
function buildInternoStubRow(guardia, stored, team, census) {
  const name = resolveInternoPatientName(stored, census);
  const service = resolveInternoPatientService(stored, team);
  const area = resolveInternoPatientArea(stored, team);
  const beds = resolveInternoPatientBedFields(census, stored);
  return {
    id: String(guardia.patient_id),
    nombre: name,
    name,
    servicio: service,
    service,
    area,
    sub_area: resolveInternoPatientSubArea(stored, team, area),
    sala: resolveInternoPatientSalaField(census, stored, team),
    ...beds,
  };
}

/** @param {object} guardia @param {object|null|undefined} stored @param {Map<string, object>} teamById */
function buildInternoPatientStub(guardia, stored, teamById) {
  const team = teamById.get(String(guardia?.source_team_id || ''));
  const census = patientCensusFromGuardia(guardia);
  const row = buildInternoStubRow(guardia, stored, team, census);
  applyPatientCensusFields(row, census);
  return row;
}

/** @param {object} patient @param {object} guardia */
function enrichInternoPatientRow(patient, guardia) {
  applyPatientCensusFields(patient, patientCensusFromGuardia(guardia));
  return patient;
}

/**
 * Resolve sala for interno scope: patient fields first, then entrega source team.
 * @param {object|null|undefined} patient
 * @param {object} guardia
 * @param {Map<string, object>} teamById
 */
function resolveInternoPatientSala(patient, guardia, teamById) {
  const censusSala = String(patientCensusFromGuardia(guardia)?.sala || '').trim();
  if (censusSala) return censusSala;
  const fromPatient = patient ? resolvePatientSala(patient) : '';
  if (fromPatient) return fromPatient;
  const team = teamById.get(String(guardia?.source_team_id || ''));
  return String(team?.sala || '').trim();
}

/** @param {object[]} storePatients @param {object} scopeContext */
function buildInternoScopeMaps(storePatients, scopeContext) {
  const storeById = new Map();
  for (const p of storePatients || []) {
    if (p?.id) storeById.set(String(p.id), p);
  }
  const teamById = new Map();
  for (const t of scopeContext?.teams || []) {
    if (t?.team_id) teamById.set(String(t.team_id), t);
  }
  return { storeById, teamById };
}

/**
 * @param {object} guardia
 * @param {string} salaNorm
 * @param {object} scopeContext
 * @param {Set<string>|undefined} censusIds
 */
function guardiaEligibleForInternoBoard(guardia, salaNorm, scopeContext, censusIds) {
  if (String(guardia.status || 'Active') !== 'Active') return false;
  const pid = String(guardia.patient_id || '');
  if (!pid) return false;
  if (censusIds && censusIds.size > 0 && !censusIds.has(pid)) return false;
  return isGuardiaCoveringEligibleForInterno(guardia.covering_user_id, scopeContext, salaNorm);
}

/**
 * @param {object} guardia
 * @param {Map<string, object>} storeById
 * @param {Map<string, object>} teamById
 * @param {string} salaNorm
 */
function resolveInternoBoardPatientRow(guardia, storeById, teamById, salaNorm) {
  const pid = String(guardia.patient_id || '');
  const stored = storeById.get(pid);
  const patientSala = resolveInternoPatientSala(stored, guardia, teamById);
  if (patientSala !== salaNorm) return null;
  if (stored) return enrichInternoPatientRow(stored, guardia);
  return buildInternoPatientStub(guardia, stored, teamById);
}

/**
 * Patients for interno board: guardia rows are authoritative; host store may lag.
 * @param {object[]} storePatients
 * @param {object[]} activeGuardias
 * @param {string} sala
 * @param {object} scopeContext
 * @param {{ censusPatientIds?: Set<string> }} [options]
 */
export function resolveInternoBoardPatients(
  storePatients,
  activeGuardias,
  sala,
  scopeContext,
  options = {}
) {
  const censusIds = options.censusPatientIds;
  const salaNorm = String(sala || '').trim();
  const { storeById, teamById } = buildInternoScopeMaps(storePatients, scopeContext);
  const out = new Map();

  for (const guardia of activeGuardias || []) {
    if (!guardiaEligibleForInternoBoard(guardia, salaNorm, scopeContext, censusIds)) continue;
    const row = resolveInternoBoardPatientRow(guardia, storeById, teamById, salaNorm);
    if (!row) continue;
    out.set(String(guardia.patient_id), row);
  }

  return [...out.values()];
}

/**
 * Legacy store-first filter (host bundle patients only).
 * @param {object[]} patients
 * @param {object[]} activeGuardias
 * @param {string} sala
 * @param {string[]} r1GuardiaUserIds
 */
export function filterInternoScopePatients(patients, activeGuardias, sala, r1GuardiaUserIds) {
  const guardiaByPatient = new Map();
  for (const g of activeGuardias || []) {
    if (String(g.status || 'Active') !== 'Active') continue;
    guardiaByPatient.set(String(g.patient_id), g);
  }

  const r1Set = new Set((r1GuardiaUserIds || []).map(String));
  const useR1Filter = r1Set.size > 0;

  return (patients || []).filter((p) => {
    if (!p?.id) return false;
    const ps = resolvePatientSala(p);
    if (ps !== sala) return false;
    const g = guardiaByPatient.get(String(p.id));
    if (!g) return false;
    if (useR1Filter && !r1Set.has(String(g.covering_user_id || ''))) return false;
    return true;
  });
}
