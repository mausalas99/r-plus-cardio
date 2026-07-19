#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const w = (rel, s) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s.endsWith('\n') ? s : s + '\n');
};

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const lines = (rel) => read(rel).split('\n');
const slice = (rel, a, b) => lines(rel).slice(a, b).join('\n');

// ═══════════════════════════════════════════════════════════════════════════
// med-pharm-profile-panel
// ═══════════════════════════════════════════════════════════════════════════

const MP = 'public/js/features/med-pharm-profile-panel.mjs';

w('public/js/features/med-pharm-profile-bridge.mjs', `/** Late-bound render/modal refs to avoid grid ↔ render ↔ modals cycles. */
export const medPharmProfileBridge = {
  renderMedPharmProfilePanel() {},
  openMedPharmFullModal() {},
  openMedPharmMedGroupModal(_medGroupKey) {},
  openMedPharmPasteModal() {},
  importMedPharmMonthPaste() {},
};
`);

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
  monthHasData,
} from '../med-pharm-profile-core.mjs';
import {
  buildPharmViewWindow,
  unifyRowsForWindow,
  groupUnifiedRowsByMed,
  cellValueAtColumn,
} from '../med-pharm-view-window.mjs';

${slice(MP, 38, 86)}

export function registerMedPharmProfileRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export function getMedSubview() {
  return medSubview;
}

${slice(MP, 129, 249)}

${slice(MP, 595, 703)}

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

w(
  'public/js/features/med-pharm-profile-subview.mjs',
  `import { syncTabBarIndicator } from '../ui-tab-motion.mjs';
import { rt, medSubview, getMedSubview } from './med-pharm-profile-state.mjs';

function syncSubviewVisibility() {
  var receta = document.getElementById('med-subview-receta');
  var perfil = document.getElementById('med-subview-perfil');
  if (receta) receta.style.display = medSubview === 'receta' ? '' : 'none';
  if (perfil) perfil.style.display = medSubview === 'perfil' ? '' : 'none';
  var recetaTab = document.getElementById('med-itab-receta');
  var perfilTab = document.getElementById('med-itab-perfil');
  if (recetaTab) {
    var onReceta = medSubview === 'receta';
    recetaTab.classList.toggle('active', onReceta);
    recetaTab.setAttribute('aria-selected', onReceta ? 'true' : 'false');
  }
  if (perfilTab) {
    var onPerfil = medSubview === 'perfil';
    perfilTab.classList.toggle('active', onPerfil);
    perfilTab.setAttribute('aria-selected', onPerfil ? 'true' : 'false');
  }
  var bar = document.getElementById('med-subview-tabs-bar');
  var activeTab = medSubview === 'perfil' ? perfilTab : recetaTab;
  syncTabBarIndicator(bar, activeTab);
}

export function setMedSubview(mode) {
  if (mode !== 'receta' && mode !== 'perfil') return;
  medSubview = mode;
  syncSubviewVisibility();
  rt.refreshMedPanel();
}

/** Enlaza botones del perfil y sincroniza tabs; llamar siempre al renderizar Medicamentos. */
export function initMedPharmSubviewUi(wireUiOnce) {
  wireUiOnce();
  syncSubviewVisibility();
}

export { syncSubviewVisibility, getMedSubview };
`
);

w(
  'public/js/features/med-pharm-profile-stash.mjs',
  `import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { profileHasMonthData } from '../med-pharm-profile-core.mjs';
import { getProfile, isDemoPatientId } from './med-pharm-profile-state.mjs';

/** Guarda el pegado SOME del modal antes de cambiar de paciente. */
export function stashMedPharmPasteForPatient(patientId) {
  if (!patientId || isDemoPatientId(patientId)) return;
  var ta = document.getElementById('med-pharm-paste');
  if (!ta) return;
  var raw = (ta.value || '').trim();
  var profile = getProfile(patientId);
  if (!raw) {
    if (profile && profile.draftPaste) {
      delete profile.draftPaste;
      if (!profileHasMonthData(profile)) delete medPharmProfileByPatient[patientId];
      else saveState();
    }
    return;
  }
  if (!profile) profile = { months: {} };
  profile.draftPaste = raw;
  medPharmProfileByPatient[atientId] = profile;
  saveState();
}
`.replace('medPharmProfileByPatient[atientId]', 'medPharmProfileByPatient[patientId]')
);

