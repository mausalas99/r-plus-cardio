import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { inferMembershipCycleForJoin } from '../../clinico-access.mjs';
import { validateTeamRankSlot } from '../../../../lib/clinical-team-composition.mjs';
import { dbApi, toast, currentUserId, toastTeamWarnings } from './shared.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';

function toastJoinSlotWarnings(team, rank) {
  const slotWarn = validateTeamRankSlot(team?.service || '', rank, team?.members || []);
  if (slotWarn) toast(slotWarn, 'warn');
  else if (team?.joinWarning) toast(String(team.joinWarning), 'warn');
}

/** @param {string} teamId */
export async function joinClinicalTeamByButton(teamId) {
  const userId = currentUserId();
  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamsJoin !== 'function') {
    toast('No se pudo unir al equipo.', 'error');
    return;
  }
  const team = (clinicalSessionContext.teams || []).find((t) => String(t.team_id) === teamId);
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const cycle = inferMembershipCycleForJoin(team || {}, rank);
  toastJoinSlotWarnings(team, rank);

  const res = await api.dbClinicalTeamsJoin({ teamId, userId, subAreaFraction: cycle });
  if (!res || res.ok === false) {
    toast(res?.error || 'No se pudo unir al equipo.', 'error');
    return;
  }
  toastTeamWarnings(res.warnings);
  toast('Te uniste al equipo.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  void publishClinicalTeamsToLan();
}
