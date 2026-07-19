// Laboratorio pane — barrel: runtime registration, chrome, re-exports
import { isPaseMode } from './chrome.mjs';
import {
  closeLabSomeTablesModal,
  openLabSomeTablesModal,
  registerLabSomeTablesModalRuntime,
  syncLabSomeTablesBtn,
} from './lab-some-tables-modal.mjs';
import { rt, registerLabPanelRuntime as _registerRt } from './lab-panel-runtime-state.mjs';
import { labPanelBridge } from './lab-panel-bridge.mjs';
import {
  renderLabHistoryPanel,
  setLabHistoryPanelCollapsed,
  syncLabHistoryCollapseUI,
  expandLabHistoryList,
  replayLabHistorySet,
  reprocessLabHistorySet,
  deleteLabHistorySet,
  onLabHistoryDateChange,
  reprocessSelectedLabHistorySet,
  deleteSelectedLabHistorySet,
  deleteAllLabHistorySets,
  labHistoryPanelIsCollapsed,
  toggleLabHistoryPanel,
} from './lab-panel-history.mjs';
import {
  openLabHistoryDedupeReview,
  consolidateLabHistoryByDayAndTipo,
} from './lab-panel-history-dedupe.mjs';
import {
  limpiarReporte,
  enviarLabsANota,
  insertLabPatientSeparator,
  openLabPatientPicker,
  copiarLabsAlPortapapeles,
  clearLabInputAfterSuccessfulParse,
} from './lab-panel-workbench.mjs';
import { applyDriveImportLabSets } from './lab-panel-workbench-store.mjs';
import { procesarReporte, renderOutput } from './lab-panel-parse.mjs';
import {
  openLabRepoImportModal,
  closeLabRepoImportModal,
  confirmLabRepoImport,
  registerLabRepoImportRuntime,
} from './lab-repo-import.mjs';

var activeLab = null;

labPanelBridge.getActiveLab = function () {
  return activeLab;
};
labPanelBridge.setActiveLab = function (next) {
  activeLab = next;
};
labPanelBridge.renderOutput = renderOutput;
labPanelBridge.syncLabOutputChrome = syncLabOutputChrome;
labPanelBridge.renderLabHistoryPanel = renderLabHistoryPanel;

export function registerLabPanelRuntime(ctx) {
  _registerRt(ctx);
  registerLabRepoImportRuntime(ctx);
}

export function getActiveLab() {
  return activeLab;
}

export function setActiveLab(next) {
  activeLab = next;
}

export function rerenderParsedLabOutputAfterPrefsChange() {
  if (activeLab && activeLab.resLabs && activeLab.resLabs.length) renderOutput(activeLab);
}

export function safeAttrJsString(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

var labCopyFabBound = false;

function isLabAppTabActive() {
  if (typeof rt.getActiveAppTab !== 'function') return false;
  var tab = rt.getActiveAppTab();
  return tab === 'lab' || tab === 'lan';
}

function hideEaCopyFabDom() {
  var fab = document.getElementById('ea-copy-fab');
  if (!fab) return;
  fab.setAttribute('hidden', '');
  fab.style.display = 'none';
  fab.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('ea-copy-fab-active');
}

function ensureLabCopyFabController() {
  var fab = document.getElementById('lab-copy-fab');
  if (!fab || labCopyFabBound) return;
  labCopyFabBound = true;
  if (fab.parentElement !== document.body) document.body.appendChild(fab);
  fab.removeAttribute('onclick');
  fab.addEventListener(
    'mousedown',
    function (e) {
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
  fab.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (fab.hidden) return;
    copiarLabsAlPortapapeles();
  });
}

export function syncLabCopyFab(show) {
  ensureLabCopyFabController();
  var visible = !!show && isLabAppTabActive();
  if (visible) hideEaCopyFabDom();
  var fab = document.getElementById('lab-copy-fab');
  if (fab) {
    if (visible) {
      fab.removeAttribute('hidden');
      fab.style.display = 'flex';
      fab.setAttribute('aria-hidden', 'false');
    } else {
      fab.setAttribute('hidden', '');
      fab.style.display = 'none';
      fab.setAttribute('aria-hidden', 'true');
    }
  }
  document.documentElement.classList.toggle('lab-copy-fab-active', visible);
}

export function labOutputHasCopyableContent() {
  var sec = document.getElementById('lab-output-section');
  return !!(
    sec &&
    sec.style.display !== 'none' &&
    activeLab &&
    activeLab.resLabs &&
    activeLab.resLabs.length
  );
}

registerLabSomeTablesModalRuntime({
  showToast: function (msg, kind) {
    rt.showToast(msg, kind);
  },
  getParsed: function () {
    return activeLab && activeLab.someTablesParsed ? activeLab.someTablesParsed : null;
  },
  isPaseMode: isPaseMode,
  syncLabCopyFab: syncLabCopyFab,
  syncLabOutputChrome: function () {
    syncLabOutputChrome();
  },
});

export function syncLabOutputChrome() {
  var sec = document.getElementById('lab-output-section');
  var outputVisible = !!(sec && sec.style.display !== 'none');
  if (isPaseMode()) {
    syncLabCopyFab(false);
    syncLabSomeTablesBtn(false);
    closeLabSomeTablesModal();
    return;
  }
  var hasSome = !!(
    activeLab &&
    activeLab.someTablesParsed &&
    activeLab.someTablesParsed.departments &&
    activeLab.someTablesParsed.departments.length
  );
  var show = outputVisible && isLabAppTabActive();
  syncLabCopyFab(show);
  syncLabSomeTablesBtn(show && hasSome);
}

export { openLabSomeTablesModal, closeLabSomeTablesModal };

export function closeLabHistoryMoreMenu() {
  document.querySelectorAll('.lab-history-more[open], .lab-output-more[open]').forEach(function (d) {
    d.removeAttribute('open');
  });
}

export function clearLabWorkbenchMinimalDom() {
  var b = document.getElementById('lab-banner');
  if (b) b.style.display = 'none';
  var sec = document.getElementById('lab-output-section');
  if (sec) sec.style.display = 'none';
  var box = document.getElementById('lab-output-box');
  if (box) box.innerHTML = '';
  var ta = document.getElementById('lab-input');
  if (ta) ta.value = '';
  syncLabOutputChrome();
}

export {
  renderLabHistoryPanel,
  setLabHistoryPanelCollapsed,
  syncLabHistoryCollapseUI,
  expandLabHistoryList,
  limpiarReporte,
  enviarLabsANota,
  applyDriveImportLabSets,
  insertLabPatientSeparator,
};

export const windowHandlers = {
  procesarReporte,
  clearLabInputAfterSuccessfulParse,
  limpiarReporte,
  replayLabHistorySet,
  reprocessLabHistorySet,
  deleteLabHistorySet,
  deleteAllLabHistorySets,
  toggleLabHistoryPanel,
  syncLabHistoryCollapseUI,
  setLabHistoryPanelCollapsed,
  labHistoryPanelIsCollapsed,
  copiarLabsAlPortapapeles,
  openLabSomeTablesModal,
  closeLabSomeTablesModal,
  closeLabHistoryMoreMenu,
  openLabPatientPicker,
  openLabHistoryDedupeReview,
  expandLabHistoryList,
  consolidateLabHistoryByDayAndTipo,
  insertLabPatientSeparator,
  onLabHistoryDateChange,
  reprocessSelectedLabHistorySet,
  deleteSelectedLabHistorySet,
  openLabRepoImportModal,
  closeLabRepoImportModal,
  confirmLabRepoImport,
};
