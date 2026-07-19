#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const w = (rel, s) => fs.writeFileSync(path.join(root, rel), (s.endsWith('\n') ? s : s + '\n'));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const lines = (rel) => read(rel).split('\n');
const slice = (rel, a, b) => lines(rel).slice(a, b).join('\n');

const MP = 'public/js/features/med-pharm-profile-panel.mjs';
const TG = 'public/js/tend-group-modal.mjs';

// ─── med-pharm: shared mutable UI state in one object ───────────────────────

w(
  'public/js/features/med-pharm-profile-bridge.mjs',
  `/** Late-bound render/modal refs to avoid grid ↔ render ↔ modals cycles. */
export const medPharmProfileBridge = {
  renderMedPharmProfilePanel() {},
  openMedPharmFullModal() {},
  openMedPharmMedGroupModal(_medGroupKey) {},
  openMedPharmPasteModal() {},
  importMedPharmMonthPaste() {},
};
`
);

w(
  'public/js/features/med-pharm-profile-state.mjs',
  `import { medPharmProfileByPatient, saveState, patients } from '../app-state.mjs';
import {
  listSomePharmFilterLabels,
  isSomePharmCategoryLabel,
  rowSomePharmCategory,
  assignSomePharmCategory,
} from '../med-pharm-some-catalog.mjs';
import {
  getMonthFromProfile,
  isMedPharmRowHidden,
  formatFreqShort,
  formatViaShort,
  profileHasMonthData,
} from '../med-pharm-profile-core.mjs';
import {
  buildPharmViewWindow,
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
  cellValueAtColumn,
} from '../med-pharm-view-window.mjs';

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MONTH_ABBR = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Mutable panel UI state (safe to assign from sibling modules). */
export const mp = {
  rt: {
    getActiveId() { return null; },
    showToast() {},
    refreshMedPanel() {},
  },
  medSubview: 'receta',
  viewYear: new Date().getFullYear(),
  viewMonthIndex: new Date().getMonth(),
  listFilter: 'TODOS',
  showHiddenMedRows: false,
  openMedGroupKey: null,
  uiWired: false,
  dismissWired: false,
  lastPharmPanelPatientId: null,
};

export function registerMedPharmProfileRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(mp.rt, ctx);
}

export function getMedSubview() {
  return mp.medSubview;
}

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function monthLabel(year, monthIndex) {
  return MONTH_NAMES[monthIndex] + ' ' + year;
}

function todayParts() {
  var t = new Date();
  return { year: t.getFullYear(), monthIndex: t.getMonth(), day: t.getDate() };
}

export function isToday(year, monthIndex, day) {
  var t = todayParts();
  return t.year === year && t.monthIndex === monthIndex && t.day === day;
}

export function getProfile(pid) {
  return medPharmProfileByPatient[pid] || null;
}

export function isDemoPatientId(patientId) {
  return String(patientId || '').indexOf('demo-') === 0;
}

export function getViewMonth(pid) {
  var profile = getProfile(pid);
  if (!profile) return null;
  return getMonthFromProfile(profile, mp.viewYear, mp.viewMonthIndex);
}

function getFimiFechaForPatient(patientId) {
  var patient = patients.find(function (p) {
    return p.id === patientId;
  });
  return patient ? patient.fimiFecha : '';
}

export function getViewWindow(pid) {
  var profile = getProfile(pid);
  return buildPharmViewWindow({
    profile: profile || { months: {} },
    viewYear: mp.viewYear,
    viewMonthIndex: mp.viewMonthIndex,
    today: todayParts(),
    fimiFecha: getFimiFechaForPatient(pid),
  });
}

function monthRowForColumn(profile, rowKey, column) {
  var month = profile && profile.months ? profile.months[column.monthKey] : null;
  if (!month || !month.rows) return null;
  for (var i = 0; i < month.rows.length; i += 1) {
    if (month.rows[i].rowKey === rowKey) return month.rows[i];
  }
  return null;
}

export function notAdminAtColumn(profile, rowKey, column) {
  var row = monthRowForColumn(profile, rowKey, column);
  if (!row || !row.notAdmin) return false;
  return !!(row.notAdmin[column.day] || row.notAdmin[String(column.day)]);
}

export function windowHasMultipleMonths(columns) {
  if (!columns || columns.length < 2) return false;
  var mk = columns[0].monthKey;
  for (var i = 1; i < columns.length; i += 1) {
    if (columns[i].monthKey !== mk) return true;
  }
  return false;
}

function needsSomePharmReclassify(row) {
  if (!row || row.catOverride) return false;
  var c = String(row.cat || '').toUpperCase();
  if (!c) return true;
  if (!isSomePharmCategoryLabel(c)) return true;
  var legacy = ['ABX', 'ANALGESIA', 'VASOP', 'ANTIHTA'];
  return legacy.indexOf(c) >= 0;
}

export function reclassifyMonthIfLegacy(pid, month) {
  if (!month || !month.rows) return month;
  var changed = false;
  month.rows.forEach(function (row) {
    if (!needsSomePharmReclassify(row)) return;
    var next = assignSomePharmCategory(row);
    row.cat = next.cat;
    changed = true;
  });
  if (changed) saveState();
  return month;
}

export function formatViaListAbbrev(raw) {
  var v = formatViaShort(raw).toUpperCase();
  if (!v || v === '—') return '—';
  if (v.indexOf('INTRAVEN') >= 0) return 'IV';
  if (v === 'IV') return 'IV';
  if (v.indexOf('ORAL') >= 0) return 'VO';
  if (v.indexOf('SUBCUT') >= 0) return 'SC';
  if (v.indexOf('INTRAMUS') >= 0) return 'IM';
  if (v.indexOf('INHAL') >= 0) return 'INH';
  if (v.indexOf('TOPIC') >= 0) return 'TOP';
  if (v.length > 5) return v.slice(0, 4);
  return v;
}

export function medGroupListTooltip(group) {
  var lines = [];
  group.variants.forEach(function (v) {
    var head = v.med || group.med || '';
    var part = [v.dosis, formatFreqShort(v.freq), formatViaShort(v.via)].filter(Boolean).join(' · ');
    lines.push(part ? head + ' — ' + part : head);
  });
  return lines.join('\\n');
}

${slice(MP, 595, 651)}

${slice(MP, 652, 673).replace('renderMedPharmProfilePanel()', '/* render via bridge in render module */').replace('openMedPharmFullModal()', '/* modal via bridge */')}

// setMedPharmMedGroupHidden body removed from state — lives in render module

${slice(MP, 674, 703)}

export function persistMedPharmProfile(pid, profile) {
  if (!profile || (!profileHasMonthData(profile) && !profile.draftPaste)) {
    delete medPharmProfileByPatient[pid];
  } else {
    medPharmProfileByPatient[pid] = profile;
  }
}

export function closeMedPharmMoreMenu() {
  var d = document.querySelector('.med-pharm-output-more[open]');
  if (d) d.removeAttribute('open');
}
`
);

