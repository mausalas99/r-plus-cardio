/**
 * Mi rotación shell — re-exports and modal/control wiring (BN-07).
 */
export {
  CLINICAL_TEAM_SERVICES,
  CLINICAL_SALAS,
  filterJoinedTeams,
  isUserTeamMember,
} from './shared.mjs';

export {
  openClinicalTeamsPanel,
  closeClinicalTeamsPanel,
} from './teams-roster.mjs';

export { wireClinicalTeamsModalChrome } from './teams-roster-modal-chrome.mjs';

export { wireClinicalTeamsPanelInteractions } from './teams-roster-interactions.mjs';

export {
  renderCreateTeamForm,
  renderClinicalTeamsPanel,
} from './teams-roster-render.mjs';

export {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
} from './teams-roster-lan.mjs';

export { consumeClinicalTeamJoinFromUrl } from './teams-invite.mjs';

import { refreshTeamsUiAfterChange } from './teams-roster.mjs';

let teamsControlsWired = false;

export function wireClinicalTeamsControls() {
  void import('./teams-roster-modal-chrome.mjs').then((m) => m.wireClinicalTeamsModalChrome());
  if (teamsControlsWired) return;
  teamsControlsWired = true;

  import('../clinical-rotation-entry.mjs').then((mod) => {
    mod.wireClinicalRotationEntryControls();
    mod.syncClinicalRotationEntryChrome();
  });

  if (!document._rpcClinicalTeamsChangedWired) {
    document._rpcClinicalTeamsChangedWired = true;
    document.addEventListener('rpc-clinical-teams-changed', (ev) => {
      void refreshTeamsUiAfterChange({ force: !!ev.detail?.force });
    });
  }

  if (!document._rpcClinicalOpsSyncedTeamsWired) {
    document._rpcClinicalOpsSyncedTeamsWired = true;
    let opsSyncedTeamsRefreshTimer = null;
    document.addEventListener('rpc-clinical-ops-synced', () => {
      if (opsSyncedTeamsRefreshTimer) clearTimeout(opsSyncedTeamsRefreshTimer);
      opsSyncedTeamsRefreshTimer = setTimeout(() => {
        opsSyncedTeamsRefreshTimer = null;
        void refreshTeamsUiAfterChange();
      }, 300);
    });
  }
}
