import { OFF_CALL_INTERCONSULTAS_SERVICES } from '../../lib/clinical-team-composition.mjs';
import { normalizeServiceKey } from './clinico-access-shared.mjs';
import { isOnCallToday } from './clinico-access-cycle.mjs';

/** @param {string} serviceOrArea */
export function extractSalaLetter(serviceOrArea) {
  const raw = String(serviceOrArea || '').trim();
  const match = raw.match(/Sala\s*([A-F])/i);
  if (match) return match[1].toUpperCase();
  const lone = raw.match(/^([A-F])$/i);
  return lone ? lone[1].toUpperCase() : '';
}

/** @param {{ service?: string, sub_area?: string, sub_area_fraction?: string, name?: string }} teamOrPatient */
export function salaLetterForTeamOrArea(teamOrPatient) {
  const frac = String(teamOrPatient?.sub_area_fraction || '').trim();
  const bare = frac.replace(/[0-9]+$/, '').toUpperCase();
  if (bare && /^[A-F]$/.test(bare)) return bare;
  const fromName = extractSalaLetter(teamOrPatient?.name || '');
  if (fromName) return fromName;
  return extractSalaLetter(teamOrPatient?.sub_area || teamOrPatient?.service || '');
}

/** @param {{ sala?: string, servicio?: string, service?: string, area?: string, sub_area?: string }} patient */
function salaLabelFromLetter(letter) {
  if (letter === '1') return 'Sala 1';
  if (letter === '2') return 'Sala 2';
  if (letter === 'E') return 'Sala E';
  return '';
}

function salaLabelFromServiceKey(svc) {
  if (svc.includes('torre hu')) return 'Torre HU';
  if (svc.includes('area a') || svc.includes('pension')) return 'Área A/Pensionistas';
  return '';
}

function inferPatientSala(patient) {
  const source = patient?.servicio || patient?.service || patient?.area || patient?.sub_area || '';
  const fromLetter = salaLabelFromLetter(extractSalaLetter(source));
  if (fromLetter) return fromLetter;
  return salaLabelFromServiceKey(normalizeServiceKey(patient?.servicio || patient?.service || ''));
}

export function resolvePatientSala(patient) {
  const explicit = String(patient?.sala || '').trim();
  return explicit || inferPatientSala(patient);
}

/** @param {object} patient @param {string} userSala */
export function patientInUserSala(patient, userSala) {
  const ps = resolvePatientSala(patient);
  return ps !== '' && ps === String(userSala || '').trim();
}

export function isInterconsultasPatient(patient) {
  if (!patient) return false;
  const svc = normalizeServiceKey(patient.service || patient.servicio || '');
  const sub = normalizeServiceKey(patient.sub_area || patient.area || '');
  if (svc.includes('interconsult') || sub.includes('interconsult')) return true;
  const ic = String(patient.interconsult_type || 'None');
  return ic !== 'None' && ic !== '';
}

export function userOffCallFromInterconsultasRotationServices(userId, joinedTeams, rank, now) {
  const uid = String(userId || '');
  return (joinedTeams || []).some((team) => {
    const svc = normalizeServiceKey(team?.service);
    if (!OFF_CALL_INTERCONSULTAS_SERVICES.has(svc)) return false;
    if (!(team.members || []).some((m) => String(m.user_id) === uid)) return false;
    return !isOnCallToday(team, rank, now);
  });
}

export function userOnCallForInterconsultasTeam(userId, joinedTeams, rank, now) {
  const uid = String(userId || '');
  return (joinedTeams || []).some((team) => {
    const svc = normalizeServiceKey(team?.service);
    if (!svc.includes('interconsult')) return false;
    if (!(team.members || []).some((m) => String(m.user_id) === uid)) return false;
    return isOnCallToday(team, rank, now);
  });
}

/** @param {object[]|null|undefined} teams @param {string} teamId */
function findClinicalTeamById(teams, teamId) {
  const id = String(teamId || '').trim();
  if (!id) return null;
  return (teams || []).find((t) => String(t?.team_id || '') === id) || null;
}

/**
 * Tag a new chart row with clinical sala for census/LAN scope.
 * Team sala wins over creator profile sala (e.g. off-call UX assigning Interconsultas).
 * @param {Record<string, unknown>} patient
 * @param {{ sala?: string|null|undefined }|null|undefined} user
 * @param {{ team?: object|null, teamId?: string, teams?: object[] }|null|undefined} [opts]
 */
export function stampPatientClinicalSala(patient, user, opts) {
  if (!patient || typeof patient !== 'object') return patient;
  const team =
    opts?.team ||
    findClinicalTeamById(opts?.teams, opts?.teamId) ||
    null;
  const teamSala = String(team?.sala || '').trim();
  if (teamSala) {
    patient.sala = teamSala;
    return patient;
  }
  const profileSala = String(user?.sala || '').trim();
  if (profileSala) {
    patient.sala = profileSala;
    return patient;
  }
  const inferred = resolvePatientSala(patient);
  if (inferred) patient.sala = inferred;
  return patient;
}

/**
 * Backfill explicit sala on legacy charts (idempotent).
 * @param {object[]|null|undefined} patients
 * @param {{ sala?: string|null|undefined }|null|undefined} user
 * @returns {number}
 */
export function migratePatientsClinicalSala(patients, user) {
  if (!Array.isArray(patients) || !user) return 0;
  let migrated = 0;
  for (const patient of patients) {
    if (!patient || typeof patient !== 'object' || patient.isDemo) continue;
    if (String(patient.sala || '').trim()) continue;
    stampPatientClinicalSala(patient, user);
    if (String(patient.sala || '').trim()) migrated += 1;
  }
  return migrated;
}