w(
  'public/js/features/med-pharm-profile-adh.mjs',
  `import { cellValueAtColumn } from '../med-pharm-view-window.mjs';
import {
  esc,
  monthLabel,
  viewYear,
  viewMonthIndex,
  notAdminAtColumn,
  windowHasMultipleMonths,
  MONTH_ABBR,
} from './med-pharm-profile-state.mjs';

${slice(MP, 274, 454)}

${slice(MP, 455, 595)}
`
);

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
  rt,
  openMedGroupKey,
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

${slice(MP, 704, 782)}

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

${slice(MP, 783, 921)}

export function buildMedGroupModalSubtitle(profile, window, variantRows) {
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
  formatFreqShort,
  formatViaShort,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  rt,
  viewYear,
  viewMonthIndex,
  listFilter,
  openMedGroupKey,
  dismissWired,
  lastPharmPanelPatientId,
  getProfile,
  getViewWindow,
  monthLabel,
  monthHasData,
  profileHasMonthData,
  persistMedPharmProfile,
  closeMedPharmMoreMenu,
  displayRowsForWindow,
  countHiddenInCategoryFilter,
} from './med-pharm-profile-state.mjs';
import { mountSomeGrid, buildMedGroupModalSubtitle } from './med-pharm-profile-grid.mjs';

${slice(MP, 922, 986)}

export function closeMedPharmModals() {
  closeModals();
}

${slice(MP, 951, 1002)}

${slice(MP, 1028, 1083)}
`.replace(/renderMedPharmProfilePanel\(\)/g, 'medPharmProfileBridge.renderMedPharmProfilePanel()') +
    `

export function openMedPharmMedGroupModal(medGroupKey) {
  var pid = rt.getActiveId();
  if (!pid) return;
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (!window.columns.length) return;
  var unified = unifyRowsForWindow(profile, window.columns);
  var variantRows = rowsForMedGroup(unified, medGroupKey);
  if (!variantRows.length) return;
  var body = document.getElementById('med-pharm-modal-one-body');
  var title = document.getElementById('med-pharm-modal-one-title');
  var sub = document.getElementById('med-pharm-modal-one-sub');
  if (!body) return;
  if (title) title.textContent = variantRows[0].med || 'Medicamento';
  if (sub) sub.textContent = buildMedGroupModalSubtitle(profile, window, variantRows);
  mountSomeGrid(window, variantRows, profile, body);
  openMedPharmModal('med-pharm-modal-one');
  openMedGroupKey = medGroupKey;
}

export function openMedPharmFullModal() {
  var pid = rt.getActiveId();
  if (!pid) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (!window.columns.length) {
    rt.showToast('No hay datos del mes para mostrar', 'error');
    return;
  }
  var unified = unifyRowsForWindow(profile, window.columns);
  var rows = displayRowsForWindow(profile, window);
  if (!rows.length) {
    var hiddenN = countHiddenInCategoryFilter(unified);
    rt.showToast(
      hiddenN > 0
        ? 'Solo hay medicamentos ocultos. Activa «Mostrar ocultos» para ver el calendario.'
        : 'No hay medicamentos en el filtro actual',
      'error'
    );
    return;
  }
  var body = document.getElementById('med-pharm-modal-full-body');
  var title = document.getElementById('med-pharm-modal-full-title');
  var sub = document.getElementById('med-pharm-modal-full-sub');
  if (!body) return;
  if (title) {
    title.textContent = 'Calendario farmacoterapéutico — ' + window.label;
  }
  if (sub) {
    var filtLabel = listFilter === 'TODOS' ? 'Todos los medicamentos' : 'Filtro: ' + listFilter;
    sub.textContent = filtLabel + ' · ' + rows.length + ' filas · formato matriz SOME';
    sub.hidden = false;
  }
  openMedPharmModal('med-pharm-modal-full');
  mountSomeGrid(window, rows, profile, body);
}