// Remove broken setMedPharmMedGroupHidden stub from state - the slice 652-673 included it
// Let me fix state file - don't include setMedPharmMedGroupHidden at all

const stateContent = read('public/js/features/med-pharm-profile-state.mjs')
  .replace(/function setMedPharmMedGroupHidden[\s\S]*?\/\* modal via bridge \*\/\n\}/, '')
  .replace('// setMedPharmMedGroupHidden body removed from state — lives in render module\n\n', '');
w('public/js/features/med-pharm-profile-state.mjs', stateContent);

w(
  'public/js/features/med-pharm-profile-stash.mjs',
  `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { profileHasMonthData } from '../med-pharm-profile-core.mjs';
import { getProfile, isDemoPatientId } from './med-pharm-profile-state.mjs';

${slice(MP, 159, 179)}
`
);

w(
  'public/js/features/med-pharm-profile-subview.mjs',
  `import { syncTabBarIndicator } from '../ui-tab-motion.mjs';
import { mp, getMedSubview } from './med-pharm-profile-state.mjs';

function syncSubviewVisibility() {
  var receta = document.getElementById('med-subview-receta');
  var perfil = document.getElementById('med-subview-perfil');
  if (receta) receta.style.display = mp.medSubview === 'receta' ? '' : 'none';
  if (perfil) perfil.style.display = mp.medSubview === 'perfil' ? '' : 'none';
  var recetaTab = document.getElementById('med-itab-receta');
  var perfilTab = document.getElementById('med-itab-perfil');
  if (recetaTab) {
    var onReceta = mp.medSubview === 'receta';
    recetaTab.classList.toggle('active', onReceta);
    recetaTab.setAttribute('aria-selected', onReceta ? 'true' : 'false');
  }
  if (perfilTab) {
    var onPerfil = mp.medSubview === 'perfil';
    perfilTab.classList.toggle('active', onPerfil);
    perfilTab.setAttribute('aria-selected', onPerfil ? 'true' : 'false');
  }
  var bar = document.getElementById('med-subview-tabs-bar');
  var activeTab = mp.medSubview === 'perfil' ? perfilTab : recetaTab;
  syncTabBarIndicator(bar, activeTab);
}

export function setMedSubview(mode) {
  if (mode !== 'receta' && mode !== 'perfil') return;
  mp.medSubview = mode;
  syncSubviewVisibility();
  mp.rt.refreshMedPanel();
}

export function initMedPharmSubviewUiShell(wireUiOnce) {
  wireUiOnce();
  syncSubviewVisibility();
}

export { syncSubviewVisibility, getMedSubview };
`
);

