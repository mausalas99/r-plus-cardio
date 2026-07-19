import { normalizeServiceKey } from './clinico-access-shared.mjs';
import { getCycleConfig, isOnCallToday } from './clinico-access-cycle.mjs';
import {
  extractSalaLetter,
  salaLetterForTeamOrArea,
  userOnCallForInterconsultasTeam,
} from './clinico-access-patient.mjs';
import {
  getJoinedTeams,
  isMemberOnCallToday,
} from './clinico-access-teams.mjs';

/** R4 Guardia census section order (ward macro-sectors). */
export const R4_GUARDIA_SECTOR_ORDER = ['Sala A', 'Sala B', 'Eme', 'Torre HU'];

/**
 * Map a census row to an R4 Guardia sector label (Sala A/B, Eme, Torre HU).
 * Accepts chart rows (`servicio`/`area`) or grid rows (`service`/`sub_area`).
 * @param {{ service?: string, servicio?: string, sub_area?: string, area?: string }|null|undefined} patient
 */
function resolveR4SalaSectorLabel(svcKey, subKey, service, subArea, hay) {
  if (!svcKey.includes('sala') && !subKey.includes('sala')) return '';
  const letter = salaLetterForTeamOrArea({ service, sub_area: subArea, name: hay });
  if (letter === 'A') return 'Sala A';
  if (letter === 'B') return 'Sala B';
  if (/sala\s*a\b/i.test(hay)) return 'Sala A';
  if (/sala\s*b\b/i.test(hay)) return 'Sala B';
  return '';
}

export function resolveR4GuardiaSectorLabel(patient) {
  if (!patient) return '';
  const service = String(patient.service || patient.servicio || '').trim();
  const subArea = String(patient.sub_area || patient.area || '').trim();
  const hay = `${service} ${subArea}`.trim();
  const svcKey = normalizeServiceKey(service);
  const subKey = normalizeServiceKey(subArea);

  for (const sector of R4_GUARDIA_SECTOR_ORDER) {
    if (service === sector || subArea === sector) return sector;
  }

  if (svcKey.includes('torre hu') || subKey.includes('torre hu')) return 'Torre HU';
  if (svcKey.includes('eme') || subKey.includes('eme') || svcKey === 'urgencias') return 'Eme';

  return resolveR4SalaSectorLabel(svcKey, subKey, service, subArea, hay);
}

/**
 * @param {{ id?: string, service?: string, sub_area?: string, interconsult_type?: string }|null|undefined} patient
 */
export function isR4MacroPatient(patient) {
  if (!patient) return false;
  const svc = normalizeServiceKey(patient.service);
  const sub = normalizeServiceKey(patient.sub_area);
  if (svc.includes('sala') || sub.includes('sala')) return true;
  if (svc.includes('interconsult') || sub.includes('interconsult')) return true;
  const ic = String(patient.interconsult_type || 'None');
  return ic !== 'None';
}

/**
 * @param {Array<{ team_id?: string, user_id?: string }>} salaGuardiaToday
 * @param {object[]} teams
 * @param {string} salaLetter
 */
export function hasSalaGuardiaDeclaredForLetter(salaGuardiaToday, teams, salaLetter) {
  const letter = String(salaLetter || '').toUpperCase();
  if (!letter) return false;
  const salaTeams = (teams || []).filter(
    (t) => normalizeServiceKey(t.service).includes('sala') && salaLetterForTeamOrArea(t) === letter
  );
  if (!salaTeams.length) return false;
  const declared = new Set(
    (salaGuardiaToday || []).map((row) => String(row.team_id || ''))
  );
  return salaTeams.some((t) => declared.has(String(t.team_id || '')));
}

/**
 * @param {Array<{ team_id?: string, user_id?: string }>} salaGuardiaToday
 * @param {object[]} teams
 * @param {string} userId
 * @param {Date|string|number} now
 */
export function computeSalaAbcdefDeficitWrite(salaGuardiaToday, teams, userId, now) {
  const uid = String(userId || '');
  if (!uid) return false;
  const d = now instanceof Date ? now : new Date(String(now));
  const r2Cfg = getCycleConfig('Sala', 'R2');
  const hasDeficitLetter = r2Cfg.letters.some(
    (letter) => !hasSalaGuardiaDeclaredForLetter(salaGuardiaToday, teams, letter)
  );
  if (!hasDeficitLetter) return false;
  return (teams || []).some((team) => {
    if (!normalizeServiceKey(team.service).includes('sala')) return false;
    if (!isOnCallToday(team, 'R2', d)) return false;
    if (!(team.members || []).some((m) => String(m.user_id) === uid)) return false;
    return (salaGuardiaToday || []).some(
      (g) => String(g.team_id) === String(team.team_id) && String(g.user_id) === uid
    );
  });
}

/**
 * Returns the R1(s) on call for a given Sala today.
 * Manual `team_guardia_today` / `guardia_today` overrides cycle for that team.
 * @param {object[]} teams — all teams (each with sala, sub_area_fraction, members)
 * @param {string} sala — clinical sala label (Sala 1/2/E, Torre HU, Área A/Pensionistas)
 * @param {Date|string} now
 * @param {Array<{ team_id?: string, user_id?: string }>} [salaGuardiaToday]
 * @returns {{ team_id: string, user_id: string }[]} — on-call R1s
 */