export function importMedPharmMonthPaste() {
  var pid = rt.getActiveId();
  if (!pid) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var ta = document.getElementById('med-pharm-paste');
  var raw = ta ? ta.value : '';
  if (!looksLikeSomePharmMonthPaste(raw)) {
    rt.showToast('No parece un pegado SOME mensual (cabecera con días 01, 02…)', 'error');
    return;
  }
  var parsed = parseSomePharmMonthPaste(raw, { year: viewYear, monthIndex: viewMonthIndex });
  if (!parsed.rows.length) {
    rt.showToast('No se encontraron filas de medicamento en el pegado', 'error');
    return;
  }
  var profile = getProfile(pid) || { months: {} };
  medPharmProfileByPatient[pid] = applySomePasteToProfile(profile, parsed);
  if (medPharmProfileByPatient[pid].draftPaste) delete medPharmProfileByPatient[pid].draftPaste;
  saveState();
  if (ta) ta.value = '';
  closeModals();
  medPharmProfileBridge.renderMedPharmProfilePanel();
  var msg = 'Mes importado (' + parsed.rows.length + ' medicamentos)';
  if (parsed.skipped > 0) msg += '. Omitidas ' + parsed.skipped + ' líneas.';
  rt.showToast(msg, 'success');
}
`
);

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
  rt,
  medSubview,
  viewYear,
  viewMonthIndex,
  listFilter,
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
import { initMedPharmSubviewUi as initSubviewUi } from './med-pharm-profile-subview.mjs';

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

${slice(MP, 1084, 1093)}

function wireUiOnce() {
  wireMedPharmModalDismiss();
  wireMedPharmAdhHoverOnce();
  if (uiWired) return;
  uiWired = true;
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
      listFilter = filtro.value;
      renderMedPharmProfilePanel();
    });
  }
  var showHidden = document.getElementById('med-pharm-show-hidden');
  if (showHidden) {
    showHidden.addEventListener('change', function () {
      showHiddenMedRows = !!showHidden.checked;
      renderMedPharmProfilePanel();
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-med-pharm-close]')) return;
    var hideBtn = e.target.closest('[data-med-pharm-hide-group]');
    if (hideBtn && hideBtn.dataset.medPharmHideGroup) {
      var pidHide = rt.getActiveId();
      if (pidHide) {
        setMedPharmMedGroupHidden(pidHide, hideBtn.dataset.medPharmHideGroup.split('\\t'), true);
      }
      return;
    }
    var unhideBtn = e.target.closest('[data-med-pharm-unhide-group]');
    if (unhideBtn && unhideBtn.dataset.medPharmUnhideGroup) {
      var pidShow = rt.getActiveId();
      if (pidShow) {
        setMedPharmMedGroupHidden(pidShow, unhideBtn.dataset.medPharmUnhideGroup.split('\\t'), false);
      }
      return;
    }
  });
}

function initMedPharmSubviewUi() {
  initSubviewUi(wireUiOnce);
}

${slice(MP, 1152, 1250)}

${slice(MP, 1268, 1373)}

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
  var withMonth = ensureMonthOnProfile(profile, year, monthIndex);
  var key = monthKeyFromParts(year, monthIndex);
  var month = withMonth.months[key];
  month = mergeRecetaIntoMonth(month, recetaBlock.items, fecha);
  month.rows = assignSomePharmCategories(month.rows);
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
`
);

