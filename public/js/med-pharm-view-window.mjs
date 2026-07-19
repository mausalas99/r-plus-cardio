/** Ventana dinámica de columnas para Perfil histórico SOME — funciones puras. */

import {
  monthKeyFromParts,
  splitMonthAt,
  dayValueInMap,
  toggleNotAdmin,
  buildMedPharmMedGroupKey,
  extractMedBaseName,
} from './med-pharm-profile-core.mjs';

export const OVERLAP_CUTOFF_DAY = 14;

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function parseFimiFecha(raw) {
  const t = String(raw || '').trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: +m[1], monthIndex: +m[2] - 1, day: +m[3] };
}

export function columnKey(col) {
  return monthKeyFromParts(col.year, col.monthIndex) + '-' + String(col.day).padStart(2, '0');
}

export function daysInCalendarMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function makeColumn(year, monthIndex, day) {
  return { year, monthIndex, day, monthKey: monthKeyFromParts(year, monthIndex) };
}

function monthCompare(y1, m1, y2, m2) {
  if (y1 !== y2) return y1 < y2 ? -1 : 1;
  if (m1 !== m2) return m1 < m2 ? -1 : 1;
  return 0;
}

function isCurrentViewMonth(viewYear, viewMonthIndex, today) {
  return viewYear === today.year && viewMonthIndex === today.monthIndex;
}

function isPastViewMonth(viewYear, viewMonthIndex, today) {
  return monthCompare(viewYear, viewMonthIndex, today.year, today.monthIndex) < 0;
}

function isFutureViewMonth(viewYear, viewMonthIndex, today) {
  return monthCompare(viewYear, viewMonthIndex, today.year, today.monthIndex) > 0;
}

function getMonthFromProfile(profile, year, monthIndex) {
  if (!profile || !profile.months) return null;
  return profile.months[monthKeyFromParts(year, monthIndex)] || null;
}

function collectIndicatedDays(month, rowKey) {
  const days = [];
  if (!month || !month.rows) return days;
  for (let i = 0; i < month.rows.length; i += 1) {
    const row = month.rows[i];
    if (rowKey && row.rowKey !== rowKey) continue;
    const dmap = row.days || {};
    const keys = Object.keys(dmap);
    for (let j = 0; j < keys.length; j += 1) {
      const d = Number(keys[j]);
      if (dayValueInMap(dmap, d) > 0) days.push(d);
    }
  }
  return days;
}

function rowHasIndicationInRange(month, rowKey, fromDay, toDay) {
  if (!month || !month.rows) return false;
  for (let i = 0; i < month.rows.length; i += 1) {
    const row = month.rows[i];
    if (row.rowKey !== rowKey) continue;
    for (let d = fromDay; d <= toDay; d += 1) {
      if (dayValueInMap(row.days, d) > 0) return true;
    }
  }
  return false;
}

function rowKeysContinuingAcrossMonths(profile, prevYear, prevMonthIndex, curYear, curMonthIndex, curEndDay) {
  const prevMonth = getMonthFromProfile(profile, prevYear, prevMonthIndex);
  const curMonth = getMonthFromProfile(profile, curYear, curMonthIndex);
  if (!prevMonth || !curMonth) return [];

  const keys = [];
  const seen = Object.create(null);
  const prevRows = prevMonth.rows || [];
  for (let i = 0; i < prevRows.length; i += 1) {
    const rowKey = prevRows[i].rowKey;
    if (seen[rowKey]) continue;
    seen[rowKey] = true;
    const prevDim = prevMonth.daysInMonth || daysInCalendarMonth(prevYear, prevMonthIndex);
    if (!rowHasIndicationInRange(prevMonth, rowKey, 1, prevDim)) continue;
    if (!rowHasIndicationInRange(curMonth, rowKey, 1, curEndDay)) continue;
    keys.push(rowKey);
  }
  return keys;
}