w(
  'public/js/features/med-pharm-profile-adh.mjs',
  `import { cellValueAtColumn } from '../med-pharm-view-window.mjs';
import {
  esc,
  monthLabel,
  mp,
  notAdminAtColumn,
  windowHasMultipleMonths,
  MONTH_ABBR,
} from './med-pharm-profile-state.mjs';

${slice(MP, 274, 330)}

${slice(MP, 331, 454)}

${slice(MP, 455, 594)}
`
);

// Add exports to adh
const adh = read('public/js/features/med-pharm-profile-adh.mjs')
  .replace(/monthLabel\(viewYear, viewMonthIndex\)/g, 'monthLabel(mp.viewYear, mp.viewMonthIndex)')
  .replace(/var monthTitle = windowLabel \|\| monthLabel\(viewYear, viewMonthIndex\)/g,
    'var monthTitle = windowLabel || monthLabel(mp.viewYear, mp.viewMonthIndex)');
w('public/js/features/med-pharm-profile-adh.mjs', adh + `
export {
  buildAdhTriggerHtml,
  buildAdhTriggerHtmlForGroup,
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  wireMedPharmAdhHoverOnce,
  adherenceStatsForWindow,
};
`);

w(
  'public/js/features/med-pharm-profile-grid.mjs',
  `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { formatFreqShort, formatViaShort } from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
  toggleNotAdminAtColumn,
  makeColumn,
  adherenceStatsForRowKeys,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  isToday,
  MONTH_ABBR,
  displayRowsForWindow,
} from './med-pharm-profile-state.mjs';
import {
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  adherenceStatsForWindow,
} from './med-pharm-profile-adh.mjs';

${slice(MP, 704, 782).replace(/rt\./g, 'mp.rt.')}

function onGridDayClick(rowKey, year, monthIndex, day) {
  var pid = mp.rt.getActiveId();
  if (!pid) return;
  var col = makeColumn(year, monthIndex, day);
  var profile = getProfile(pid) || { months: {} };
  profile = toggleNotAdminAtColumn(profile, rowKey, col);
  medPharmProfileByPatient[pid] = profile;
  saveState();
  refreshOpenMedPharmGrids();
  medPharmProfileBridge.renderMedPharmProfilePanel();
}

${slice(MP, 783, 808).replace(/rt\./g, 'mp.rt.').replace(/openMedGroupKey/g, 'mp.openMedGroupKey')}

${slice(MP, 809, 921)}
`
);

w(
  'public/js/features/med-pharm-profile-modals.mjs',
  `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import {
  parseSomePharmMonthPaste,
  looksLikeSomePharmMonthPaste,
  applySomePasteToProfile,
  deleteMonthFromProfile,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
} from '../med-pharm-view-window.mjs';
import { monthHasData, profileHasMonthData } from '../med-pharm-profile-core.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  monthLabel,
  persistMedPharmProfile,
  closeMedPharmMoreMenu,
  displayRowsForWindow,
  countHiddenInCategoryFilter,
} from './med-pharm-profile-state.mjs';
import { mountSomeGrid, buildMedGroupModalSubtitle } from './med-pharm-profile-grid.mjs';

${slice(MP, 922, 936).replace(/openMedGroupKey = null/g, 'mp.openMedGroupKey = null')}

${slice(MP, 937, 950)}

export function closeMedPharmModals() {
  closeModals();
}

export function wireMedPharmModalDismiss() {
  if (mp.dismissWired) return;
  mp.dismissWired = true;
${slice(MP, 955, 978)}
}

export function onActivePatientChangedForPharm(pid) {
  if (pid === mp.lastPharmPanelPatientId) return;
  mp.lastPharmPanelPatientId = pid;
  closeModals();
}

${slice(MP, 986, 1002).replace(/rt\./g, 'mp.rt.')}

${slice(MP, 1028, 1083)
  .replace(/rt\./g, 'mp.rt.')
  .replace(/viewYear/g, 'mp.viewYear')
  .replace(/viewMonthIndex/g, 'mp.viewMonthIndex')
  .replace(/renderMedPharmProfilePanel\(\)/g, 'medPharmProfileBridge.renderMedPharmProfilePanel()')}

${slice(MP, 1374, 1462)
  .replace(/rt\./g, 'mp.rt.')
  .replace(/listFilter/g, 'mp.listFilter')
  .replace(/openMedGroupKey = medGroupKey/g, 'mp.openMedGroupKey = medGroupKey')
  .replace(/viewYear/g, 'mp.viewYear')
  .replace(/viewMonthIndex/g, 'mp.viewMonthIndex')
  .replace(/renderMedPharmProfilePanel\(\)/g, 'medPharmProfileBridge.renderMedPharmProfilePanel()')}
`
);