function collectSalaOnCallR1ForTeam(team, d, salaGuardiaToday) {
  const teamId = String(team.team_id || '');
  if (!teamId) return [];
  const declared =
    (salaGuardiaToday || []).find((g) => String(g.team_id) === teamId)?.user_id ||
    team?.guardia_today?.user_id ||
    '';
  if (declared) return [{ team_id: teamId, user_id: String(declared) }];
  const result = [];
  for (const m of team.members || []) {
    if (m.rank !== 'R1' || !m.user_id) continue;
    if (!isMemberOnCallToday(m, team, 'R1', d)) continue;
    result.push({ team_id: teamId, user_id: String(m.user_id) });
  }
  return result;
}

export function salaOnCallR1(teams, sala, now, salaGuardiaToday = []) {
  const d = now instanceof Date ? now : new Date(String(now));
  const result = [];
  for (const team of (teams || []).filter((t) => t.sala === sala)) {
    result.push(...collectSalaOnCallR1ForTeam(team, d, salaGuardiaToday));
  }
  return result;
}

/**
 * True when the user is on call today as a guardia receiver (R1 de guardia or R2 de guardia).
 * @param {string} userId
 * @param {string} rank
 * @param {object[]} teams
 * @param {Date|string|number} now
 * @param {Array<{ team_id?: string, user_id?: string }>} [salaGuardiaToday]
 */
export function userIsOnGuardiaCallToday(userId, rank, teams, now, salaGuardiaToday = []) {
  const uid = String(userId || '');
  if (!uid) return false;
  const d = now instanceof Date ? now : new Date(String(now));
  const r = String(rank || '');
  if (r === 'R2') {
    return (teams || []).some((team) => {
      if (!isOnCallToday(team, 'R2', d)) return false;
      return (team.members || []).some(
        (m) => m.rank === 'R2' && String(m.user_id || '') === uid
      );
    });
  }
  if (r === 'R1') {
    const joined = getJoinedTeams(teams, uid);
    const salas = new Set(
      joined.map((t) => String(t.sala || '').trim()).filter(Boolean)
    );
    for (const sala of salas) {
      const onCall = salaOnCallR1(teams, sala, d, salaGuardiaToday);
      if (onCall.some((row) => String(row.user_id || '') === uid)) return true;
    }
  }
  return false;
}

/**
 * True when the user is on call today (guardia declarada, ciclo de rotación o interconsultas).
 * Used for LAN host eligibility — on-call residents may host their subnet session.
 * @param {string} userId
 * @param {string} rank
 * @param {object[]} teams
 * @param {Date|string|number} [now]
 * @param {Array<{ team_id?: string, user_id?: string }>} [salaGuardiaToday]
 */
export function userIsOnCallForLanHost(userId, rank, teams, now = new Date(), salaGuardiaToday = []) {
  const uid = String(userId || '');
  if (!uid) return false;
  const d = now instanceof Date ? now : new Date(String(now));
  const r = String(rank || '').trim();
  if (userIsOnGuardiaCallToday(uid, r, teams, d, salaGuardiaToday)) return true;
  const joined = getJoinedTeams(teams, uid);
  if (userOnCallForInterconsultasTeam(uid, joined, r, d)) return true;
  return joined.some((team) => {
    const member = (team.members || []).find(
      (m) => String(m.user_id || '') === uid && String(m.rank || '').trim() === r
    );
    if (!member) return false;
    return isMemberOnCallToday(member, team, r, d);
  });
}

/**
 * Returns the R2(s) on call across all Salas today.
 * @param {object[]} teams
 * @param {Date|string} now
 * @returns {{ team_id: string, user_id: string }[]}
 */
export function salaOnCallR2(teams, now) {
  const d = now instanceof Date ? now : new Date(String(now));
  const r2Teams = (teams || []).filter((t) => isOnCallToday(t, 'R2', d));
  return r2Teams.flatMap((t) =>
    (t.members || [])
      .filter((m) => m.rank === 'R2')
      .map((m) => ({ team_id: t.team_id, user_id: m.user_id }))
  );
}

/**
 * Returns the actual on-call user for a team, respecting guardia overrides.
 * @param {object} team — with guardia_today field { user_id: string }
 * @returns {string|null} — user_id of the declared guardia, or null
 */
export function teamGuardiaOverride(team) {
  return team?.guardia_today?.user_id || null;
}

export function canR2SalaAbcdefDeficitWrite(userId, patient, joinedTeams, salaGuardiaToday, teams, now) {
  if (!normalizeServiceKey(patient?.service).includes('sala') && !extractSalaLetter(patient?.service || '')) {
    return false;
  }
  const patientLetter = salaLetterForTeamOrArea(patient);
  if (!patientLetter) return false;
  if (hasSalaGuardiaDeclaredForLetter(salaGuardiaToday, teams, patientLetter)) return false;

  const uid = String(userId || '');
  return joinedTeams.some((team) => {
    if (!normalizeServiceKey(team.service).includes('sala')) return false;
    if (!isOnCallToday(team, 'R2', now)) return false;
    const declared = (salaGuardiaToday || []).find(
      (g) => String(g.team_id) === String(team.team_id) && String(g.user_id) === uid
    );
    return !!declared;
  });
}