function minIndicatedDayAmongRows(month, rowKeys) {
  let min = Infinity;
  for (let i = 0; i < rowKeys.length; i += 1) {
    const days = collectIndicatedDays(month, rowKeys[i]);
    for (let j = 0; j < days.length; j += 1) {
      if (days[j] < min) min = days[j];
    }
  }
  return min === Infinity ? 0 : min;
}

function rangeColumns(year, monthIndex, fromDay, toDay) {
  const cols = [];
  const dim = daysInCalendarMonth(year, monthIndex);
  const start = Math.max(1, fromDay);
  const end = Math.min(dim, toDay);
  for (let d = start; d <= end; d += 1) {
    cols.push(makeColumn(year, monthIndex, d));
  }
  return cols;
}

function buildCurrentMonthWindow(profile, viewYear, viewMonthIndex, today, fimiFecha) {
  const endDay = today.day;
  const columns = [];

  if (today.day >= OVERLAP_CUTOFF_DAY) {
    return rangeColumns(viewYear, viewMonthIndex, 1, endDay);
  }

  const prevMonthIndex = viewMonthIndex === 0 ? 11 : viewMonthIndex - 1;
  const prevYear = viewMonthIndex === 0 ? viewYear - 1 : viewYear;
  const continuingKeys = rowKeysContinuingAcrossMonths(
    profile,
    prevYear,
    prevMonthIndex,
    viewYear,
    viewMonthIndex,
    endDay
  );

  if (!continuingKeys.length) {
    return rangeColumns(viewYear, viewMonthIndex, 1, endDay);
  }

  const prevMonth = getMonthFromProfile(profile, prevYear, prevMonthIndex);
  let prevStart = minIndicatedDayAmongRows(prevMonth, continuingKeys);
  const fimi = parseFimiFecha(fimiFecha);
  if (
    fimi &&
    fimi.year === prevYear &&
    fimi.monthIndex === prevMonthIndex &&
    fimi.day > prevStart
  ) {
    prevStart = fimi.day;
  }

  const prevDim = daysInCalendarMonth(prevYear, prevMonthIndex);
  columns.push(...rangeColumns(prevYear, prevMonthIndex, prevStart, prevDim));
  columns.push(...rangeColumns(viewYear, viewMonthIndex, 1, endDay));
  return columns;
}

function buildPastMonthWindow(profile, viewYear, viewMonthIndex, fimiFecha) {
  const fimi = parseFimiFecha(fimiFecha);
  if (fimi && monthCompare(fimi.year, fimi.monthIndex, viewYear, viewMonthIndex) > 0) {
    return [];
  }

  const month = getMonthFromProfile(profile, viewYear, viewMonthIndex);
  const indicated = collectIndicatedDays(month);
  if (!indicated.length) return [];

  let first = Math.min(...indicated);
  let last = Math.max(...indicated);

  if (fimi && fimi.year === viewYear && fimi.monthIndex === viewMonthIndex) {
    first = Math.max(first, fimi.day);
  }

  if (first > last) return [];

  return rangeColumns(viewYear, viewMonthIndex, first, last);
}

function buildWindowLabel(columns, viewYear, viewMonthIndex) {
  if (!columns.length) {
    return MONTH_NAMES[viewMonthIndex] + ' ' + viewYear;
  }

  const monthKeys = [];
  const seen = Object.create(null);
  for (let i = 0; i < columns.length; i += 1) {
    const mk = columns[i].monthKey;
    if (!seen[mk]) {
      seen[mk] = true;
      monthKeys.push(mk);
    }
  }

  if (monthKeys.length === 1) {
    return MONTH_NAMES[viewMonthIndex] + ' ' + viewYear;
  }

  const first = columns[0];
  const last = columns[columns.length - 1];
  const year = last.year;
  return (
    first.day +
    ' ' +
    MONTH_ABBR[first.monthIndex] +
    ' – ' +
    last.day +
    ' ' +
    MONTH_ABBR[last.monthIndex] +
    ' ' +
    year
  );
}

