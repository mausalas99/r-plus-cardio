/**
 * Modal backdrop/close/submit wiring for Mi rotación.
 * Loaded before openClinicalTeamsPanel; handlers come via dynamic import of teams-roster
 * to avoid roster ↔ render cycles and missing bindings in split chunks.
 */
import {
  adminCodeModalBackdropEl,
  cancelAdminCodeModal,
  wireAdminCodeModalControls,
} from './shared.mjs';
import { handleJoinWithCodeSubmit } from './teams-invite.mjs';
import {
  closeLanUsersDirectoryModal,
  lanUsersModalBackdropEl,
  wireLanUsersDirectoryControls,
} from './teams-roster-lan.mjs';

function teamsModalBackdrop() {
  return document.getElementById('clinical-teams-backdrop');
}

/** @returns {Promise<typeof import('./teams-roster.mjs')>} */
function loadRoster() {
  return import('./teams-roster.mjs');
}

/** Close button, backdrop click, and form submit delegation — always safe to call. */
export function wireClinicalTeamsModalChrome() {
  const bd = teamsModalBackdrop();
  if (bd) {
    if (!bd._rpcTeamsBackdropClick) {
      bd._rpcTeamsBackdropClick = true;
      bd.addEventListener('click', (ev) => {
        if (ev.target === bd) {
          void loadRoster().then((m) => m.closeClinicalTeamsPanel());
        }
      });
    }
    if (!bd._rpcTeamsSubmitDelegated) {
      bd._rpcTeamsSubmitDelegated = true;
      bd.addEventListener('submit', (ev) => {
        const form = ev.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.id === 'clinical-profile-form') {
          ev.preventDefault();
          void loadRoster().then((m) => m.handleProfileFormSubmit(ev));
        } else if (form.id === 'clinical-team-create-form') {
          ev.preventDefault();
          void loadRoster().then((m) => m.handleCreateTeamSubmit(ev));
        } else if (form.classList.contains('clinical-teams-add-member-form')) {
          ev.preventDefault();
          void loadRoster().then((m) => m.handleAddMemberSubmit(ev, form));
        } else if (form.classList.contains('clinical-teams-my-cycle-form')) {
          ev.preventDefault();
          void loadRoster().then((m) => m.handleMyCycleSubmit(ev, form));
        } else if (form.id === 'clinical-team-join-code-form') {
          ev.preventDefault();
          void handleJoinWithCodeSubmit(ev);
        } else if (form.classList.contains('clinical-teams-edit-form')) {
          ev.preventDefault();
          void loadRoster().then((m) => m.handleEditTeamSubmit(ev, form));
        }
      });
    }
  }

  const closeBtn = document.getElementById('btn-clinical-teams-close');
  if (closeBtn && !closeBtn._rpcCloseWired) {
    closeBtn._rpcCloseWired = true;
    closeBtn.addEventListener('click', () => {
      void loadRoster().then((m) => m.closeClinicalTeamsPanel());
    });
  }

  if (!document._rpcClinicalTeamsEscapeWired) {
    document._rpcClinicalTeamsEscapeWired = true;
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      const lanBd = lanUsersModalBackdropEl();
      if (lanBd?.classList.contains('open')) {
        closeLanUsersDirectoryModal();
        return;
      }
      const adminBd = adminCodeModalBackdropEl();
      if (adminBd?.classList.contains('open')) {
        cancelAdminCodeModal();
        return;
      }
      const teamsBd = teamsModalBackdrop();
      if (teamsBd?.classList.contains('open')) {
        void loadRoster().then((m) => m.closeClinicalTeamsPanel());
      }
    });
  }

  wireLanUsersDirectoryControls();
  wireAdminCodeModalControls();
  void loadRoster().then((m) => m.wireTeamManageModalDelegation());
}
