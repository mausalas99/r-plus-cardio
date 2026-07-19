import { normalizeServiceKey, toMillis } from './clinico-access-shared.mjs';
import { normalizeUsername } from './clinical-username.mjs';
import {
  getCycleLettersForTeamCreate,
  isOnCallToday,
  isSalaWardService,
} from './clinico-access-cycle.mjs';
import { extractSalaLetter, salaLetterForTeamOrArea } from './clinico-access-patient.mjs';

const R3_EXTENDED_SERVICES = new Set(['torre hu', 'eme', 'ux']);

/**
 * @param {{ id?: string, service?: string, sub_area?: string }|null|undefined} patient
 * @param {{ service?: string, sub_area_fraction?: string, name?: string }} team
 */
function patientServiceMatchesTeam(patientSvc, teamSvc, patient) {
  if (patientSvc === teamSvc) return true;
  if (patientSvc.includes('sala') && teamSvc.includes('sala')) return true;
  if (teamSvc.includes('sala') && (patientSvc.includes('sala') || extractSalaLetter(patient.service))) {
    return true;
  }
  return false;
}

export function patientMatchesTeam(patient, team) {
  if (!patient || !team) return false;
  const patientSvc = normalizeServiceKey(patient.service);
  const teamSvc = normalizeServiceKey(team.service);
  if (!patientServiceMatchesTeam(patientSvc, teamSvc, patient)) return false;
  const frac = String(team.sub_area_fraction || '').trim();
  if (!frac) return true;
  const letter = frac.toUpperCase();
  const patientLetter = salaLetterForTeamOrArea(patient);
  if (patientLetter && patientLetter === letter) return true;
  const hay = `${patient.service || ''} ${patient.sub_area || ''}`;
  if (new RegExp('(?:^|\\s)' + letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'i').test(hay)) return true;
  return false;
}

/** @param {object[]} teams @param {string|object} userOrUserId @param {string} [usernameHint] */
export function getJoinedTeamsForUser(teams, userOrUserId, usernameHint) {
  let uid = '';
  let handle = '';
  if (userOrUserId && typeof userOrUserId === 'object') {
    uid = String(userOrUserId.user_id || '');
    handle = normalizeUsername(String(userOrUserId.username || ''));
  } else {
    uid = String(userOrUserId || '');
    handle = normalizeUsername(usernameHint || '');
  }
  if (!uid && !handle) return [];
  return (teams || []).filter((team) =>
    (team.members || []).some((m) => {
      if (uid && String(m.user_id) === uid) return true;
      if (handle && normalizeUsername(m.username || '') === handle) return true;
      return false;
    })
  );
}

/** @param {object[]} teams @param {string} userId */
export function getJoinedTeams(teams, userId) {
  return getJoinedTeamsForUser(teams, userId);
}

/** @param {object[]} teams @param {string} userId */
export function userHasJoinedClinicalTeams(teams, userId) {
  return getJoinedTeams(teams, userId).length > 0;
}

/**
 * @param {string} patientId
 * @param {object[]} assignments
 */
export function patientHasExplicitTeamAssignment(patientId, assignments) {
  const pid = String(patientId || '');
  return (assignments || []).some((a) => String(a.patient_id) === pid);
}

/**
 * Active team for a patient (latest assignment with effective_at <= now).
 * @param {string} patientId
 * @param {object[]} assignments
 * @param {Date|string|number} [now]
 */
export function resolvePatientTeamIdFromAssignments(patientId, assignments, now) {
  const pid = String(patientId || '');
  const nowMs = toMillis(now != null ? now : new Date());
  let best = null;
  let bestMs = -Infinity;
  let bestCreatedMs = -Infinity;
  for (const row of assignments || []) {
    if (String(row?.patient_id || '') !== pid) continue;
    const effMs = toMillis(row.effective_at);
    if (!Number.isFinite(effMs) || effMs > nowMs) continue;
    const createdMs = toMillis(row.created_at, row.effective_at);
    if (effMs > bestMs || (effMs === bestMs && createdMs >= bestCreatedMs)) {
      bestMs = effMs;
      bestCreatedMs = createdMs;
      best = String(row.team_id || '');
    }
  }
  return best || '';
}

/**
 * Checks if a patient is assigned to any of the user's teams (effective now).
 * @param {string} patientId
 * @param {object[]} assignments — from patient_team_assignment
 * @param {Set<string>} joinedTeamIds
 * @param {Date|string|number} [now]
 */
export function patientAssignedToTeam(patientId, assignments, joinedTeamIds, now) {
  const teamId = resolvePatientTeamIdFromAssignments(patientId, assignments, now);
  return !!(teamId && joinedTeamIds.has(teamId));
}

/**
 * Team scope for census/LAN: explicit assignment wins; structural match only when unassigned.
 * @param {object} patient
 * @param {object[]} joinedTeams
 * @param {object[]} assignments
 * @param {Set<string>} joinedTeamIds
 * @param {string} [userId]
 * @param {Date|string|number} [now]
 */
export function patientInJoinedTeamScope(
  patient,
  joinedTeams,
  assignments,
  joinedTeamIds,
  userId,
  now,
  opts
) {
  const patientId = String(patient?.id || '');
  const strictTeamFilter = opts?.strictTeamFilter === true;
  if (patientAssignedToTeam(patientId, assignments, joinedTeamIds, now)) return true;
  if (strictTeamFilter || patientHasExplicitTeamAssignment(patientId, assignments)) return false;
  return patientMatchesAnyJoinedTeam(patient, joinedTeams, userId);
}

/**
 * Checks if the patient was handed off to this user via active_guardias.
 * @param {string} patientId
 * @param {string} userId
 * @param {object[]} guardias
 */
