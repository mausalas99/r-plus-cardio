/** Team roster from clinicalOps snapshot (extracted for complexity budget). */

function clinicalUsersById(snapshot) {
  const deleted = new Set((snapshot?.clinical_users_deleted || []).map((id) => String(id)));
  const map = new Map();
  for (const row of snapshot?.clinical_users || []) {
    const id = String(row?.user_id || '').trim();
    if (!id || deleted.has(id)) continue;
    map.set(id, row);
  }
  return map;
}

function membershipRemovalKeys(snapshot) {
  const keys = new Set();
  for (const row of snapshot?.team_membership_removals || []) {
    const teamId = String(row?.team_id || '').trim();
    const userId = String(row?.user_id || '').trim();
    if (teamId && userId) keys.add(`${teamId}\0${userId}`);
  }
  return keys;
}

function archivedTeamIds(snapshot) {
  const ids = new Set();
  for (const row of snapshot?.teams || []) {
    if (row?.archived_at) ids.add(String(row.team_id || '').trim());
  }
  for (const row of snapshot?.teams_archived || []) {
    const id = String(row?.team_id || '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

function effectiveTeamSala(team, usersById) {
  const direct = String(team?.sala || '').trim();
  if (direct) return direct;
  const createdBy = String(team?.created_by || '').trim();
  if (!createdBy) return '';
  const creator = usersById.get(createdBy);
  return creator?.sala ? String(creator.sala).trim() : '';
}

function buildTeamMemberRow(row, usersById) {
  const teamId = String(row?.team_id || '').trim();
  const userId = String(row?.user_id || '').trim();
  const profile = usersById.get(userId) || {};
  return {
    team_id: teamId,
    user_id: userId,
    sub_area_fraction: row.sub_area_fraction ?? null,
    username: profile.username ?? null,
    rank: profile.rank ?? null,
    clinical_name: profile.clinical_name ?? null,
  };
}

function indexTeamMembers(snapshot, archived, removals) {
  const usersById = clinicalUsersById(snapshot);
  const membersByTeam = new Map();
  for (const row of snapshot?.team_membership || []) {
    const teamId = String(row?.team_id || '').trim();
    const userId = String(row?.user_id || '').trim();
    if (!teamId || !userId || archived.has(teamId)) continue;
    if (removals.has(`${teamId}\0${userId}`)) continue;
    if (!membersByTeam.has(teamId)) membersByTeam.set(teamId, []);
    membersByTeam.get(teamId).push(buildTeamMemberRow(row, usersById));
  }
  return { usersById, membersByTeam };
}

export function buildTeamsWithMembers(snapshot) {
  const archived = archivedTeamIds(snapshot);
  const removals = membershipRemovalKeys(snapshot);
  const { usersById, membersByTeam } = indexTeamMembers(snapshot, archived, removals);

  return (snapshot?.teams || [])
    .filter((team) => {
      const teamId = String(team?.team_id || '').trim();
      return teamId && !archived.has(teamId);
    })
    .map((team) => {
      const teamId = String(team.team_id || '');
      const sala = effectiveTeamSala(team, usersById) || team.sala || null;
      return {
        ...team,
        sala,
        members: membersByTeam.get(teamId) || [],
      };
    });
}
