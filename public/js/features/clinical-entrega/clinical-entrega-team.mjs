// Census / source team resolution for entrega
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { getJoinedTeams } from '../../clinico-access.mjs';
import { hasElevatedTeamPrivileges } from '../../clinical-privileges.mjs';
import { teamLabelById } from '../../patient-team-assign-ui.mjs';
import {
  patientForScopeEvaluate,
  resolvePatientCensusTeamId,
  tagPatientsForTeamFilter,
} from '../patients-clinical-filter.mjs';
import { clinicalDbApi } from './clinical-entrega-util.mjs';

export async function lookupEntregaCensusTeamId(patientId, patientRow, teams, assignments, now) {
  let row = patientRow;
  if (row) {
    tagPatientsForTeamFilter([row], {
      teams,
      assignments,
      now: typeof now === 'string' ? now : now.toISOString(),
    });
  }
  const fromScope = resolveEntregaCensusTeamId(patientId, row, teams, assignments, now);
  if (fromScope) return fromScope;

  const api = clinicalDbApi();
  if (api && typeof api.dbPatientActiveTeamId === 'function') {
    try {
      const res = await api.dbPatientActiveTeamId({
        patientId: String(patientId || ''),
        nowIso: typeof now === 'string' ? now : now.toISOString(),
      });
      if (res?.ok && res.teamId) return String(res.teamId);
    } catch {
      /* optional IPC */
    }
  }
  return '';
}


/**
 * Team that owns the patient for handoff (census assignment), not the receiving guardia team.
 * @param {string} patientId
 * @param {object|null|undefined} patientRow
 * @param {object[]} teams
 * @param {object[]} assignments
 * @param {object|null|undefined} existingGuardia
 * @param {string} [fallbackUserId]
 */
export function resolveEntregaSourceTeamId(
  patientId,
  patientRow,
  teams,
  assignments,
  existingGuardia,
  fallbackUserId = ''
) {
  const censusTeamId = resolveEntregaCensusTeamId(
    patientId,
    patientRow,
    teams,
    assignments,
    new Date()
  );
  if (censusTeamId) return censusTeamId;
  if (existingGuardia?.source_team_id) {
    return String(existingGuardia.source_team_id);
  }
  return resolveDefaultSourceTeamIdForUser(teams, fallbackUserId);
}

/**
 * Census team for entrega (explicit assignment, structural match, or list tag).
 * @param {string} patientId
 * @param {object|null|undefined} patientRow
 * @param {object[]} teams
 * @param {object[]} assignments
 * @param {Date|string|number} [now]
 */
export function resolveEntregaCensusTeamId(
  patientId,
  patientRow,
  teams,
  assignments,
  now = new Date()
) {
  const pid = String(patientId || '');
  if (!pid) return '';
  const mapped = patientForScopeEvaluate(patientRow || { id: pid });
  const fromCensus = resolvePatientCensusTeamId(mapped, teams, assignments || [], now);
  if (fromCensus) return fromCensus;
  return String(patientRow?._filterTeamId || '').trim();
}

/**
 * @param {{ hasCensusAssignment?: boolean, hasExistingSourceTeam?: boolean }} opts
 */
export function entregaSourceTeamHint(opts = {}) {
  if (opts.hasCensusAssignment) {
    return 'Equipo al que está asignado este paciente en el censo (no el R1 de guardia).';
  }
  if (opts.hasExistingSourceTeam) {
    return 'Equipo de la entrega anterior — confirma si sigue siendo el correcto.';
  }
  return 'Sin asignación en censo — confirma el equipo del paciente antes de entregar.';
}

/** @param {object[]} teams @param {string} userId */
function resolveDefaultSourceTeamIdForUser(teams, userId) {
  const joined = getJoinedTeams(teams, String(userId || ''));
  if (joined[0]?.team_id) return String(joined[0].team_id);
  if (teams[0]?.team_id) return String(teams[0].team_id);
  return '';
}

/** @param {object|null|undefined} team */
export function entregaTeamOptionLabel(team) {
  if (!team?.team_id) return '';
  const name = String(team.name || '').trim() || 'Equipo';
  const service = String(team.service || '').trim();
  return service ? `${name} · ${service}` : name;
}

/**
 * @param {string} teamId
 * @param {object[]} teams
 */
export function findEntregaTeamById(teamId, teams) {
  const tid = String(teamId || '');
  if (!tid) return null;
  return (teams || []).find((t) => String(t?.team_id) === tid) || null;
}

/**
 * Census team may belong to another cubeta — always include it in the entrega select.
 * @param {string} srcTeamId
 * @param {object[]} teams
 * @param {string} userId
 * @param {object|null|undefined} [user]
 */
export function entregaSourceTeamSelectOptions(srcTeamId, teams, userId, user = null) {
  const tid = String(srcTeamId || '').trim();
  const allTeams = (teams || []).filter((t) => t?.team_id);
  const joined = getJoinedTeams(allTeams, userId);
  const base = hasElevatedTeamPrivileges(user || clinicalSessionContext.user)
    ? allTeams
    : joined.length
      ? joined
      : allTeams;
  if (!tid) return base;
  if (base.some((t) => String(t.team_id) === tid)) return base;
  const found = findEntregaTeamById(tid, teams);
  if (found) return [found, ...base];
  return [{ team_id: tid, name: teamLabelById(tid) }, ...base];
}
