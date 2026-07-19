import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { formatFreqShort, formatViaShort } from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
  toggleNotAdminAtColumn,
  makeColumn,
  adherenceStatsForRowKeys,
  cellValueAtColumn,
} from '../med-pharm-view-window.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  isToday,
  MONTH_ABBR,
  displayRowsForWindow,
  notAdminAtColumn,
} from './med-pharm-profile-state.mjs';
import {
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  adherenceStatsForWindow,
} from './med-pharm-profile-adh.mjs';

function padDayCells(tr, count, target, tag, padClass) {
  while (count < target) {
    var cell = document.createElement(tag);
    cell.className = padClass;
    if (tag === 'th') cell.innerHTML = '&nbsp;';
    tr.appendChild(cell);
    count += 1;
  }
}

function appendDayHeader(tr, columns, from, to) {
  var prevMonthKey = from > 0 ? columns[from - 1].monthKey : '';
  for (var i = from; i < to; i += 1) {
    var col = columns[i];
    var th = document.createElement('th');
    th.className = 'day-hdr' + (isToday(col.year, col.monthIndex, col.day) ? ' today-col' : '');
    if (col.monthKey !== prevMonthKey) {
      th.classList.add('day-hdr-month');
      if (i > 0) th.classList.add('day-hdr-month-boundary');
      var abbr = document.createElement('span');
      abbr.className = 'day-hdr-month-label';
      abbr.textContent = MONTH_ABBR[col.monthIndex];
      th.appendChild(abbr);
      prevMonthKey = col.monthKey;
    }
    th.appendChild(document.createTextNode(String(col.day).padStart(2, '0')));
    tr.appendChild(th);
  }
}

function appendDayCell(tr, profile, row, column, monthBoundary) {
  var td = document.createElement('td');
  td.className = 'day-pad' + (isToday(column.year, column.monthIndex, column.day) ? ' today-col' : '');
  if (monthBoundary) td.classList.add('day-pad-month-boundary');
  var v = cellValueAtColumn(profile, row.rowKey, column);
  if (!(v > 0)) {
    tr.appendChild(td);
    return;
  }
  td.classList.add('indicated');
  if (notAdminAtColumn(profile, row.rowKey, column)) {
    td.classList.add('not-admin');
  }
  if (v > 1) {
    var span = document.createElement('span');
    span.className = 'x2';
    span.textContent = '×2';
    td.appendChild(span);
  }
  td.dataset.rowKey = row.rowKey;
  td.dataset.year = String(column.year);
  td.dataset.month = String(column.monthIndex);
  td.dataset.day = String(column.day);
  td.title =
    'Día ' +
    column.day +
    ' ' +
    MONTH_ABBR[column.monthIndex] +
    ' — clic para marcar no administrado';
  tr.appendChild(td);
}

function wireGridDayClicks(root) {
  if (!root || root._medPharmDayClickWired) return;
  root._medPharmDayClickWired = true;
  root.addEventListener('click', function (e) {
    var dayCell = e.target.closest('td.day-pad.indicated[data-row-key]');
    if (!dayCell || !root.contains(dayCell)) return;
    e.preventDefault();
    e.stopPropagation();
    onGridDayClick(
      dayCell.dataset.rowKey,
      parseInt(dayCell.dataset.year, 10),
      parseInt(dayCell.dataset.month, 10),
      parseInt(dayCell.dataset.day, 10)
    );
  });
}

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

function refreshOpenMedPharmGrids() {
  var pid = mp.rt.getActiveId();
  if (!pid) return;
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (!window.columns.length) return;
  var fullEl = document.getElementById('med-pharm-modal-full');
  if (fullEl && fullEl.classList.contains('open')) {
    var fullBody = document.getElementById('med-pharm-modal-full-body');
    mountSomeGrid(window, displayRowsForWindow(profile, window), profile, fullBody);
  }
  var oneEl = document.getElementById('med-pharm-modal-one');
  if (oneEl && oneEl.classList.contains('open') && mp.openMedGroupKey) {
    var unified = unifyRowsForWindow(profile, window.columns);
    var variantRows = rowsForMedGroup(unified, mp.openMedGroupKey);
    if (variantRows.length) {
      var oneBody = document.getElementById('med-pharm-modal-one-body');
      var sub = document.getElementById('med-pharm-modal-one-sub');
      mountSomeGrid(window, variantRows, profile, oneBody);
      if (sub) {
        sub.textContent = buildMedGroupModalSubtitle(profile, window, variantRows);
      }
    }
  }
}

