/**
 * Modal dismiss wiring extracted from app-shell.mjs (Escape + backdrop click).
 * Import-time pure — no DOM access until initModalDismiss().
 */
import {
  createModalDismissRegistry,
  isRpcOverlayVisible,
  getOverlayZIndex,
} from './modal-dismiss.mjs';
import { isRpcDatePopoverOpen, closeRpcDatePopover } from './rpc-date-picker.mjs';
import { closeProfileModal, closeTemplatesModal } from './features/profile.mjs';
import { closeClinicoUnlockModal } from './clinico-access.mjs';
import { closeSOAPModal } from './features/soap-estado.mjs';
import { closeProcedureAgendaModal } from './features/agenda.mjs';
import { chartsShellCloseProxies } from './lazy-feature-routes.mjs';
import { closeLabSomeTablesModal } from './features/lab-some-tables-modal.mjs';
import { closeLabBulkPreviewModal } from './features/lab-bulk-preview-modal.mjs';
import { closeLabRepoImportModal } from './features/lab-repo-import.mjs';
import {
  closeUnifiedSearch,
  closeExtraTemplatesManager,
} from './features/productivity.mjs';
import { hideTourIntroModal, closeLabBulkTourHintModal } from './features/settings-help/tour-engine.mjs';
import {
  closeSettingsDropdown,
} from './features/settings-help/settings-dropdown.mjs';
import { closeConnectionDropdown } from './features/lan-sync.mjs';
import { closeQuickHelp } from './features/settings-help/help-content.mjs';
import { closeReleaseNotes } from './features/settings-help/release-notes.mjs';
import { hideUpdateModal } from './features/platform/updater.mjs';
import { closeWipeDataModal } from './features/platform/offline.mjs';
import {
  closeModal,
  confirmCloseAddPatientModal,
} from './features/patients.mjs';

const DYNAMIC_BACKDROP_IDS = [
  'lab-dedupe-backdrop',
  'soap-confirm-backdrop',
  'dup-confirm-backdrop',
  'lab-conflict-backdrop',
  'exp-advice-backdrop',
  'tend-gaso-ext-backdrop',
];

/** @type {ReturnType<typeof createModalDismissRegistry>} */
const modalDismiss = createModalDismissRegistry();
let modalDismissInited = false;

function shellEl(id) {
  return document.getElementById(id);
}

function regOverlay(registry, id, close, panelSelector) {
  registry.register({
    isOpen: function () {
      return isRpcOverlayVisible(shellEl(id));
    },
    close: close,
    backdropEl: function () {
      return shellEl(id);
    },
    panelSelector: panelSelector,
  });
}

function regOpenClass(registry, id, close, opts) {
  registry.register({
    isOpen: function () {
      var node = shellEl(id);
      return node && node.classList.contains('open');
    },
    close: close,
    confirmClose: opts && opts.confirmClose,
    backdropEl: function () {
      return shellEl(id);
    },
    panelSelector: opts && opts.panelSelector,
  });
}

function regAriaOpen(registry, id, close) {
  registry.register({
    isOpen: function () {
      var node = shellEl(id);
      return node && node.getAttribute('aria-hidden') === 'false';
    },
    close: close,
    backdropEl: function () {
      return shellEl(id);
    },
  });
}

