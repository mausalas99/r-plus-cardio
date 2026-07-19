#!/usr/bin/env node
/** Split med-pharm-profile-panel + tend-group-modal into submodules <600 lines. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = path.join(root, 'public/js');
const feat = path.join(js, 'features');

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.endsWith('\n') ? content : content + '\n');
  return p;
}

function sliceLines(file, start, end) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  return lines.slice(start, end).join('\n');
}

// ─── med-pharm-profile-panel ───────────────────────────────────────────────

write(
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

const medPharm = fs.readFileSync(path.join(feat, 'med-pharm-profile-panel.mjs'), 'utf8').split('\n');

const medState = `import { medPharmProfileByPatient, saveState, patients } from '../app-state.mjs';
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
  monthHasData,
} from '../med-pharm-profile-core.mjs';
import {
  buildPharmViewWindow,
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
  cellValueAtColumn,
} from '../med-pharm-view-window.mjs';
import { syncTabBarIndicator } from '../ui-tab-motion.mjs';

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 38, 86)}

export {
  rt,
  medSubview,
  viewYear,
  viewMonthIndex,
  listFilter,
  showHiddenMedRows,
  openMedGroupKey,
  uiWired,
  dismissWired,
  lastPharmPanelPatientId,
};

export function setMedSubviewState(mode) {
  medSubview = mode;
}

export function setViewYear(y) {
  viewYear = y;
}

export function setViewMonthIndex(m) {
  viewMonthIndex = m;
}

export function setListFilter(f) {
  listFilter = f;
}

export function setShowHiddenMedRows(v) {
  showHiddenMedRows = v;
}

export function setOpenMedGroupKey(k) {
  openMedGroupKey = k;
}

export function setUiWired(v) {
  uiWired = v;
}

export function setDismissWired(v) {
  dismissWired = v;
}

export function setLastPharmPanelPatientId(id) {
  lastPharmPanelPatientId = id;
}

export function registerMedPharmProfileRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export function getMedSubview() {
  return medSubview;
}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 101, 122)}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 129, 249)}

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

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 595, 703)}

export function renderFilterSelect(filtro) {
  if (!filtro) return;
  var labels = listSomePharmFilterLabels();
  var html = labels
    .map(function (lab) {
      var sel = lab === listFilter ? ' selected' : '';
      return '<option value="' + esc(lab) + '"' + sel + '>' + esc(lab) + '</option>';
    })
    .join('');
  if (filtro.innerHTML !== html) filtro.innerHTML = html;
  filtro.value = listFilter;
}

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
`;

write('public/js/features/med-pharm-profile-state.mjs', medState);

const medAdh = `import {
  cellValueAtColumn,
} from '../med-pharm-view-window.mjs';
import {
  esc,
  monthLabel,
  viewYear,
  viewMonthIndex,
  notAdminAtColumn,
  windowHasMultipleMonths,
  MONTH_ABBR,
} from './med-pharm-profile-state.mjs';

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 274, 454)}

export {
  buildAdhTriggerHtml,
  buildAdhTriggerHtmlForGroup,
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  wireMedPharmAdhHoverOnce,
};
`;

write('public/js/features/med-pharm-profile-adh.mjs', medAdh.replace(
  /^function (buildAdhTriggerHtml|buildAdhTriggerHtmlForGroup|buildMedCellInner|wireMedPharmAdhHoverPanels|wireMedPharmAdhHoverOnce)/gm,
  'export function $1'
).replace(
  /^function (formatAdhDayList|adherenceDayDetail|adherenceDayDetailForRowKeys|adherenceStatsForWindow|buildAdhPanelHtmlForGroup|buildAdhPanelHtml|medPharmAdhPanelForWrap|hideMedPharmAdhPanel|scheduleHideMedPharmAdhPanel|positionMedPharmAdhPanel)/gm,
  'function $1'
));

const medGrid = `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import {
  formatFreqShort,
  formatViaShort,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
  cellValueAtColumn,
  toggleNotAdminAtColumn,
  makeColumn,
  adherenceStatsForRowKeys,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  rt,
  openMedGroupKey,
  getProfile,
  getViewWindow,
  isToday,
  notAdminAtColumn,
  MONTH_ABBR,
  displayRowsForWindow,
} from './med-pharm-profile-state.mjs';
import {
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  adherenceStatsForWindow,
} from './med-pharm-profile-adh.mjs';

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 704, 782)}

function onGridDayClick(rowKey, year, monthIndex, day) {
  var pid = rt.getActiveId();
  if (!pid) return;
  var col = makeColumn(year, monthIndex, day);
  var profile = getProfile(pid) || { months: {} };
  profile = toggleNotAdminAtColumn(profile, rowKey, col);
  medPharmProfileByPatient[pid] = profile;
  saveState();
  refreshOpenMedPharmGrids();
  medPharmProfileBridge.renderMedPharmProfilePanel();
}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 783, 921)}

export { mountSomeGrid, refreshOpenMedPharmGrids, buildMedGroupModalSubtitle };
`;

// buildMedGroupModalSubtitle is later in file - extract separately
const medGridFixed = medGrid.replace(
  'export { mountSomeGrid, refreshOpenMedPharmGrids, buildMedGroupModalSubtitle };',
  'export { mountSomeGrid, refreshOpenMedPharmGrids };'
);
write('public/js/features/med-pharm-profile-grid.mjs', medGridFixed);

const medModals = `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import {
  parseSomePharmMonthPaste,
  looksLikeSomePharmMonthPaste,
  applySomePasteToProfile,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
  adherenceStatsForRowKeys,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  rt,
  viewYear,
  viewMonthIndex,
  listFilter,
  getProfile,
  getViewWindow,
  monthLabel,
  monthHasData,
  profileHasMonthData,
  persistMedPharmProfile,
  closeMedPharmMoreMenu,
  setOpenMedGroupKey,
  dismissWired,
  setDismissWired,
  setLastPharmPanelPatientId,
  lastPharmPanelPatientId,
  stashMedPharmPasteForPatient,
  isDemoPatientId,
} from './med-pharm-profile-state.mjs';
import {
  displayRowsForWindow,
  countHiddenInCategoryFilter,
} from './med-pharm-profile-state.mjs';
import { mountSomeGrid } from './med-pharm-profile-grid.mjs';
import { formatFreqShort, formatViaShort } from '../med-pharm-profile-core.mjs';

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 922, 986)}

export function closeMedPharmModals() {
  closeModals();
}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 951, 1002)}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 1028, 1083)}

function buildMedGroupModalSubtitle(profile, window, variantRows) {
  var rowKeys = variantRows.map(function (r) {
    return r.rowKey;
  });
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

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 1374, 1462)}
`;

write('public/js/features/med-pharm-profile-modals.mjs', medModals
  .replace(/^export function stashMedPharmPasteForPatient/gm, 'function stashMedPharmPasteForPatient')
  .replace(
    '  renderMedPharmProfilePanel();\n',
    '  medPharmProfileBridge.renderMedPharmProfilePanel();\n'
  )
);

// Fix stash export - it's in state file
const medStateWithStash = medState.replace(
  'export function closeMedPharmMoreMenu()',
  `${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 159, 179)}

export function closeMedPharmMoreMenu()`
);
write('public/js/features/med-pharm-profile-state.mjs', medStateWithStash);

// Export countHiddenInCategoryFilter and displayRows from state - already there from slice 595-703

const medRender = `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import {
  rowSomePharmCategory,
  assignSomePharmCategories,
  mergeRecetaIntoMonth,
  ensureMonthOnProfile,
  monthKeyFromParts,
} from '../med-pharm-some-catalog.mjs';
import {
  mergeRecetaIntoMonth as mergeRecetaIntoMonthCore,
  ensureMonthOnProfile as ensureMonthOnProfileCore,
  monthKeyFromParts as monthKeyFromPartsCore,
  assignSomePharmCategories as assignSomePharmCategoriesCore,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
  adherenceStatsForRowKeys,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  rt,
  medSubview,
  viewYear,
  viewMonthIndex,
  showHiddenMedRows,
  uiWired,
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
  monthHasData,
  profileHasMonthData,
  setUiWired,
  setListFilter,
  setShowHiddenMedRows,
  setViewYear,
  setViewMonthIndex,
} from './med-pharm-profile-state.mjs';
import {
  buildAdhTriggerHtmlForGroup,
  wireMedPharmAdhHoverPanels,
  wireMedPharmAdhHoverOnce,
} from './med-pharm-profile-adh.mjs';
import { formatFreqShort, formatViaShort } from '../med-pharm-profile-core.mjs';
import {
  wireMedPharmModalDismiss,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  openMedPharmMedGroupModal,
  importMedPharmMonthPaste,
  closeMedPharmMoreMenu,
  onActivePatientChangedForPharm,
} from './med-pharm-profile-modals.mjs';
import { syncSubviewVisibility } from './med-pharm-profile-subview.mjs';

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

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 1084, 1164)}

${sliceLines('public/js/features/med-pharm-profile-panel.mjs', 1165, 1373)}

export function renderMedPharmProfilePanel() {
  initMedPharmSubviewUi();
  if (medSubview !== 'perfil') return;
  var pid = rt.getActiveId();
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
    if (listHead) listHead.style.display = hiddenCount > 0 && showHiddenMedRows ? '' : 'none';
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

export function onRecetaMergedToProfile(patientId, recetaBlock) {
  if (!patientId || !recetaBlock || !recetaBlock.items || !recetaBlock.items.length) return;
  var fecha = recetaBlock.fechaActualizacion;
  if (!fecha) return;
  var parts = fecha.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (!parts) return;
  var year = parseInt(parts[3], 10);
  var monthIndex = parseInt(parts[2], 10) - 1;
  var profile = getProfile(patientId) || { months: {} };
  var withMonth = ensureMonthOnProfileCore(profile, year, monthIndex);
  var key = monthKeyFromPartsCore(year, monthIndex);
  var month = withMonth.months[key];
  month = mergeRecetaIntoMonthCore(month, recetaBlock.items, fecha);
  month.rows = assignSomePharmCategoriesCore(month.rows);
  withMonth.months[key] = month;
  medPharmProfileByPatient[patientId] = withMonth;
  saveState();
  if (medSubview === 'perfil' && viewYear === year && viewMonthIndex === monthIndex) {
    renderMedPharmProfilePanel();
  }
}

medPharmProfileBridge.renderMedPharmProfilePanel = renderMedPharmProfilePanel;
medPharmProfileBridge.openMedPharmFullModal = openMedPharmFullModal;
medPharmProfileBridge.openMedPharmMedGroupModal = openMedPharmMedGroupModal;
medPharmProfileBridge.openMedPharmPasteModal = openMedPharmPasteModal;
medPharmProfileBridge.importMedPharmMonthPaste = importMedPharmMonthPaste;
`;

// This is getting messy - let me take a cleaner manual approach instead
console.log('Script scaffold only - using direct file writes');