// Fix modals - remove duplicate wireMedPharmModalDismiss wrapper from slice
let modals = read('public/js/features/med-pharm-profile-modals.mjs');
modals = modals.replace(/function wireMedPharmModalDismiss\(\) \{\n  if \(dismissWired\) return;\n  dismissWired = true;\n/g, '');
modals = modals.replace('export function wireMedPharmModalDismiss() {\n  if (mp.dismissWired) return;\n  mp.dismissWired = true;\n  document.addEventListener(', 
  'export function wireMedPharmModalDismiss() {\n  if (mp.dismissWired) return;\n  mp.dismissWired = true;\n  document.addEventListener(');
w('public/js/features/med-pharm-profile-modals.mjs', modals);

w(
  'public/js/features/med-pharm-profile-render.mjs',
  `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { rowSomePharmCategory, assignSomePharmCategories } from '../med-pharm-some-catalog.mjs';
import {
  mergeRecetaIntoMonth,
  ensureMonthOnProfile,
  monthKeyFromParts,
  formatFreqShort,
  formatViaShort,
  monthHasData,
  profileHasMonthData,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
  adherenceStatsForRowKeys,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  getViewMonth,
  esc,
  reclassifyMonthIfLegacy,
  formatViaListAbbrev,
  medGroupListTooltip,
  groupMatchesCategoryFilter,
  displayGroupsForWindow,
  countHiddenGroups,
  isMedPharmGroupHidden,
  renderFilterSelect,
} from './med-pharm-profile-state.mjs';
import {
  buildAdhTriggerHtmlForGroup,
  wireMedPharmAdhHoverPanels,
  wireMedPharmAdhHoverOnce,
} from './med-pharm-profile-adh.mjs';
import {
  wireMedPharmModalDismiss,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  openMedPharmMedGroupModal,
  importMedPharmMonthPaste,
  onActivePatientChangedForPharm,
} from './med-pharm-profile-modals.mjs';
import { initMedPharmSubviewUiShell } from './med-pharm-profile-subview.mjs';

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

${slice(MP, 1084, 1093).replace(/viewYear/g, 'mp.viewYear').replace(/viewMonthIndex/g, 'mp.viewMonthIndex')}

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
        setMedPharmMedGroupHidden(pidHide, hideBtn.dataset.medPharmHideGroup.split('\\t'), true);
      }
      return;
    }
    var unhideBtn = e.target.closest('[data-med-pharm-unhide-group]');
    if (unhideBtn && unhideBtn.dataset.medPharmUnhideGroup) {
      var pidShow = mp.rt.getActiveId();
      if (pidShow) {
        setMedPharmMedGroupHidden(pidShow, unhideBtn.dataset.medPharmUnhideGroup.split('\\t'), false);
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
    if (hint) {
      hint.style.display = 'block';
      hint.textContent = 'Selecciona un paciente para ver el perfil farmacoterapéutico.';
    }
    list.innerHTML = '';
    updateMedPharmDeleteToolbar(null);
    return;
  }
  if (hint) hint.style.display = 'none';
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (label) label.textContent = window.label;
  var lastPasteEl = document.getElementById('med-pharm-last-paste');
  var month = reclassifyMonthIfLegacy(pid, getViewMonth(pid));
  if (lastPasteEl) {
    var pasted = month && month.lastSomePasteAt;
    if (pasted) {
      var d = new Date(pasted);
      lastPasteEl.textContent =
        'Último pegado: ' +
        String(d.getDate()).padStart(2, '0') +
        '/' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '/' +
        d.getFullYear();
      lastPasteEl.hidden = false;
    } else {
      lastPasteEl.hidden = true;
    }
  }
  var unifiedRows = unifyRowsForWindow(profile, window.columns);
  var allGroups = groupUnifiedRowsByMed(unifiedRows, profile, window.columns);
  var groups = displayGroupsForWindow(profile, window);
  var hiddenCount = countHiddenGroups(allGroups.filter(groupMatchesCategoryFilter));
  var filtro = document.getElementById('med-pharm-filtro');
  renderFilterSelect(filtro);
  updateMedPharmHiddenToolbar(hiddenCount);
  updateMedPharmDeleteToolbar(profile);
  var card = document.querySelector('.med-pharm-profile-card');
  var listHead = document.querySelector('.med-pharm-list-head');
  if (!window.columns.length) {
    if (card) card.classList.remove('med-pharm-has-grid');
    if (listHead) listHead.style.display = '';
    list.className = 'med-pharm-list-body';
    list.innerHTML =
      '<div class="med-pharm-empty">' +
      '<p class="med-pharm-empty-title">Sin datos para ' +
      esc(window.label) +
      '</p>' +
      '<p class="med-pharm-empty-lead">Importa la matriz SOME del hospital o procesa <strong>Receta</strong> en la pestaña Manejo actual.</p>' +
      '<button type="button" class="btn-generate" data-med-pharm-open-paste>Importar mes SOME</button>' +
      '</div>';
    list.querySelector('[data-med-pharm-open-paste]').addEventListener('click', openMedPharmPasteModal);
    return;
  }
  if (!groups.length) {
    if (card) card.classList.remove('med-pharm-has-grid');
    if (listHead) listHead.style.display = hiddenCount > 0 && mp.showHiddenMedRows ? '' : 'none';
    list.className = 'med-pharm-list-body';
    list.innerHTML =
      '<div class="med-pharm-empty med-pharm-empty--filter">' +
      '<p class="med-pharm-empty-title">Ningún medicamento visible</p>' +
      '<p class="med-pharm-empty-lead">' +
      (hiddenCount > 0
        ? 'Hay ' + hiddenCount + ' oculto(s) con este filtro. Activa <strong>Mostrar ocultos</strong> para verlos o restaurarlos.'
        : 'Prueba otro filtro de categoría.') +
      '</p>' +
      '</div>';
    return;
  }
  if (card) card.classList.remove('med-pharm-has-grid');
  if (listHead) listHead.style.display = '';
  list.className = 'med-pharm-list-body';
  renderMedPharmSummaryList(list, groups, window, profile);
}

${slice(MP, 1268, 1373)}

export function onRecetaMergedToProfile(patientId, recetaBlock) {
  if (!patientId || !recetaBlock || !recetaBlock.items || !recetaBlock.items.length) return;
  var fecha = recetaBlock.fechaActualizacion;
  if (!fecha) return;
  var parts = fecha.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
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
`
);

// Fix render - add buildMedGroupModalSubtitle to grid export, fix updateMedPharmHiddenToolbar
let renderFix = read('public/js/features/med-pharm-profile-render.mjs');
renderFix = renderFix.replace(
  slice(MP, 1268, 1278).replace(/showHiddenMedRows/g, 'mp.showHiddenMedRows'),
  `function updateMedPharmHiddenToolbar(hiddenCount) {
  var wrap = document.getElementById('med-pharm-show-hidden-wrap');
  var cb = document.getElementById('med-pharm-show-hidden');
  var countEl = document.getElementById('med-pharm-hidden-count');
  if (countEl) countEl.textContent = String(hiddenCount);
  if (wrap) wrap.hidden = hiddenCount < 1;
  if (cb) {
    cb.checked = mp.showHiddenMedRows;
    cb.disabled = hiddenCount < 1;
  }
}`
);
w('public/js/features/med-pharm-profile-render.mjs', renderFix);

// Add buildMedGroupModalSubtitle to grid
let grid = read('public/js/features/med-pharm-profile-grid.mjs');
if (!grid.includes('buildMedGroupModalSubtitle')) {
  grid += `
export function buildMedGroupModalSubtitle(profile, window, variantRows) {
  var rowKeys = variantRows.map(function (r) { return r.rowKey; });
  var stats = adherenceStatsForRowKeys(profile, rowKeys, window.columns);
  var parts = [window.label];
  if (variantRows.length > 1) {
    parts.push(variantRows.length + ' regímenes (dosis distintas)');
  } else {
    var row = variantRows[0];
    if (row.dosis) parts.push(row.dosis);
    parts.push(formatFreqShort(row.freq) + ' · ' + formatViaShort(row.via));
  }
  parts.push(stats.effective + ' d efectivos');
  return parts.join(' · ');
}
`;
  w('public/js/features/med-pharm-profile-grid.mjs', grid);
}

w(
  'public/js/features/med-pharm-profile-panel.mjs',
  `/**
 * UI Perfil farmacoterapéutico (subvista Medicamentos). Barrel — lógica en submódulos.
 */
export { registerMedPharmProfileRuntime, getMedSubview, closeMedPharmMoreMenu } from './med-pharm-profile-state.mjs';
export { setMedSubview } from './med-pharm-profile-subview.mjs';
export { initMedPharmSubviewUi, renderMedPharmProfilePanel, onRecetaMergedToProfile } from './med-pharm-profile-render.mjs';
export { stashMedPharmPasteForPatient } from './med-pharm-profile-stash.mjs';
export {
  closeMedPharmModals,
  openMedPharmPasteModal,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
  openMedPharmMedGroupModal,
  openMedPharmFullModal,
  importMedPharmMonthPaste,
} from './med-pharm-profile-modals.mjs';

import { setMedSubview } from './med-pharm-profile-subview.mjs';
import {
  importMedPharmMonthPaste,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  closeMedPharmModals,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
} from './med-pharm-profile-modals.mjs';
import { closeMedPharmMoreMenu } from './med-pharm-profile-state.mjs';

export const medPharmProfileWindowHandlers = {
  setMedSubview,
  importMedPharmMonthPaste,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  closeMedPharmModals,
  closeMedPharmMoreMenu,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
};
`
);

// ─── tend-group-modal (reuse helpers if present, else create) ───────────────

if (!fs.existsSync(path.join(root, 'public/js/tend-group-chart-helpers.mjs'))) {
  w('public/js/tend-group-chart-helpers.mjs', `import { migratePanelFamilyKey, familyOrderForSection, colKeyForTrendSet } from './tend-core.mjs';
const GENERIC_FAMILY_ORDER = ['gases', 'percent-diff', 'percent-rbc', 'absolute'];
${slice(TG, 44, 177)}
export { GENERIC_FAMILY_ORDER, roundAxisBound, formatAxisTickValue, yScaleBoundsForDatasets, visibleDatasetsForChart, applyChartYScale, tendPanelEyeSvg, orderPanelFamilies, formatTrendDisplayValue, colKeyForSet, toAscendingHistory, hexToRgba };
`);
}

w('public/js/tend-group-table.mjs', `import {
  getSetTrendValueForSeries,
  buildSectionTableModel,
  formatTrendColumnHeader,
  formatTendSeriesLabel,
} from './tend-core.mjs';
import { readGroupTableHidden, writeGroupTableHidden } from './tend-prefs.mjs';
import { formatTrendDisplayValue, colKeyForSet } from './tend-group-chart-helpers.mjs';

export function createTendGroupTableApi(deps, state) {
${slice(TG, 347, 638)}
  return { renderTable, buildTableExportModel, formatCellValue, columnHeader, legendLabelForSpec };
}
`);

w('public/js/tend-group-gaso.mjs', `import { sortLabHistoryChronological, getSetTrendValueForSeries } from './tend-core.mjs';
import { evaluateGasoExtended } from './gaso-extended.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from './ui-motion.mjs';

function isAbgAnalysisHidden() { return true; }

export function createTendGroupGasoApi(deps, state) {
  function serieNumFromLabSet(set, sec, fk) {
    var v = getSetTrendValueForSeries(set, sec, fk);
    return v != null && isFinite(v) ? v : null;
  }
${slice(TG, 680, 1035)}
  return { openGasoExtended, closeGasoExtended };
}
`);

w('public/js/tend-group-charts.mjs', `import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  buildTrendAxisMeta,
  classifyTendPanelFamily,
  familyOrderForSection,
  BH_PANEL_FAMILIES,
  migratePanelFamilyKey,
  isPercentPanelFamily,
  formatTendSeriesLabel,
  columnSetsForFields,
} from './tend-core.mjs';
import {
  readSeriesColor,
  writeSeriesColor,
  readGroupVisibleFields,
  writeGroupVisibleFields,
  readGroupPanelOrder,
  writeGroupPanelOrder,
  readGroupPanelHidden,
  readGroupPanelHiddenMigrated,
  writeGroupPanelHidden,
  resolvePanelTitle,
  writeGroupPanelTitle,
  defaultSeriesColor,
} from './tend-prefs.mjs';
import {
  GENERIC_FAMILY_ORDER,
  applyChartYScale,
  tendPanelEyeSvg,
  orderPanelFamilies,
  formatTrendDisplayValue,
  hexToRgba,
  formatAxisTickValue,
  yScaleBoundsForDatasets,
} from './tend-group-chart-helpers.mjs';

export function createTendGroupChartsApi(deps, state, tableApi) {
  var legendLabelForSpec = tableApi.legendLabelForSpec;
  var _panelSortable = null;

  function destroyCharts() {
    state.charts.forEach(function (ch) { if (ch) ch.destroy(); });
    state.charts = [];
  }
${slice(TG, 201, 355)}
  function persistLegendVisible(sectionKey) {
    var vis = [];
    document.querySelectorAll('#tend-group-backdrop .tend-group-legend-check:checked').forEach(function (cb) {
      var fk = cb.getAttribute('data-field');
      if (fk && vis.indexOf(fk) < 0) vis.push(fk);
    });
    if (vis.length) {
      writeGroupVisibleFields(state.patientId, sectionKey, vis);
      state.visibleFields = vis.slice();
    }
  }
  function seriesColor(sectionKey, fieldKey, index) {
    return readSeriesColor(sectionKey, fieldKey) || defaultSeriesColor(index);
  }
  function formatTooltipLine(sectionKey, spec, value) {
    var unit = deps.tendUnitForSeries(sectionKey, spec.fieldKey);
    var parts = formatTendSeriesLabel(spec.cardTitle || spec.fieldKey, spec.fieldKey, unit);
    var valStr = formatTrendDisplayValue(value);
    if (parts.unit === '%') return parts.name + ' · ' + valStr + (valStr !== '—' ? ' %' : '');
    if (parts.unit) return parts.name + ' · ' + valStr + (valStr !== '—' ? ' ' + parts.unit : '');
    return parts.name + ' · ' + valStr;
  }
  function specHasTrendPoints(sectionKey, fieldKey) {
    var raw = state.historyDesc.filter(function (s) {
      return getSetTrendValueForSeries(s, sectionKey, fieldKey) != null;
    });
    return dedupeTrendSetsForSeries(raw, sectionKey, fieldKey).length >= 2;
  }
  function catalogSpecsForCharts(sectionKey) {
    if (sectionKey === 'BH') return deps.getCatalogSpecs(sectionKey, state.historyDesc) || [];
    return Object.keys(state.specsByField).map(function (fk) { return state.specsByField[fk]; });
  }
  function isLegendFieldVisible(fieldKey) {
    var saved = readGroupVisibleFields(state.patientId, state.sectionKey);
    if (!saved || !saved.length) return true;
    return saved.indexOf(fieldKey) >= 0;
  }
${slice(TG, 1036, 1361)}
  return { renderCharts, destroyCharts, destroyPanelSortable };
}
`);

w('public/js/tend-group-modal.mjs', `import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  sortLabHistoryChronological,
} from './tend-core.mjs';
import { readGroupVisibleFields } from './tend-prefs.mjs';
import { buildTableTsv, copyTableModelAsPng, copyTableText } from './tend-export.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from './ui-motion.mjs';
import { toAscendingHistory } from './tend-group-chart-helpers.mjs';
import { createTendGroupTableApi } from './tend-group-table.mjs';
import { createTendGroupChartsApi } from './tend-group-charts.mjs';
import { createTendGroupGasoApi } from './tend-group-gaso.mjs';

export function createTendGroupModal(deps) {
  var state = {
    sectionKey: null,
    patientId: null,
    charts: [],
    tableModel: null,
    activeTab: 'charts',
    tableHiddenBarCollapsed: false,
    historyDesc: [],
    historyAsc: [],
    visibleFields: [],
    specsByField: Object.create(null),
    gasoExtendedFio2: 0.21,
  };

  var tableApi = createTendGroupTableApi(deps, state);
  var chartsApi = createTendGroupChartsApi(deps, state, tableApi);
  var gasoApi = createTendGroupGasoApi(deps, state);
  var renderCharts = chartsApi.renderCharts;
  var renderTable = tableApi.renderTable;
  var destroyCharts = chartsApi.destroyCharts;
  var destroyPanelSortable = chartsApi.destroyPanelSortable;
  var closeGasoExtended = gasoApi.closeGasoExtended;
  var openGasoExtended = gasoApi.openGasoExtended;

  function backdropEl() {
    return document.getElementById('tend-group-backdrop');
  }

  function isOpen() {
    var bd = backdropEl();
    return !!(bd && bd.getAttribute('aria-hidden') === 'false');
  }

  function closeModal() {
    destroyPanelSortable();
    state.sectionKey = null;
    document.body.classList.remove('tend-group-modal-open');
    var bd = backdropEl();
    closeOverlayAnimated(bd, function () {
      if (bd) bd.style.display = 'none';
      destroyCharts();
      var chartsPanel = document.getElementById('tend-group-panel-charts');
      if (chartsPanel) chartsPanel.innerHTML = '';
      var wrap = document.getElementById('tend-group-table-wrap');
      if (wrap) wrap.innerHTML = '';
    });
  }

  function eligibleSpecs(sectionKey, historyDesc) {
    var catalog = deps.getCatalogSpecs(sectionKey, historyDesc) || [];
    return catalog.filter(function (sp) {
      var raw = historyDesc.filter(function (s) {
        return getSetTrendValueForSeries(s, sectionKey, sp.fieldKey) != null;
      });
      return dedupeTrendSetsForSeries(raw, sectionKey, sp.fieldKey).length >= 2;
    });
  }

  function resolveVisibleFields(patientId, sectionKey, eligible) {
    var saved = readGroupVisibleFields(patientId, sectionKey);
    if (saved && saved.length) {
      var allowed = Object.create(null);
      eligible.forEach(function (sp) { allowed[sp.fieldKey] = true; });
      var filtered = saved.filter(function (fk) { return allowed[fk]; });
      if (filtered.length) return filtered;
    }
    return eligible.map(function (sp) { return sp.fieldKey; });
  }

  function setTab(name) {
    state.activeTab = name === 'table' ? 'table' : 'charts';
    var chartsPanel = document.getElementById('tend-group-panel-charts');
    var tablePanel = document.getElementById('tend-group-panel-table');
    var tabs = document.querySelectorAll('#tend-group-backdrop .tend-group-tab');
    tabs.forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === state.activeTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (chartsPanel) chartsPanel.hidden = state.activeTab !== 'charts';
    if (tablePanel) tablePanel.hidden = state.activeTab !== 'table';
    var track = document.getElementById('tend-group-tabs-track');
    if (track) track.setAttribute('data-active', state.activeTab);
  }

  return {
    open: function (sectionKey) {
      var patientId = deps.getActiveId();
      if (!patientId || !sectionKey) return;
      var historyDesc = sortLabHistoryChronological(deps.getHistory() || []);
      if (historyDesc.length < 2) return;
      var eligible = eligibleSpecs(sectionKey, historyDesc);
      if (sectionKey === 'BH') {
        var hasBhData = historyDesc.some(function (s) {
          return s.parsedBySection && s.parsedBySection.BH && Object.keys(s.parsedBySection.BH).length;
        });
        if (!hasBhData && !eligible.length) return;
      } else if (!eligible.length) {
        return;
      }
      state.sectionKey = sectionKey;
      state.patientId = patientId;
      if (sectionKey === 'GASES') state.gasoExtendedFio2 = 0.21;
      state.historyDesc = historyDesc;
      state.historyAsc = toAscendingHistory(historyDesc);
      state.specsByField = Object.create(null);
      var specsForModal = sectionKey === 'BH' ? deps.getCatalogSpecs(sectionKey, historyDesc) || [] : eligible;
      specsForModal.forEach(function (sp) { state.specsByField[sp.fieldKey] = sp; });
      state.visibleFields = resolveVisibleFields(patientId, sectionKey, eligible.length ? eligible : specsForModal);
      var titleEl = document.getElementById('tend-group-title');
      if (titleEl) titleEl.textContent = (deps.getSectionLabel(sectionKey) || sectionKey) + ' — Gráfica del estudio';
      var bd = backdropEl();
      if (bd) {
        cancelOverlayClose(bd);
        bd.style.display = 'flex';
        bd.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tend-group-modal-open');
      }
      setTab(state.activeTab || 'charts');
      try { renderCharts(sectionKey); } catch (e) {
        console.error('tend-group renderCharts', e);
        var panelErr = document.getElementById('tend-group-panel-charts');
        if (panelErr) panelErr.innerHTML = '<p class="tend-empty">No se pudieron cargar las gráficas. Recarga la app e intenta de nuevo.</p>';
      }
      try { renderTable(sectionKey); } catch (e) { console.error('tend-group renderTable', e); }
    },
    close: closeModal,
    isOpen: isOpen,
    setTab: setTab,
    copyTablePng: function () {
      if (!state.tableModel) {
        if (deps.showToast) deps.showToast('No hay tabla para copiar', 'error');
        return;
      }
      var visibleCols = state.tableModel.columns.filter(function (c) { return !c.hidden; });
      var visibleRows = state.tableModel.rows.filter(function (r) { return !r.hidden; });
      if (!visibleCols.length || !visibleRows.length) {
        if (deps.showToast) deps.showToast('Muestra al menos una fila y una columna', 'error');
        return;
      }
      var title = (deps.getSectionLabel(state.sectionKey) || state.sectionKey || 'Tabla') + ' — Tendencias';
      copyTableModelAsPng(state.tableModel, title, function (ok) {
        if (deps.showToast) deps.showToast(ok ? 'Tabla copiada como imagen ✓' : 'No se pudo copiar la imagen', ok ? 'success' : 'error');
      });
    },
    copyTableText: function () {
      if (!state.tableModel) return;
      copyTableText(buildTableTsv(state.tableModel), function (ok) {
        if (deps.showToast) deps.showToast(ok ? 'Tabla copiada al portapapeles' : 'No se pudo copiar el texto', ok ? 'success' : 'error');
      });
    },
    openGasoExtended: openGasoExtended,
    closeGasoExtended: closeGasoExtended,
  };
}
`);

console.log('split v2 done');