export function buildPharmViewWindow(opts) {
  const profile = opts.profile || { months: {} };
  const viewYear = opts.viewYear;
  const viewMonthIndex = opts.viewMonthIndex;
  const today = opts.today;
  const fimiFecha = opts.fimiFecha || '';

  let columns = [];
  const isCurrentMonth = isCurrentViewMonth(viewYear, viewMonthIndex, today);

  if (isFutureViewMonth(viewYear, viewMonthIndex, today)) {
    columns = [];
  } else if (isCurrentMonth) {
    columns = buildCurrentMonthWindow(profile, viewYear, viewMonthIndex, today, fimiFecha);
  } else if (isPastViewMonth(viewYear, viewMonthIndex, today)) {
    columns = buildPastMonthWindow(profile, viewYear, viewMonthIndex, fimiFecha);
  }

  return {
    columns,
    splitAt: splitMonthAt(columns.length),
    viewYear,
    viewMonthIndex,
    isCurrentMonth,
    label: buildWindowLabel(columns, viewYear, viewMonthIndex),
  };
}

function findRowInMonth(profile, monthKey, rowKey) {
  const month = profile && profile.months ? profile.months[monthKey] : null;
  if (!month || !month.rows) return null;
  for (let i = 0; i < month.rows.length; i += 1) {
    if (month.rows[i].rowKey === rowKey) return month.rows[i];
  }
  return null;
}

function findRowWithDayInMonth(profile, monthKey, rowKey, day) {
  const month = profile && profile.months ? profile.months[monthKey] : null;
  if (!month || !month.rows) return null;
  for (let i = 0; i < month.rows.length; i += 1) {
    const row = month.rows[i];
    if (row.rowKey !== rowKey) continue;
    if (dayValueInMap(row.days, day) > 0) return row;
  }
  return findRowInMonth(profile, monthKey, rowKey);
}

function primaryMonthKeyFromColumns(columns) {
  if (!columns.length) return '';
  return columns[columns.length - 1].monthKey;
}

export function unifyRowsForWindow(profile, columns) {
  if (!columns.length) return [];

  const monthKeys = [];
  const seenMk = Object.create(null);
  for (let i = 0; i < columns.length; i += 1) {
    const mk = columns[i].monthKey;
    if (!seenMk[mk]) {
      seenMk[mk] = true;
      monthKeys.push(mk);
    }
  }

  const primaryKey = primaryMonthKeyFromColumns(columns);
  const rowKeys = [];
  const seenRow = Object.create(null);

  for (let i = 0; i < monthKeys.length; i += 1) {
    const month = profile.months ? profile.months[monthKeys[i]] : null;
    if (!month || !month.rows) continue;
    for (let j = 0; j < month.rows.length; j += 1) {
      const rk = month.rows[j].rowKey;
      if (seenRow[rk]) continue;
      seenRow[rk] = true;
      rowKeys.push(rk);
    }
  }

  const unified = rowKeys.map(function (rowKey) {
    const primary = findRowInMonth(profile, primaryKey, rowKey);
    let fallback = null;
    for (let i = 0; i < monthKeys.length; i += 1) {
      if (monthKeys[i] === primaryKey) continue;
      fallback = findRowInMonth(profile, monthKeys[i], rowKey);
      if (fallback) break;
    }
    const src = primary || fallback;
    if (!src) return null;
    return {
      rowKey: src.rowKey,
      med: src.med,
      dosis: src.dosis,
      freq: src.freq,
      via: src.via,
      cat: src.cat,
      catOverride: src.catOverride,
      hidden: src.hidden,
    };
  }).filter(Boolean);

  unified.sort(function (a, b) {
    const medCmp = String(a.med || '').localeCompare(String(b.med || ''), 'es');
    if (medCmp !== 0) return medCmp;
    return String(a.rowKey).localeCompare(String(b.rowKey), 'es');
  });

  return unified;
}

