// Entrega phase covering resolution helpers
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { getJoinedTeams, salaOnCallR1, userIsOnGuardiaCallToday } from '../../clinico-access.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { normalizeUsers, userOptionLabel } from './clinical-entrega-util.mjs';

/**
 * @param {{
 *   userId: string,
 *   rank?: string,
 *   users: object[],
 *   teams: object[],
 *   sala: string,
 *   salaGuardiaToday?: object[],
 *   guardiaActivated?: boolean,
 *   guardiaMode?: boolean,
 *   now?: Date|string,
 * }} opts
 */
function activatorIsEntregaShiftReceiver(opts, userId, rank, teams, now, salaGuardiaToday) {
  return (
    !!userId &&
    (opts.guardiaActivated ||
      opts.guardiaMode ||
      userIsOnGuardiaCallToday(userId, rank, teams, now, salaGuardiaToday))
  );
}

function buildActivatorCoveringPayload(userId, teams, users, sala, now, salaGuardiaToday) {
  const onCall = salaOnCallR1(teams, sala, now, salaGuardiaToday);
  const teamRow = onCall.find((r) => String(r.user_id) === userId);
  const joined = getJoinedTeams(teams, userId);
  const teamInSala = joined.find((t) => String(t.sala || '') === sala) || joined[0];
  const u = normalizeUsers(users).find((x) => x.user_id === userId);
  return {
    coveringUserId: userId,
    teamId: String(teamRow?.team_id || teamInSala?.team_id || ''),
    sala,
    coveringLabel: u ? userOptionLabel(u) : userId,
  };
}

export function resolveActivatorEntregaCovering(opts) {
  const userId = String(opts.userId || '');
  const teams = opts.teams || [];
  const users = opts.users || [];
  const sala = String(opts.sala || '').trim();
  const salaGuardiaToday = opts.salaGuardiaToday || [];
  const rank = String(opts.rank || effectiveClinicalRank(clinicalSessionContext.user) || 'R1');
  const now = opts.now ? new Date(opts.now) : new Date();

  if (!activatorIsEntregaShiftReceiver(opts, userId, rank, teams, now, salaGuardiaToday)) {
    return null;
  }

  return buildActivatorCoveringPayload(userId, teams, users, sala, now, salaGuardiaToday);
}
