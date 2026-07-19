import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { assignSomePharmCategories } from '../med-pharm-some-catalog.mjs';
import {
  mergeRecetaIntoMonth,
  ensureMonthOnProfile,
  monthKeyFromParts,
  monthHasData,
  profileHasMonthData,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  getViewMonth,
  reclassifyMonthIfLegacy,
  groupMatchesCategoryFilter,
  displayGroupsForWindow,
  countHiddenGroups,
  renderFilterSelect,
} from './med-pharm-profile-state.mjs';
import { wireMedPharmAdhHoverOnce } from './med-pharm-profile-adh.mjs';
import {
  wireMedPharmModalDismiss,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  openMedPharmMedGroupModal,
  importMedPharmMonthPaste,
  onActivePatientChangedForPharm,
} from './med-pharm-profile-modals.mjs';
import { initMedPharmSubviewUiShell } from './med-pharm-profile-subview.mjs';
import {
  updateMedPharmLastPasteEl,
  renderMedPharmNoPatientState,
  renderMedPharmEmptyColumns,
  renderMedPharmEmptyFilter,
  renderMedPharmSummaryList,
} from './med-pharm-profile-render-helpers.mjs';

function setMedPharmMedGroupHidden(pid, rowKeys, hidden) {
  var profile = getProfile(pid);
  if (!profile || !profile.months || !rowKeys || !rowKeys.length) return;
  var keySet = Object.create(null);
  rowKeys.forEach(function (rk) {
    keySet[rk] = true;
  });
  Object.keys(profile.months).forEach(function (mk) {
    var month = profile.months[mk];
    if (!month || !month.rows) return;
    month.rows.forEach(function (row) {
      if (!keySet[row.rowKey]) return;
      if (hidden) row.hidden = true;
      else delete row.hidden;
    });
  });
  saveState();
  renderMedPharmProfilePanel();
  var fullEl = document.getElementById('med-pharm-modal-full');
  if (fullEl && fullEl.classList.contains('open')) openMedPharmFullModal();
}

function updateMedPharmDeleteToolbar(profile) {
  var more = document.getElementById('med-pharm-output-more');
  var btnMonth = document.getElementById('med-pharm-delete-month-btn');
  var btnAll = document.getElementById('med-pharm-delete-all-btn');
  var hasProfile = !!(profile && (profileHasMonthData(profile) || profile.draftPaste));
  if (more) more.hidden = !hasProfile;
  if (btnMonth) btnMonth.disabled = !monthHasData(profile, mp.viewYear, mp.viewMonthIndex);
  if (btnAll) btnAll.disabled = !hasProfile;
}

function wireUiOnce() {
  wireMedPharmModalDismiss();
  wireMedPharmAdhHoverOnce();
  if (mp.uiWired) return;
  mp.uiWired = true;
  var pasteOpen = document.getElementById('med-pharm-paste-open-btn');
  if (pasteOpen) pasteOpen.addEventListener('click', openMedPharmPasteModal);
  var imp = document.getElementById('med-pharm-import-btn');
  if (imp) imp.addEventListener('click', importMedPharmMonthPaste);
  var full = document.getElementById('med-pharm-full-btn');
  if (full) full.addEventListener('click', openMedPharmFullModal);
  var prev = document.getElementById('med-pharm-month-prev');
  var next = document.getElementById('med-pharm-month-next');
  if (prev) {
    prev.addEventListener('click', function () {
      shiftViewMonth(-1);
    });
  }
  if (next) {
    next.addEventListener('click', function () {
      shiftViewMonth(1);
    });
  }
  var filtro = document.getElementById('med-pharm-filtro');
  if (filtro) {
    filtro.addEventListener('change', function () {
      mp.listFilter = filtro.value;
      renderMedPharmProfilePanel();
    });
  }
  var showHidden = document.getElementById('med-pharm-show-hidden');
  if (showHidden) {
    showHidden.addEventListener('change', function () {
      mp.showHiddenMedRows = !!showHidden.checked;
      renderMedPharmProfilePanel();
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-med-pharm-close]')) return;
    var hideBtn = e.target.closest('[data-med-pharm-hide-group]');
    if (hideBtn && hideBtn.dataset.medPharmHideGroup) {
      var pidHide = mp.rt.getActiveId();
      if (pidHide) {
        setMedPharmMedGroupHidden(pidHide, hideBtn.dataset.medPharmHideGroup.split('\t'), true);
      }
      return;
    }
    var unhideBtn = e.target.closest('[data-med-pharm-unhide-group]');
    if (unhideBtn && unhideBtn.dataset.medPharmUnhideGroup) {
      var pidShow = mp.rt.getActiveId();
      if (pidShow) {
        setMedPharmMedGroupHidden(pidShow, unhideBtn.dataset.medPharmUnhideGroup.split('\t'), false);
      }
      return;
    }
  });
}