w(
  'public/js/features/med-pharm-profile-panel.mjs',
  `/**
 * UI Perfil farmacoterapéutico (subvista Medicamentos). Barrel — lógica en submódulos.
 */
export { registerMedPharmProfileRuntime, getMedSubview } from './med-pharm-profile-state.mjs';
export { setMedSubview } from './med-pharm-profile-subview.mjs';
export { initMedPharmSubviewUi } from './med-pharm-profile-render.mjs';
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
export { renderMedPharmProfilePanel, onRecetaMergedToProfile } from './med-pharm-profile-render.mjs';
export { closeMedPharmMoreMenu } from './med-pharm-profile-state.mjs';

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

// ═══════════════════════════════════════════════════════════════════════════
// tend-group-modal
// ═══════════════════════════════════════════════════════════════════════════

const TG = 'public/js/tend-group-modal.mjs';

w(
  'public/js/tend-group-chart-helpers.mjs',
  `import {
  classifyTendPanelFamily,
  familyOrderForSection,
  migratePanelFamilyKey,
  isPercentPanelFamily,
  colKeyForTrendSet,
} from './tend-core.mjs';

const GENERIC_FAMILY_ORDER = ['gases', 'percent-diff', 'percent-rbc', 'absolute'];

${slice(TG, 44, 177)}

export {
  GENERIC_FAMILY_ORDER,
  roundAxisBound,
  formatAxisTickValue,
  yScaleBoundsForDatasets,
  visibleDatasetsForChart,
  applyChartYScale,
  tendPanelEyeSvg,
  orderPanelFamilies,
  formatTrendDisplayValue,
  colKeyForSet,
  toAscendingHistory,
  hexToRgba,
};
`
);

w(
  'public/js/tend-group-modal-bridge.mjs',
  `/** Late-bound render refs inside createTendGroupModal closure. */
export function createTendGroupModalBridge() {
  return {
    renderCharts(_sectionKey) {},
    renderTable(_sectionKey) {},
  };
}
`
);

// For tend-group-modal, extract table + gaso + charts as factory functions
// that receive (deps, state, bridge) and return functions.

const tendModalBody = read(TG);
// We'll build tend-group-modal.mjs as thin factory + extracted modules

w(
  'public/js/tend-group-table.mjs',
  `import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  buildSectionTableModel,
  formatTrendColumnHeader,
  colKeyForTrendSet,
  formatTendSeriesLabel,
} from './tend-core.mjs';
import {
  readGroupTableHidden,
  writeGroupTableHidden,
} from './tend-prefs.mjs';
import { formatTrendDisplayValue, colKeyForSet } from './tend-group-chart-helpers.mjs';

export function createTendGroupTableApi(deps, state) {
${slice(TG, 357, 361)}

  function isAbnormal(set, sectionKey, fieldKey, val, historyDesc) {
    if (val == null || !isFinite(val)) return false;
    var ref =
      deps.tendRefFromLabSet(set, sectionKey, fieldKey) ||
      deps.tendRefForSeries(historyDesc, sectionKey, fieldKey, set);
    if (!ref) return false;
    return val < ref[0] || val > ref[1];
  }

${slice(TG, 362, 639)}

  return { renderTable, buildTableExportModel, formatCellValue, columnHeader, legendLabelForSpec };
}
`
);

w(
  'public/js/tend-group-gaso.mjs',
  `import { sortLabHistoryChronological } from './tend-core.mjs';
import { getSetTrendValueForSeries } from './tend-core.mjs';
import { evaluateGasoExtended } from './gaso-extended.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from './ui-motion.mjs';

function isAbgAnalysisHidden() {
  return true;
}

export function createTendGroupGasoApi(deps, state) {
  function serieNumFromLabSet(set, sec, fk) {
    var v = getSetTrendValueForSeries(set, sec, fk);
    return v != null && isFinite(v) ? v : null;
  }

${slice(TG, 680, 1035)}
}
`
);

// charts module - large chunk from renderCharts and helpers
w(
  'public/js/tend-group-charts.mjs',
  `import {
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
    state.charts.forEach(function (ch) {
      if (ch) ch.destroy();
    });
    state.charts = [];
  }

