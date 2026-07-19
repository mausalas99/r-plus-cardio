/** LAN directorio control wiring. */
import { getClinicalTeamsPanelHost } from '../clinical-panel-host.mjs';
import {
  LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD,
  lanDirRt,
} from './teams-roster-lan-state.mjs';
import {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  isLanDirectoryModalOpen,
} from './teams-roster-lan-dom.mjs';
import {
  ensureLanDirectoryFilterDelegation,
  bindLanDirectoryFilterControls,
} from './teams-roster-lan-filters.mjs';
import {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
} from './teams-roster-lan-modal.mjs';
import {
  reloadLanUsersDirectoryPreservingUi,
  refreshLanDirectoryFromHostUi,
} from './teams-roster-lan-load.mjs';
import {
  syncLanAssignCycleSelect,
  handleLanDeleteDirectoryUserClick,
  handleLanAssignButtonClick,
} from './teams-roster-lan-assign.mjs';

function wireLanDirectoryActivityRefresh() {
  if (typeof document === 'undefined' || document._rpcLanDirActivityRefreshWired) return;
  document._rpcLanDirActivityRefreshWired = true;
  document.addEventListener('rpc-clinical-user-activity-touched', () => {
    if (!isLanDirectoryModalOpen()) return;
    const host = lanUsersModalBodyEl();
    if (!host?.querySelector('.clinical-lan-rank-groups')) return;
    void reloadLanUsersDirectoryPreservingUi();
  });
}

function wireLanDirectoryOpenButtons(panelHost) {
  if (panelHost && !panelHost._rpcLanDirOpenDelegated) {
    panelHost._rpcLanDirOpenDelegated = true;
    panelHost.addEventListener('click', (ev) => {
      const openBtn =
        ev.target instanceof Element
          ? ev.target.closest('#btn-open-lan-users-directory, .clinical-teams-open-lan-users-btn')
          : null;
      if (!openBtn) return;
      ev.preventDefault();
      void openLanUsersDirectoryModal();
    });
  }

  const openBtn = document.getElementById('btn-open-lan-users-directory');
  if (openBtn && !openBtn._rpcLanDirOpenWired) {
    openBtn._rpcLanDirOpenWired = true;
    openBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      void openLanUsersDirectoryModal();
    });
  }
}

function wireLanDirectoryModalChrome() {
  const bd = lanUsersModalBackdropEl();
  if (bd && !bd._rpcLanUsersBackdropWired) {
    bd._rpcLanUsersBackdropWired = true;
    bd.addEventListener('click', (ev) => {
      if (ev.target === bd) closeLanUsersDirectoryModal();
    });
  }

  const closeBtn = document.getElementById('btn-clinical-lan-users-close');
  if (closeBtn && !closeBtn._rpcLanUsersCloseWired) {
    closeBtn._rpcLanUsersCloseWired = true;
    closeBtn.addEventListener('click', () => closeLanUsersDirectoryModal());
  }
}

function wireLanDirectoryHostInteractions(host) {
  if (!host || host._rpcLanUsersAssignWired) return;
  host._rpcLanUsersAssignWired = true;
  host.addEventListener(
    'toggle',
    (ev) => {
      const details = ev.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (!details.classList.contains('clinical-lan-rank-group')) return;
      const key = String(details.dataset.lanRankGroup || '').trim();
      if (!key) return;
      const count = Number(details.dataset.lanRankCount) || 0;
      if (details.open) {
        lanDirRt.collapsedRanks.delete(key);
        if (count > LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD) {
          lanDirRt.expandedRanks.add(key);
        }
      } else {
        lanDirRt.collapsedRanks.add(key);
        lanDirRt.expandedRanks.delete(key);
      }
    },
    true
  );
  host.addEventListener('change', (ev) => {
    const teamSelect = ev.target instanceof Element ? ev.target.closest('.clinical-lan-assign-team') : null;
    if (teamSelect) syncLanAssignCycleSelect(teamSelect);
  });
  host.addEventListener('click', (ev) => {
    const refreshBtn =
      ev.target instanceof Element ? ev.target.closest('.clinical-lan-directory-refresh-btn') : null;
    if (refreshBtn) {
      void refreshLanDirectoryFromHostUi({ forcePull: true });
      return;
    }
    const delBtn =
      ev.target instanceof Element ? ev.target.closest('.clinical-lan-delete-user-btn') : null;
    if (delBtn) {
      void handleLanDeleteDirectoryUserClick(delBtn);
      return;
    }
    const btn = ev.target instanceof Element ? ev.target.closest('.clinical-lan-assign-btn') : null;
    if (btn) void handleLanAssignButtonClick(btn);
  });
}

export function wireLanUsersDirectoryControls() {
  wireLanDirectoryActivityRefresh();
  const panelHost = getClinicalTeamsPanelHost();
  wireLanDirectoryOpenButtons(panelHost);
  wireLanDirectoryModalChrome();
  ensureLanDirectoryFilterDelegation();
  const host = lanUsersModalBodyEl();
  if (host) bindLanDirectoryFilterControls(host);
  wireLanDirectoryHostInteractions(host);
}
