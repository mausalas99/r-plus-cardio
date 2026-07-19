import { medPharmProfileByPatient, saveState, patients } from '../app-state.mjs';
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
import { buildPharmViewWindow, unifyRowsForWindow, groupUnifiedRowsByMed } from '../med-pharm-view-window.mjs';
import { isDemoPatientId } from '../demo-patient.mjs';

import { esc } from '../dom-escape.mjs';
export { esc, isDemoPatientId };
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
  return lines.join('\n');
}

function rowsMatchingCategoryFilter(rows) {
  if (!rows || !rows.length) return [];
  if (mp.listFilter === 'TODOS') return rows;
  return rows.filter(function (r) {
    return rowSomePharmCategory(r) === mp.listFilter;
  });
}

export function countHiddenInCategoryFilter(rows) {
  return rowsMatchingCategoryFilter(rows).filter(isMedPharmRowHidden).length;
}

export function isMedPharmGroupHidden(group) {
  if (!group || !group.variants || !group.variants.length) return false;
  for (var i = 0; i < group.variants.length; i += 1) {
    if (!isMedPharmRowHidden(group.variants[i])) return false;
  }
  return true;
}

export function groupMatchesCategoryFilter(group) {
  if (mp.listFilter === 'TODOS') return true;
  for (var i = 0; i < group.variants.length; i += 1) {
    if (rowSomePharmCategory(group.variants[i]) === mp.listFilter) return true;
  }
  return false;
}

export function displayRowsForWindow(profile, window) {
  var unified = unifyRowsForWindow(profile || { months: {} }, window.columns);
  var rows = rowsMatchingCategoryFilter(unified);
  if (mp.showHiddenMedRows) return rows;
  return rows.filter(function (r) {
    return !isMedPharmRowHidden(r);
  });
}

export function displayGroupsForWindow(profile, window) {
  var unified = unifyRowsForWindow(profile || { months: {} }, window.columns);
  var groups = groupUnifiedRowsByMed(unified, profile, window.columns);
  groups = groups.filter(groupMatchesCategoryFilter);
  if (!mp.showHiddenMedRows) {
    groups = groups.filter(function (g) {
      return !isMedPharmGroupHidden(g);
    });
  }
  return groups;
}

export function countHiddenGroups(groups) {
  var n = 0;
  for (var i = 0; i < groups.length; i += 1) {
    if (isMedPharmGroupHidden(groups[i])) n += 1;
  }
  return n;
}



export function renderFilterSelect(filtro) {
  if (!filtro) return;
  var labels = listSomePharmFilterLabels();
  var html = labels
    .map(function (lab) {
      var sel = lab === mp.listFilter ? ' selected' : '';
      return '<option value="' + esc(lab) + '"' + sel + '>' + esc(lab) + '</option>';
    })
    .join('');
  if (filtro.innerHTML !== html) filtro.innerHTML = html;
  filtro.value = mp.listFilter;
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