${slice(TG, 201, 355)}

  function persistLegendVisible(sectionKey) {
    var vis = [];
    document
      .querySelectorAll('#tend-group-backdrop .tend-group-legend-check:checked')
      .forEach(function (cb) {
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
    if (sectionKey === 'BH') {
      return deps.getCatalogSpecs(sectionKey, state.historyDesc) || [];
    }
    return Object.keys(state.specsByField).map(function (fk) {
      return state.specsByField[fk];
    });
  }

  function isLegendFieldVisible(fieldKey) {
    var saved = readGroupVisibleFields(state.patientId, state.sectionKey);
    if (!saved || !saved.length) return true;
    return saved.indexOf(fieldKey) >= 0;
  }

${slice(TG, 1036, 1361)}

  return { renderCharts, destroyCharts, destroyPanelSortable };
}
`
);

w(
  'public/js/tend-group-modal.mjs',
  `import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  sortLabHistoryChronological,
} from './tend-core.mjs';
import {
  readGroupVisibleFields,
} from './tend-prefs.mjs';
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

  function requestCloseFromUi() {
    if (typeof deps.onRequestClose === 'function') {
      deps.onRequestClose();
    } else {
      closeModal();
    }
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
      eligible.forEach(function (sp) {
        allowed[sp.fieldKey] = true;
      });
      var filtered = saved.filter(function (fk) {
        return allowed[fk];
      });
      if (filtered.length) return filtered;
    }
    return eligible.map(function (sp) {
      return sp.fieldKey;
    });
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
      var specsForModal =
        sectionKey === 'BH'
          ? deps.getCatalogSpecs(sectionKey, historyDesc) || []
          : eligible;
      specsForModal.forEach(function (sp) {
        state.specsByField[sp.fieldKey] = sp;
      });
      state.visibleFields = resolveVisibleFields(patientId, sectionKey, eligible.length ? eligible : specsForModal);

      var titleEl = document.getElementById('tend-group-title');
      if (titleEl) {
        titleEl.textContent =
          (deps.getSectionLabel(sectionKey) || sectionKey) + ' — Gráfica del estudio';
      }

      var bd = backdropEl();
      if (bd) {
        cancelOverlayClose(bd);
        bd.style.display = 'flex';
        bd.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tend-group-modal-open');
      }

      setTab(state.activeTab || 'charts');
      try {
        renderCharts(sectionKey);
      } catch (chartRenderErr) {
        console.error('tend-group renderCharts', chartRenderErr);
        var panelErr = document.getElementById('tend-group-panel-charts');
        if (panelErr) {
          panelErr.innerHTML =
            '<p class="tend-empty">No se pudieron cargar las gráficas. Recarga la app e intenta de nuevo.</p>';
        }
      }
      try {
        renderTable(sectionKey);
      } catch (tableRenderErr) {
        console.error('tend-group renderTable', tableRenderErr);
      }
    },

    close: closeModal,

    isOpen: isOpen,

    setTab: setTab,

    copyTablePng: function () {
      if (!state.tableModel) {
        if (deps.showToast) deps.showToast('No hay tabla para copiar', 'error');
        return;
      }
      var visibleCols = state.tableModel.columns.filter(function (c) {
        return !c.hidden;
      });
      var visibleRows = state.tableModel.rows.filter(function (r) {
        return !r.hidden;
      });
      if (!visibleCols.length || !visibleRows.length) {
        if (deps.showToast) {
          deps.showToast('Muestra al menos una fila y una columna', 'error');
        }
        return;
      }
      var title =
        (deps.getSectionLabel(state.sectionKey) || state.sectionKey || 'Tabla') +
        ' — Tendencias';
      copyTableModelAsPng(state.tableModel, title, function (ok) {
        if (deps.showToast) {
          deps.showToast(
            ok ? 'Tabla copiada como imagen ✓' : 'No se pudo copiar la imagen',
            ok ? 'success' : 'error'
          );
        }
      });
    },

    copyTableText: function () {
      if (!state.tableModel) return;
      var tsv = buildTableTsv(state.tableModel);
      copyTableText(tsv, function (ok) {
        if (deps.showToast) {
          deps.showToast(
            ok ? 'Tabla copiada al portapapeles' : 'No se pudo copiar el texto',
            ok ? 'success' : 'error'
          );
        }
      });
    },

    openGasoExtended: openGasoExtended,

    closeGasoExtended: closeGasoExtended,
  };
}
`
);

console.log('Split complete.');