export function initMedPharmSubviewUi() {
  initMedPharmSubviewUiShell(wireUiOnce);
}

function shiftViewMonth(delta) {
  mp.viewMonthIndex += delta;
  if (mp.viewMonthIndex < 0) {
    mp.viewMonthIndex = 11;
    mp.viewYear -= 1;
  }
  if (mp.viewMonthIndex > 11) {
    mp.viewMonthIndex = 0;
    mp.viewYear += 1;
  }
  renderMedPharmProfilePanel();
}

export function renderMedPharmProfilePanel() {
  initMedPharmSubviewUi();
  if (mp.medSubview !== 'perfil') return;
  var pid = mp.rt.getActiveId();
  onActivePatientChangedForPharm(pid);
  var hint = document.getElementById('med-pharm-hint');
  var list = document.getElementById('med-pharm-list');
  var label = document.getElementById('med-pharm-month-label');
  if (!list) return;
  if (!pid) {
    renderMedPharmNoPatientState(hint, list);
    updateMedPharmDeleteToolbar(null);
    return;
  }
  if (hint) hint.style.display = 'none';
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (label) label.textContent = window.label;
  updateMedPharmLastPasteEl(
    document.getElementById('med-pharm-last-paste'),
    reclassifyMonthIfLegacy(pid, getViewMonth(pid))
  );
  var unifiedRows = unifyRowsForWindow(profile, window.columns);
  var allGroups = groupUnifiedRowsByMed(unifiedRows, profile, window.columns);
  var groups = displayGroupsForWindow(profile, window);
  var hiddenCount = countHiddenGroups(allGroups.filter(groupMatchesCategoryFilter));
  renderFilterSelect(document.getElementById('med-pharm-filtro'));
  updateMedPharmHiddenToolbar(hiddenCount);
  updateMedPharmDeleteToolbar(profile);
  var card = document.querySelector('.med-pharm-profile-card');
  var listHead = document.querySelector('.med-pharm-list-head');
  if (!window.columns.length) {
    renderMedPharmEmptyColumns(list, window, card, listHead);
    return;
  }
  if (!groups.length) {
    renderMedPharmEmptyFilter(list, hiddenCount, card, listHead, mp.showHiddenMedRows);
    return;
  }
  if (card) card.classList.remove('med-pharm-has-grid');
  if (listHead) listHead.style.display = '';
  list.className = 'med-pharm-list-body';
  renderMedPharmSummaryList(list, groups, window, profile);
}

function updateMedPharmHiddenToolbar(hiddenCount) {
  var wrap = document.getElementById('med-pharm-show-hidden-wrap');
  var cb = document.getElementById('med-pharm-show-hidden');
  var countEl = document.getElementById('med-pharm-hidden-count');
  if (countEl) countEl.textContent = String(hiddenCount);
  if (wrap) wrap.hidden = hiddenCount < 1;
  if (cb) {
    cb.checked = mp.showHiddenMedRows;
    cb.disabled = hiddenCount < 1;
  }
}

export function onRecetaMergedToProfile(patientId, recetaBlock) {
  if (!patientId || !recetaBlock || !recetaBlock.items || !recetaBlock.items.length) return;
  var fecha = recetaBlock.fechaActualizacion;
  if (!fecha) return;
  var parts = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) return;
  var year = parseInt(parts[3], 10);
  var monthIndex = parseInt(parts[2], 10) - 1;
  var profile = getProfile(patientId) || { months: {} };
  var withMonth = ensureMonthOnProfile(profile, year, monthIndex);
  var key = monthKeyFromParts(year, monthIndex);
  var month = withMonth.months[key];
  month = mergeRecetaIntoMonth(month, recetaBlock.items, fecha);
  month.rows = assignSomePharmCategories(month.rows);
  withMonth.months[key] = month;
  medPharmProfileByPatient[patientId] = withMonth;
  saveState();
  if (mp.medSubview === 'perfil' && mp.viewYear === year && mp.viewMonthIndex === monthIndex) {
    renderMedPharmProfilePanel();
  }
}

medPharmProfileBridge.renderMedPharmProfilePanel = renderMedPharmProfilePanel;
medPharmProfileBridge.openMedPharmFullModal = openMedPharmFullModal;
medPharmProfileBridge.openMedPharmMedGroupModal = openMedPharmMedGroupModal;
medPharmProfileBridge.openMedPharmPasteModal = openMedPharmPasteModal;
medPharmProfileBridge.importMedPharmMonthPaste = importMedPharmMonthPaste;
