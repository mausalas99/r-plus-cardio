import { isOnCallToday, salaOnCallR1, salaOnCallR2 } from '../../clinico-access.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import { uniqueByUserId } from './clinical-entrega-util.mjs';

/** @param {object[]} all @param {object[]} teamList @param {Date} now */
export function listEntregaTargetsR3(all, teamList, now) {
  const suggestedIds = new Set();
  teamList.forEach((team) => {
    if (!isOnCallToday(team, 'R3', now)) return;
    (team.members || []).forEach((m) => {
      if (m?.user_id) suggestedIds.add(String(m.user_id));
    });
  });
  const targets = all.filter((u) => suggestedIds.has(u.user_id));
  return {
    flow: 'r3_suggest',
    targets: targets.length ? uniqueByUserId(targets) : all,
  };
}

/** @param {object[]} all @param {object[]} teamList @param {Date} now */
export function listEntregaTargetsR2(all, teamList, now) {
  const r2GuardiaIds = new Set(salaOnCallR2(teamList, now).map((r) => r.user_id));
  const r2GuardiaUsers = all.filter((u) => r2GuardiaIds.has(u.user_id));
  const r4s = all.filter((u) => u.rank === 'R4');
  const targets = uniqueByUserId([...r2GuardiaUsers, ...r4s]);
  return { flow: 'r2_handoff', targets: targets.length ? targets : all };
}

/**
 * @param {object[]} all
 * @param {object[]} teamList
 * @param {object[]} joinedTeams
 * @param {Date} now
 */
export function listEntregaTargetsR1(all, teamList, joinedTeams, now) {
  let userSala = '';
  for (const t of joinedTeams) {
    const sala = String(t.sala || '').trim();
    if (sala) {
      userSala = sala;
      break;
    }
  }
  const salaGuardiaToday = mergeSalaGuardiaTodayRows(
    teamList,
    clinicalSessionContext.salaGuardiaToday || []
  );
  const onCallIds = new Set(
    (userSala ? salaOnCallR1(teamList, userSala, now, salaGuardiaToday) : []).map((r) =>
      String(r.user_id)
    )
  );
  const onCallTargets = all.filter((u) => u.rank === 'R1' && onCallIds.has(u.user_id));

  const joinedIds = new Set(joinedTeams.map((t) => String(t.team_id)));
  const fractions = new Set(
    joinedTeams.map((t) => String(t.sub_area_fraction || '').trim()).filter(Boolean)
  );
  const peerTargets = all.filter((u) => {
    if (u.rank !== 'R1') return false;
    return teamList.some((team) => {
      const member = (team.members || []).some((m) => String(m.user_id) === u.user_id);
      if (!member) return false;
      if (joinedIds.has(String(team.team_id))) return true;
      const frac = String(team.sub_area_fraction || '').trim();
      return frac && fractions.has(frac);
    });
  });
  const targets = uniqueByUserId([...onCallTargets, ...peerTargets]);
  return { flow: 'r1', targets: targets.length ? targets : all };
}
