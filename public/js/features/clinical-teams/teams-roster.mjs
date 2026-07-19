/** Mi rotación — roster barrel (handlers + re-exports). */
export {
  teamsModalEl,
  refreshTeamsUiAfterChange,
  openClinicalTeamsPanel,
  closeClinicalTeamsPanel,
} from './teams-roster-shell.mjs';

export {
  wireTeamManageModalDelegation,
  handleEditTeamSubmit,
} from './teams-roster-manage.mjs';

export { handleProfileFormSubmit } from './teams-roster-profile.mjs';

export {
  handleCreateTeamSubmit,
  handleAddMemberSubmit,
  handleMyCycleSubmit,
} from './teams-roster-submit.mjs';

export {
  wireBrowseSalaControl,
  wireJoinButtons,
  wireCopyInviteButtons,
  wireClinicalTeamsPanelInteractions,
  wireRenderedClinicalTeamsPanel,
} from './teams-roster-interactions.mjs';
