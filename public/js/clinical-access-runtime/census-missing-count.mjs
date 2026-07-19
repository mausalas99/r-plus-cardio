/** @param {object[]} assignments @param {Set<string>} localIds */
export function countElevatedMissingPatients(assignments, localIds) {
  let missing = 0;
  for (const row of assignments) {
    const pid = String(row?.patient_id || '');
    if (pid && !localIds.has(pid)) missing += 1;
  }
  return missing;
}

/**
 * @param {object} user
 * @param {object[]} teams
 * @param {object[]} assignments
 * @param {Set<string>} localIds
 * @param {string} now
 */
export async function countTeamMemberMissingPatients(user, teams, assignments, localIds, now) {
  const { filterJoinedTeams } = await import('../features/clinical-teams/shared.mjs');
  const { resolvePatientTeamIdFromAssignments } = await import('../clinico-access.mjs');
  const joined = filterJoinedTeams(teams, user);
  const teamIds = new Set(joined.map((t) => String(t.team_id || '')));
  if (!teamIds.size) return null;
  let missing = 0;
  for (const row of assignments) {
    const pid = String(row?.patient_id || '');
    if (!pid || localIds.has(pid)) continue;
    const teamId = resolvePatientTeamIdFromAssignments(pid, assignments, now);
    if (teamIds.has(teamId)) missing += 1;
  }
  return missing;
}
