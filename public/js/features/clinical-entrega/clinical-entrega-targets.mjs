// Entrega target user lists by rank / scope
import { getJoinedTeams } from '../../clinico-access.mjs';
import { normalizeUsers, uniqueByUserId } from './clinical-entrega-util.mjs';
import {
  listEntregaTargetsR1,
  listEntregaTargetsR2,
  listEntregaTargetsR3,
} from './clinical-entrega-targets-rank.mjs';

/**
 * Ensure a covering user appears in the entrega target dropdown (avoids blank select).
 * @param {object[]} targetList
 * @param {object[]} users
 * @param {string} userId
 * @param {string} [fallbackLabel]
 */
export function ensureEntregaTargetUser(targetList, users, userId, fallbackLabel = '') {
  const id = String(userId || '').trim();
  if (!id || targetList.some((u) => u.user_id === id)) return targetList;
  const match = normalizeUsers(users).find((u) => u.user_id === id);
  if (match) return [match, ...targetList];
  return [
    {
      user_id: id,
      username: fallbackLabel || 'Residente de guardia',
      rank: 'R1',
      clinical_name: '',
    },
    ...targetList,
  ];
}

/**
 * Users available for entrega labels — scope context, team rosters, and session user.
 * @param {object|null|undefined} scopeContext
 * @param {object[]} teams
 * @param {object|null|undefined} sessionUser
 */
export function collectEntregaScopeUsers(scopeContext, teams, sessionUser = null) {
  const parts = [];
  if (Array.isArray(scopeContext?.users)) parts.push(...scopeContext.users);
  for (const team of teams || []) {
    for (const m of team.members || []) {
      if (!m?.user_id) continue;
      parts.push({
        user_id: m.user_id,
        username: m.username,
        rank: m.rank,
        clinical_name: m.clinical_name,
      });
    }
  }
  if (sessionUser?.user_id) parts.push(sessionUser);
  return uniqueByUserId(normalizeUsers(parts));
}

/**
 * @param {string} rank
 * @param {object[]} teams
 * @param {object[]} users
 * @param {boolean} salaDeficit
 * @param {{ currentUserId?: string, now?: string|Date }} [opts]
 */
export function listEntregaTargets(rank, teams, users, salaDeficit, opts = {}) {
  const currentUserId = String(opts.currentUserId || '');
  const now = opts.now ? new Date(String(opts.now)) : new Date();
  const all = normalizeUsers(users);
  const teamList = Array.isArray(teams) ? teams : [];
  const rankNorm = String(rank || 'R1');

  const joinedTeams = currentUserId ? getJoinedTeams(teamList, currentUserId) : [];

  if (rankNorm === 'R3') return listEntregaTargetsR3(all, teamList, now);
  if (rankNorm === 'R2') return listEntregaTargetsR2(all, teamList, now);
  if (rankNorm === 'R1') return listEntregaTargetsR1(all, teamList, joinedTeams, now);

  return { flow: 'generic', targets: all };
}
