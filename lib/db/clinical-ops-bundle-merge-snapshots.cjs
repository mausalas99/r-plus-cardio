'use strict';

const {
  mergeClinicalUsersData,
  mergeClinicalUsersDeletedData,
} = require('./clinical-ops-bundle-merge-users.cjs');

function pickExportedAt(local, incoming) {
  return String(incoming.exportedAt || '') >= String(local.exportedAt || '')
    ? incoming.exportedAt
    : local.exportedAt;
}

function mergeClinicalUsersExcludingDeleted(local, incoming) {
  const clinical_users_deleted = mergeClinicalUsersDeletedData(
    local.clinical_users_deleted || [],
    incoming.clinical_users_deleted || []
  );
  const deletedSet = new Set(clinical_users_deleted);
  const clinical_users = mergeClinicalUsersData(
    local.clinical_users || [],
    incoming.clinical_users || []
  ).filter((row) => !deletedSet.has(String(row?.user_id || '')));
  return { clinical_users_deleted, deletedSet, clinical_users };
}

function mergeOnRemoteRotationNueva(local, incoming) {
  const { clinical_users_deleted, clinical_users } = mergeClinicalUsersExcludingDeleted(
    local,
    incoming
  );
  return {
    ...incoming,
    exportedAt: pickExportedAt(local, incoming),
    clinical_users_deleted,
    clinical_users,
  };
}

function buildMembershipRemovals(local, incoming, deps, deletedSet, mergedClinicalUsers, mergedTeams) {
  const team_membership_rejoins = deps.mergeMembershipRejoinsData(
    local.team_membership_rejoins || [],
    incoming.team_membership_rejoins || []
  );
  const rawRemovals = deps.mergeMembershipRemovalsData(
    local.team_membership_removals || [],
    incoming.team_membership_removals || []
  );
  const reconciled = deps.reconcileMembershipRemovalsData(local, rawRemovals, team_membership_rejoins);
  return deps.pruneStaleMembershipRemovalsData(
    reconciled,
    deletedSet,
    mergedClinicalUsers,
    mergedTeams
  );
}

function buildFilteredTeamMembership(local, incoming, deps, deletedSet, archivedTeamIds, removals) {
  const merged = deps.mergeTeamMembershipData(
    local.team_membership || [],
    incoming.team_membership || []
  );
  const withoutDeleted = deps.filterMembershipForDeletedUsers(merged, deletedSet);
  const withoutArchived = deps.filterMembershipForArchivedTeams(withoutDeleted, archivedTeamIds);
  return deps.filterMembershipAfterRemovals(withoutArchived, removals);
}

function buildStandardSnapshotFields(local, incoming, deps, ctx) {
  const {
    exportedAt,
    clinical_users_deleted,
    mergedClinicalUsers,
    team_membership_rejoins,
    teams_archived,
    mergedTeams,
    archivedTeamIds,
    team_membership_removals,
    active_guardias_resolved,
    localNueva,
    remoteNueva,
  } = ctx;

  return {
    version: Math.max(Number(local.version || 1), Number(incoming.version || 1)),
    exportedAt,
    rotationNuevaAt: localNueva || remoteNueva || null,
    rotation_cycles: deps.mergeRotationCyclesData(
      local.rotation_cycles || [],
      incoming.rotation_cycles || []
    ),
    patient_team_assignment: deps.mergePatientTeamAssignmentsData(
      local.patient_team_assignment || [],
      incoming.patient_team_assignment || []
    ),
    team_guardia_today: deps.mergeTeamGuardiaTodayData(
      local.team_guardia_today || [],
      incoming.team_guardia_today || []
    ),
    teams: mergedTeams,
    teams_archived,
    team_membership_rejoins,
    team_membership_removals,
    team_membership: buildFilteredTeamMembership(
      local,
      incoming,
      deps,
      ctx.deletedSet,
      archivedTeamIds,
      team_membership_removals
    ),
    active_guardias: deps.filterActiveGuardiasByResolved(
      deps.mergeActiveGuardiasData(local.active_guardias || [], incoming.active_guardias || []),
      active_guardias_resolved
    ),
    active_guardias_resolved,
    clinical_users: mergedClinicalUsers,
    clinical_users_deleted,
  };
}

function mergeClinicalOpsSnapshotsStandard(local, incoming, deps) {
  const exportedAt = pickExportedAt(local, incoming);
  const { clinical_users_deleted, deletedSet, clinical_users: mergedClinicalUsers } =
    mergeClinicalUsersExcludingDeleted(local, incoming);

  const team_membership_rejoins = deps.mergeMembershipRejoinsData(
    local.team_membership_rejoins || [],
    incoming.team_membership_rejoins || []
  );
  const teams_archived = deps.mergeTeamsArchivedData(
    local.teams_archived || [],
    incoming.teams_archived || []
  );
  let mergedTeams = deps.mergeTeamsData(local.teams || [], incoming.teams || []);
  mergedTeams = deps.applyArchivedTeamTombstonesToTeams(mergedTeams, teams_archived);
  const archivedTeamIds = deps.archivedTeamIdSet(mergedTeams, teams_archived);

  const team_membership_removals = buildMembershipRemovals(
    local,
    incoming,
    deps,
    deletedSet,
    mergedClinicalUsers,
    mergedTeams
  );
  const active_guardias_resolved = deps.mergeResolvedGuardiasData(
    local.active_guardias_resolved || [],
    incoming.active_guardias_resolved || []
  );

  const remoteNueva = incoming.rotationNuevaAt ? String(incoming.rotationNuevaAt) : '';
  const localNueva = local.rotationNuevaAt ? String(local.rotationNuevaAt) : '';

  return buildStandardSnapshotFields(local, incoming, deps, {
    exportedAt,
    clinical_users_deleted,
    mergedClinicalUsers,
    team_membership_rejoins,
    teams_archived,
    mergedTeams,
    archivedTeamIds,
    team_membership_removals,
    active_guardias_resolved,
    localNueva,
    remoteNueva,
    deletedSet,
  });
}

function mergeClinicalOpsSnapshotsData(local, incoming, deps) {
  if (!local) return incoming && typeof incoming === 'object' ? { ...incoming } : null;
  if (!incoming || typeof incoming !== 'object') return { ...local };

  const remoteNueva = incoming.rotationNuevaAt ? String(incoming.rotationNuevaAt) : '';
  const localNueva = local.rotationNuevaAt ? String(local.rotationNuevaAt) : '';
  if (remoteNueva && (!localNueva || remoteNueva > localNueva)) {
    return mergeOnRemoteRotationNueva(local, incoming);
  }

  return mergeClinicalOpsSnapshotsStandard(local, incoming, deps);
}

module.exports = {
  mergeClinicalOpsSnapshotsData,
};