export function cellValueAtColumn(profile, rowKey, column) {
  const month = profile && profile.months ? profile.months[column.monthKey] : null;
  if (!month || !month.rows) return 0;
  let best = 0;
  for (let i = 0; i < month.rows.length; i += 1) {
    const row = month.rows[i];
    if (row.rowKey !== rowKey) continue;
    const v = dayValueInMap(row.days, column.day);
    if (v > best) best = v;
  }
  return best;
}

export function toggleNotAdminAtColumn(profile, rowKey, column) {
  const base = profile && profile.months ? profile : { months: {} };
  const monthKey = column.monthKey;
  const month = base.months[monthKey];
  if (!month) return base;

  const row = findRowWithDayInMonth(base, monthKey, rowKey, column.day);
  if (!row) return base;

  const nextNotAdmin = toggleNotAdmin(row.days, row.notAdmin, column.day);
  const rows = (month.rows || []).map(function (r) {
    if (r.rowKey !== rowKey) return r;
    return Object.assign({}, r, { notAdmin: nextNotAdmin });
  });

  const months = Object.assign({}, base.months);
  months[monthKey] = Object.assign({}, month, { rows });
  return { months };
}

function notAdminAtColumn(profile, rowKey, column) {
  const month = profile && profile.months ? profile.months[column.monthKey] : null;
  if (!month || !month.rows) return false;
  for (let i = 0; i < month.rows.length; i += 1) {
    const row = month.rows[i];
    if (row.rowKey !== rowKey) continue;
    if (!(dayValueInMap(row.days, column.day) > 0)) continue;
    const na = row.notAdmin || {};
    if (na[column.day] || na[String(column.day)]) return true;
  }
  return false;
}

/** Variante con indicación más reciente en la ventana (columnas de derecha a izquierda). */
export function latestVariantInWindow(profile, columns, variants) {
  if (!variants.length) return null;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    const col = columns[i];
    for (let v = 0; v < variants.length; v += 1) {
      if (cellValueAtColumn(profile, variants[v].rowKey, col) > 0) {
        return variants[v];
      }
    }
  }
  return variants[0];
}

export function adherenceStatsForRowKeys(profile, rowKeys, columns) {
  let indicated = 0;
  let missed = 0;
  const missedDays = [];
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    let dayIndicated = false;
    let dayMissed = false;
    for (let k = 0; k < rowKeys.length; k += 1) {
      const rk = rowKeys[k];
      if (!(cellValueAtColumn(profile, rk, col) > 0)) continue;
      dayIndicated = true;
      if (notAdminAtColumn(profile, rk, col)) dayMissed = true;
    }
    if (!dayIndicated) continue;
    indicated += 1;
    if (dayMissed) {
      missed += 1;
      missedDays.push(col.day);
    }
  }
  return {
    indicated,
    effective: indicated - missed,
    missed,
    missedDays,
  };
}

export function groupUnifiedRowsByMed(unified, profile, columns) {
  if (!unified.length) return [];
  const byMed = Object.create(null);
  for (let i = 0; i < unified.length; i += 1) {
    const row = unified[i];
    const gk = buildMedPharmMedGroupKey(row.med);
    if (!byMed[gk]) byMed[gk] = [];
    byMed[gk].push(row);
  }
  const groups = Object.keys(byMed).map(function (gk) {
    const variants = byMed[gk].slice();
    variants.sort(function (a, b) {
      return String(a.rowKey).localeCompare(String(b.rowKey), 'es');
    });
    const currentVariant = latestVariantInWindow(profile, columns, variants) || variants[0];
    return {
      medGroupKey: gk,
      med: extractMedBaseName(currentVariant.med) || currentVariant.med,
      variants,
      rowKeys: variants.map(function (v) {
        return v.rowKey;
      }),
      currentVariant,
    };
  });
  groups.sort(function (a, b) {
    return String(a.med || '').localeCompare(String(b.med || ''), 'es');
  });
  return groups;
}

export function rowsForMedGroup(unified, medGroupKey) {
  return unified.filter(function (r) {
    return buildMedPharmMedGroupKey(r.med) === medGroupKey;
  });
}