export function patientCoveredByGuardia(patientId, userId, guardias) {
  const uid = String(userId || '');
  return (guardias || []).some(
    (g) => String(g.patient_id) === String(patientId) && String(g.covering_user_id) === uid
  );
}

/** @param {string} userId @param {{ covering_user_id?: string }}|null|undefined activeGuardia */
export function isActiveGuardiaCoveringUser(userId, activeGuardia) {
  if (!activeGuardia || !userId) return false;
  return String(activeGuardia.covering_user_id || '') === String(userId);
}

/**
 * Team row scoped to one member's cycle letter (membership sub_area_fraction).
 *
 * @param {object} team
 * @param {string} [userId]
 */
export function teamForMemberCycle(team, userId) {
  if (!team || !userId) return team;
  const member = (team.members || []).find((m) => String(m.user_id) === String(userId));
  const frac = String(member?.sub_area_fraction || '').trim();
  if (!frac) {
    if (String(member?.rank || '') === 'R2') {
      const teamFrac = String(team.sub_area_fraction || '').trim();
      if (teamFrac) return { ...team, sub_area_fraction: teamFrac };
    }
    return team;
  }
  return { ...team, sub_area_fraction: frac };
}

/**
 * R1 Sala: each member carries sub_area_fraction (A1–D2); R2/other ranks use team letter.
 *
 * @param {object} member
 * @param {object} team
 * @param {string} rank
 * @param {Date|string|number} now
 */
export function isMemberOnCallToday(member, team, rank, now) {
  if (!member || !team) return false;
  const r = String(rank || member.rank || '').trim();
  if (!r) return false;
  const uid = String(member.user_id || '');
  const scoped =
    isSalaWardService(team.service) && r === 'R1' && uid
      ? teamForMemberCycle(team, uid)
      : team;
  return isOnCallToday(scoped, r, now);
}

/** True when any member at rank is on cycle today (R1 Sala checks per-member subcycles). */
export function isTeamRankOnCallToday(team, rank, now) {
  if (!team) return false;
  const r = String(rank || '').trim();
  if (isSalaWardService(team.service) && r === 'R1') {
    return (team.members || []).some(
      (m) => String(m.rank) === 'R1' && isMemberOnCallToday(m, team, 'R1', now)
    );
  }
  return isOnCallToday(team, r, now);
}

/**
 * Default cycle letter when joining/creating membership without explicit pick.
 *
 * @param {{ service?: string, members?: object[], sub_area_fraction?: string }} team
 * @param {string} userRank
 */
export function inferMembershipCycleForJoin(team, userRank) {
  const rank = String(userRank || 'R1');
  if (!isSalaWardService(team?.service)) {
    const letters = getCycleLettersForTeamCreate(team?.service, rank);
    return letters[0] || 'A';
  }
  if (rank === 'R2') {
    return getCycleLettersForTeamCreate('Sala', 'R2')[0] || 'A';
  }
  const used = new Set(
    (team?.members || [])
      .filter((m) => String(m?.rank) === 'R1')
      .map((m) => String(m?.sub_area_fraction || '').trim())
      .filter(Boolean)
  );
  for (const letter of getCycleLettersForTeamCreate('Sala', 'R1', 0)) {
    if (!used.has(letter)) return letter;
  }
  for (const letter of getCycleLettersForTeamCreate('Sala', 'R1', 1)) {
    if (!used.has(letter)) return letter;
  }
  return 'A1';
}

/**
 * Prefer a member's saved subcycle; otherwise suggest the next free slot.
 *
 * @param {{ service?: string, members?: object[], sub_area_fraction?: string }|null|undefined} team
 * @param {string} userId
 * @param {string} userRank
 */
export function resolveMembershipCycleForUser(team, userId, userRank) {
  const uid = String(userId || '').trim();
  if (uid && team) {
    const member = (team.members || []).find((m) => String(m.user_id || '') === uid);
    const existing = String(member?.sub_area_fraction || '').trim();
    if (existing) return existing;
  }
  return inferMembershipCycleForJoin(team || {}, userRank);
}

export function formatMemberCycleLabel(member) {
  const frac = String(member?.sub_area_fraction || '').trim();
  if (!frac) return '';
  const rank = String(member?.rank || '');
  if (rank === 'R2' || /^[A-F]$/i.test(frac)) return `Ciclo R2 · ${frac}`;
  if (rank === 'R1' || /[12]$/i.test(frac)) return `Subciclo R1 · ${frac}`;
  return `Ciclo · ${frac}`;
}

/** @param {object} patient @param {object[]} joinedTeams @param {string} [userId] */
export function patientMatchesAnyJoinedTeam(patient, joinedTeams, userId) {
  const mapped = {
    id: patient?.id,
    service: String(patient?.service || patient?.servicio || ''),
    sub_area: String(patient?.sub_area || patient?.area || ''),
    interconsult_type: patient?.interconsult_type,
    sala: patient?.sala,
  };
  return (joinedTeams || []).some((team) => {
    const scoped = userId ? teamForMemberCycle(team, userId) : team;
    return patientMatchesTeam(mapped, scoped);
  });
}

/** @param {object} user @param {object} patient @param {object[]} joinedTeams */
export function r3ExtendedStructuralAccess(user, patient, joinedTeams) {
  const uid = String(user?.user_id || '');
  return (joinedTeams || []).some((team) => {
    const svc = normalizeServiceKey(team?.service);
    const isExtended = [...R3_EXTENDED_SERVICES].some((s) => svc.includes(s));
    if (!isExtended) return false;
    if (!(team.members || []).some((m) => String(m.user_id) === uid)) return false;
    return patientMatchesTeam(
      {
        id: patient?.id,
        service: String(patient?.service || patient?.servicio || ''),
        sub_area: String(patient?.sub_area || patient?.area || ''),
      },
      team
    );
  });
}