export function mountSomeGrid(window, rows, profile, container) {
  if (!container) return;
  container.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'med-pharm-grid-scope some-grid-wrap med-pharm-scroll';
  wrap.appendChild(buildSomeGridTable(window, rows, profile));
  container.appendChild(wrap);
  wireGridDayClicks(wrap);
  wireMedPharmAdhHoverPanels(wrap);
}

function appendDayCellsForSlice(tr, profile, row, columns, from, to) {
  var prevMonthKey = from > 0 ? columns[from - 1].monthKey : '';
  for (var i = from; i < to; i += 1) {
    var col = columns[i];
    var boundary = col.monthKey !== prevMonthKey && i > 0;
    appendDayCell(tr, profile, row, col, boundary);
    prevMonthKey = col.monthKey;
  }
}

function appendSomeGridMetaCols(cg) {
  ['col-med', 'col-dosis', 'col-freq', 'col-via'].forEach(function (cls) {
    var col = document.createElement('col');
    col.className = cls;
    cg.appendChild(col);
  });
}

function buildSomeGridTable(window, rows, profile) {
  var columns = window.columns;
  var total = columns.length;
  var splitAt = window.splitAt;
  var table = document.createElement('table');
  table.className = 'some-grid-unified';

  var cg = document.createElement('colgroup');
  appendSomeGridMetaCols(cg);
  for (var ci = 0; ci < splitAt; ci += 1) {
    var dayCol = document.createElement('col');
    dayCol.className = 'col-day';
    cg.appendChild(dayCol);
  }
  table.appendChild(cg);

  var thead = document.createElement('thead');
  var hdr1 = document.createElement('tr');
  hdr1.className = 'hdr-row-1';
  ['Medicamento', 'Dosis', 'Freq', 'Vía'].forEach(function (label, i) {
    var th = document.createElement('th');
    th.className = 'col-meta-hdr col-' + ['med', 'dosis', 'freq', 'via'][i];
    th.rowSpan = 2;
    th.textContent = label;
    hdr1.appendChild(th);
  });
  appendDayHeader(hdr1, columns, 0, Math.min(splitAt, total));
  padDayCells(hdr1, hdr1.querySelectorAll('th.day-hdr').length, splitAt, 'th', 'day-hdr day-hdr-empty');
  thead.appendChild(hdr1);

  var hdr2 = document.createElement('tr');
  hdr2.className = 'hdr-row-2';
  if (total > splitAt) {
    appendDayHeader(hdr2, columns, splitAt, total);
  }
  padDayCells(hdr2, hdr2.querySelectorAll('th.day-hdr').length, splitAt, 'th', 'day-hdr day-hdr-empty');
  thead.appendChild(hdr2);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  rows.forEach(function (row, rowIndex) {
    var stats = adherenceStatsForWindow(profile, row.rowKey, columns);
    var missCls = stats.missed > 0 ? ' has-misses' : '';
    var blockStartCls = rowIndex > 0 ? ' med-row-block-start' : '';
    var blockToneCls = rowIndex % 2 === 1 ? ' med-block-b' : ' med-block-a';

    var tr1 = document.createElement('tr');
    tr1.className = 'day-band' + missCls + blockStartCls + blockToneCls;
    var medTd = document.createElement('td');
    medTd.rowSpan = 2;
    medTd.className = 'col-med';
    medTd.innerHTML = buildMedCellInner(row, stats, columns, profile, window.label);
    tr1.appendChild(medTd);

    var dosisTd = document.createElement('td');
    dosisTd.rowSpan = 2;
    dosisTd.className = 'col-dosis';
    dosisTd.textContent = row.dosis || '';
    tr1.appendChild(dosisTd);

    var freqTd = document.createElement('td');
    freqTd.rowSpan = 2;
    freqTd.className = 'col-freq';
    freqTd.textContent = formatFreqShort(row.freq);
    tr1.appendChild(freqTd);

    var viaTd = document.createElement('td');
    viaTd.rowSpan = 2;
    viaTd.className = 'col-via';
    viaTd.textContent = formatViaShort(row.via);
    tr1.appendChild(viaTd);

    appendDayCellsForSlice(tr1, profile, row, columns, 0, Math.min(splitAt, total));
    padDayCells(tr1, tr1.querySelectorAll('td.day-pad').length, splitAt, 'td', 'day-pad day-pad-empty');
    tbody.appendChild(tr1);

    var tr2 = document.createElement('tr');
    tr2.className = 'day-band med-row-block-end' + missCls + blockToneCls;
    if (total > splitAt) {
      appendDayCellsForSlice(tr2, profile, row, columns, splitAt, total);
    }
    padDayCells(tr2, tr2.querySelectorAll('td.day-pad').length, splitAt, 'td', 'day-pad day-pad-empty');
    tbody.appendChild(tr2);
  });
  table.appendChild(tbody);
  return table;
}

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