/** @param {ReturnType<typeof createModalDismissRegistry>} registry */
function wireModalDismissLayers(registry) {
  regOverlay(registry, 'update-modal-backdrop', hideUpdateModal);
  regOverlay(
    registry,
    'tend-detail-backdrop',
    chartsShellCloseProxies.closeTendDetail,
    '#tend-detail-modal'
  );

  registry.register({
    isOpen: function () {
      var bd = shellEl('tend-group-backdrop');
      if (bd && bd.getAttribute('aria-hidden') === 'false') return true;
      return chartsShellCloseProxies.isTendGroupModalOpen();
    },
    close: chartsShellCloseProxies.closeTendGroupModal,
    backdropEl: function () {
      return shellEl('tend-group-backdrop');
    },
    panelSelector: '#tend-group-modal',
  });

  regAriaOpen(registry, 'rpc-wipe-modal', closeWipeDataModal);
  regOpenClass(registry, 'soap-modal-backdrop', closeSOAPModal);
  regOpenClass(registry, 'procedure-agenda-modal', closeProcedureAgendaModal, {
    panelSelector: '.modal',
  });
  regOpenClass(registry, 'modal', closeModal, { confirmClose: confirmCloseAddPatientModal });
  regOpenClass(registry, 'profile-modal', closeProfileModal);
  regOverlay(registry, 'templates-modal', closeTemplatesModal);
  regOverlay(registry, 'extra-templates-modal', closeExtraTemplatesManager);
  regOpenClass(registry, 'unified-search-backdrop', closeUnifiedSearch);
  regOpenClass(registry, 'help-quick-backdrop', closeQuickHelp);
  regOpenClass(registry, 'release-notes-backdrop', closeReleaseNotes, {
    panelSelector: '.release-notes-modal',
  });
  regOpenClass(
    registry,
    'tend-hidden-modal-backdrop',
    chartsShellCloseProxies.closeTendHiddenModal
  );
  regOpenClass(
    registry,
    'lab-display-prefs-backdrop',
    chartsShellCloseProxies.closeLabDisplayPrefsModal,
    { panelSelector: '.lab-display-prefs-modal' }
  );
  regOpenClass(registry, 'lab-bulk-preview-backdrop', closeLabBulkPreviewModal, {
    panelSelector: '.lab-bulk-preview-modal',
  });
  regOpenClass(registry, 'lab-repo-import-modal', closeLabRepoImportModal, {
    panelSelector: '.lab-repo-import-modal',
  });
  regOpenClass(registry, 'lab-bulk-tour-hint-backdrop', closeLabBulkTourHintModal, {
    panelSelector: '.lab-bulk-tour-hint-modal',
  });
  regOpenClass(registry, 'clinico-unlock-backdrop', closeClinicoUnlockModal, {
    panelSelector: '.clinico-unlock-modal',
  });
  regOpenClass(registry, 'lab-some-tables-backdrop', closeLabSomeTablesModal, {
    panelSelector: '.lab-some-tables-modal',
  });
  regOpenClass(registry, 'onboarding-intro-backdrop', hideTourIntroModal);
}

/** @param {ReturnType<typeof createModalDismissRegistry>} registry */
function wireDropdownAndDynamicLayers(registry) {
  registry.register({
    isOpen: function () {
      var bg = shellEl('connection-dropdown-backdrop');
      return bg && bg.classList.contains('open');
    },
    close: closeConnectionDropdown,
    backdropEl: function () {
      return shellEl('connection-dropdown-backdrop');
    },
  });

  registry.register({
    isOpen: function () {
      var bg = shellEl('settings-dropdown-backdrop');
      return bg && bg.classList.contains('open');
    },
    close: closeSettingsDropdown,
    backdropEl: function () {
      return shellEl('settings-dropdown-backdrop');
    },
  });

  registry.register({
    isOpen: function () {
      return DYNAMIC_BACKDROP_IDS.some(function (id) {
        return isRpcOverlayVisible(shellEl(id));
      });
    },
    close: function () {
      var top = null;
      var bestZ = -1;
      DYNAMIC_BACKDROP_IDS.forEach(function (id) {
        var node = shellEl(id);
        var z = getOverlayZIndex(node);
        if (z > bestZ) {
          bestZ = z;
          top = node;
        }
      });
      if (!top) return;
      if (top.id === 'tend-gaso-ext-backdrop') {
        top.style.display = 'none';
        top.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('tend-gaso-ext-open');
        return;
      }
      top.remove();
    },
    backdropEl: function () {
      var best = null;
      var bestZ = -1;
      DYNAMIC_BACKDROP_IDS.forEach(function (id) {
        var node = shellEl(id);
        var z = getOverlayZIndex(node);
        if (z > bestZ) {
          bestZ = z;
          best = node;
        }
      });
      return best;
    },
    panelSelector: '.lab-conflict-modal, .tend-gaso-ext-dialog, [role="dialog"]',
  });

  registry.register({
    isOpen: isRpcDatePopoverOpen,
    close: closeRpcDatePopover,
  });
}

function wireDynamicBackdropClickHandler() {
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('lab-conflict-backdrop')) return;
    if (DYNAMIC_BACKDROP_IDS.indexOf(t.id) === -1) return;
    t.remove();
  });
}

export function initModalDismiss() {
  if (modalDismissInited) return;
  wireModalDismissLayers(modalDismiss);
  wireDropdownAndDynamicLayers(modalDismiss);
  modalDismiss.init();
  wireDynamicBackdropClickHandler();
  modalDismissInited = true;
}
