/** Perfil farmacoterapéutico mensual SOME — funciones puras, CCN bajo. */

import { assignSomePharmCategory } from './med-pharm-some-catalog.mjs';

function trimStr(s) {
  return String(s || '').trim();
}

function normKeyPart(s) {
  return trimStr(s).replace(/\s+/g, ' ').toUpperCase();
}

/** Ignora *DIA# n* en la clave para no duplicar filas al actualizar Receta día a día. */
export function normDosisForRowKey(dosis) {
  return normKeyPart(
    String(dosis || '')
      .replace(/\*?\s*DIA\s*#\s*\d+\s*\*?/gi, '')
      .replace(/\/{2,}/g, ' ')
  );
}

export function buildMedPharmRowKey(fields) {
  const med = fields.med != null ? fields.med : fields.nombreRaw;
  const dosis = fields.dosis != null ? fields.dosis : fields.dosisRaw;
  const freq = fields.freq != null ? fields.freq : fields.frecuenciaRaw;
  const via = fields.via != null ? fields.via : fields.viaRaw;
  return [normKeyPart(med), normDosisForRowKey(dosis), normKeyPart(freq), normKeyPart(via)].join('|');
}

/** Principio activo / nombre base SOME (sin concentración ni forma farmacéutica). */
export function extractMedBaseName(med) {
  let t = trimStr(med);
  if (!t) return '';
  t = t
    .replace(/\(\s*\+\s*\*\s*\)/gi, ' ')
    .replace(/\(\s*\*\s*\)/gi, ' ')
    .replace(/\*+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const doseStart =
    /\s+(?=\d+(?:[.,]\d+)?\s*(?:%|MG|G|MCG|µG|UG|UI|IU|ML|MEQ|MMOL|UNIDADES?|U\/|MCG\/|MG\/|MCG\/ML|MG\/ML))/i;
  const cut = t.search(doseStart);
  if (cut > 0) return t.slice(0, cut).trim();
  const slash = t.indexOf(' / ');
  if (slash > 0) return t.slice(0, slash).trim();
  return t;
}

/** Clave de agrupación en lista: mismo fármaco, distintas presentaciones/dosis. */
export function buildMedPharmMedGroupKey(med) {
  return extractMedBaseName(med);
}

export function monthKeyFromParts(year, monthIndex) {
  return String(year) + '-' + String(monthIndex + 1).padStart(2, '0');
}

export function splitMonthAt(daysInMonth) {
  return Math.ceil(daysInMonth / 2);
}

export function dayValueInMap(days, d) {
  if (!days) return 0;
  const v = days[d];
  if (v > 0) return v;
  return days[String(d)] || 0;
}

export function adherenceStats(days, notAdmin) {
  const indicated = [];
  const missed = [];
  const dmap = days || {};
  const na = notAdmin || {};
  const keys = Object.keys(dmap);
  for (let i = 0; i < keys.length; i += 1) {
    const d = Number(keys[i]);
    if (!(dayValueInMap(dmap, d) > 0)) continue;
    indicated.push(d);
    if (na[d] || na[String(d)]) missed.push(d);
  }
  indicated.sort(function (a, b) {
    return a - b;
  });
  missed.sort(function (a, b) {
    return a - b;
  });
  return {
    indicated: indicated.length,
    effective: indicated.length - missed.length,
    missed: missed.length,
    missedDays: missed,
  };
}

export function isMedPharmRowHidden(row) {
  return !!(row && row.hidden);
}

export function toggleNotAdmin(days, notAdmin, dayNum) {
  if (!(dayValueInMap(days, dayNum) > 0)) return notAdmin || {};
  const next = Object.assign({}, notAdmin || {});
  if (next[dayNum] || next[String(dayNum)]) {
    delete next[dayNum];
    delete next[String(dayNum)];
  } else {
    next[dayNum] = true;
  }
  return next;
}

export function formatFreqShort(raw) {
  const t = trimStr(raw).toUpperCase();
  if (!t) return '—';
  if (t === 'ONCE' || t === 'UNICA' || t === 'ÚNICA') return 'UNICA';
  if (t === 'PRN') return t;
  const m = t.match(/^Q?(\d+)\s*H$/);
  if (m) return m[1] + 'H';
  if (t.indexOf('Q') === 0) return t.slice(1);
  return t;
}

export function formatViaShort(raw) {
  const v = trimStr(raw).replace(/^VIA\s+/i, '');
  return v || '—';
}

function isDayHeaderToken(cell) {
  const t = trimStr(cell);
  if (!/^\d{1,2}$/.test(t)) return false;
  const n = parseInt(t, 10);
  return n >= 1 && n <= 31;
}

function findDayHeaderInfo(cols) {
  let start = -1;
  let count = 0;
  for (let i = 0; i < cols.length; i += 1) {
    if (!isDayHeaderToken(cols[i])) continue;
    if (start < 0) start = i;
    count += 1;
  }
  if (count < 5) return null;
  return { dayStartCol: start };
}

function parseDayCell(raw) {
  const t = trimStr(raw);
  if (!t || t === '-' || t === '0') return 0;
  const n = parseInt(t, 10);
  if (n === 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

function rowMetaFromCols(cols, dayStartCol) {
  const meta = [];
  for (let i = 0; i < dayStartCol; i += 1) {
    const p = trimStr(cols[i]);
    if (p) meta.push(p);
  }
  if (meta.length < 4) return null;
  const via = meta[meta.length - 1];
  const freq = meta[meta.length - 2];
  const dosis = meta[meta.length - 3];
  const med = meta.slice(0, meta.length - 3).join(' ');
  if (!med) return null;
  return { med, dosis, freq, via };
}

function parseDaysFromCols(cols, dayStartCol, daysInMonth) {
  const days = {};
  for (let d = 1; d <= daysInMonth; d += 1) {
    const v = parseDayCell(cols[dayStartCol + d - 1]);
    if (v > 0) days[d] = v;
  }
  return days;
}

function parseRowLine(cols, dayStartCol, daysInMonth) {
  let start = dayStartCol;
  let meta = rowMetaFromCols(cols, start);
  if (!meta && cols.length > start + daysInMonth) {
    start = cols.length - daysInMonth;
    meta = rowMetaFromCols(cols, start);
  }
  if (!meta) return null;
  const days = parseDaysFromCols(cols, start, daysInMonth);
  if (!Object.keys(days).length) return null;
  return { meta, days };
}

export function looksLikeSomePharmMonthPaste(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(trimStr)
    .filter(Boolean);
  if (lines.length < 2) return false;
  for (let i = 0; i < lines.length; i += 1) {
    if (findDayHeaderInfo(lines[i].split('\t'))) return true;
  }
  return false;
}

export function parseSomePharmMonthPaste(text, opts) {
  const year = opts.year;
  const monthIndex = opts.monthIndex;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthKey = monthKeyFromParts(year, monthIndex);
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(trimStr)
    .filter(Boolean);
  let headerIdx = -1;
  let dayStartCol = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const info = findDayHeaderInfo(lines[i].split('\t'));
    if (!info) continue;
    headerIdx = i;
    dayStartCol = info.dayStartCol;
    break;
  }
  if (headerIdx < 0) {
    return { rows: [], skipped: lines.length, daysInMonth, monthKey, year, monthIndex };
  }
  const rows = [];
  let skipped = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (i === headerIdx) continue;
    const parsedRow = parseRowLine(lines[i].split('\t'), dayStartCol, daysInMonth);
    if (!parsedRow) {
      skipped += 1;
      continue;
    }
    rows.push(
      assignSomePharmCategory({
        rowKey: buildMedPharmRowKey(parsedRow.meta),
        med: parsedRow.meta.med,
        dosis: parsedRow.meta.dosis,
        freq: parsedRow.meta.freq,
        via: parsedRow.meta.via,
        cat: '',
        days: parsedRow.days,
        notAdmin: {},
      })
    );
  }
  return {
    rows: coalesceMedPharmRowsByKey(rows),
    skipped,
    daysInMonth,
    monthKey,
    year,
    monthIndex,
  };
}

export function parseRecetaDateToDay(fechaDMY, year, monthIndex) {
  const m = trimStr(fechaDMY).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { ok: false, day: 0 };
  const day = parseInt(m[1], 10);
  const mon = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  if (y !== year || mon !== monthIndex) return { ok: false, day: 0 };
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  if (day < 1 || day > dim) return { ok: false, day: 0 };
  return { ok: true, day };
}

export function emptyMonth(year, monthIndex) {
  return {
    monthKey: monthKeyFromParts(year, monthIndex),
    year,
    monthIndex,
    daysInMonth: new Date(year, monthIndex + 1, 0).getDate(),
    rows: [],
  };
}

function findRowByKey(rows, key) {
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].rowKey === key) return rows[i];
  }
  return null;
}

function lastIndicatedDay(days, maxDay) {
  let last = 0;
  for (let d = 1; d <= maxDay; d += 1) {
    if (dayValueInMap(days, d) > 0) last = d;
  }
  return last;
}

function maxIndicatedDay(days) {
  let max = 0;
  const dmap = days || {};
  const keys = Object.keys(dmap);
  for (let i = 0; i < keys.length; i += 1) {
    const d = Number(keys[i]);
    if (dayValueInMap(dmap, d) > 0 && d > max) max = d;
  }
  return max;
}

function mergeMedPharmRowDays(into, from) {
  const fromMax = maxIndicatedDay(from.days);
  const intoMaxBefore = maxIndicatedDay(into.days);
  const days = Object.assign({}, into.days || {});
  const srcDays = from.days || {};
  const srcKeys = Object.keys(srcDays);
  for (let i = 0; i < srcKeys.length; i += 1) {
    const d = Number(srcKeys[i]);
    const v = srcDays[srcKeys[i]];
    const prev = dayValueInMap(days, d);
    if (v > prev) days[d] = v;
  }
  into.days = days;
  const notAdmin = Object.assign({}, into.notAdmin || {});
  const srcNa = from.notAdmin || {};
  const naKeys = Object.keys(srcNa);
  for (let j = 0; j < naKeys.length; j += 1) {
    const d = Number(naKeys[j]);
    if (srcNa[naKeys[j]]) notAdmin[d] = true;
  }
  into.notAdmin = notAdmin;
  if (fromMax > intoMaxBefore) {
    into.dosis = from.dosis;
    into.freq = from.freq;
    into.via = from.via;
    into.med = from.med;
    if (from.cat) into.cat = from.cat;
  }
}

/** SOME emits one row per DIA# with the same régimen; merge by rowKey (DIA# ignored in key). */
export function coalesceMedPharmRowsByKey(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byKey = Object.create(null);
  const order = [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    if (!row || !row.rowKey) continue;
    if (!byKey[row.rowKey]) {
      byKey[row.rowKey] = Object.assign({}, row, {
        days: Object.assign({}, row.days || {}),
        notAdmin: Object.assign({}, row.notAdmin || {}),
      });
      order.push(row.rowKey);
      continue;
    }
    mergeMedPharmRowDays(byKey[row.rowKey], row);
  }
  return order.map(function (key) {
    return byKey[key];
  });
}

function fillGapDays(days, fromDay, toDay) {
  for (let d = fromDay; d < toDay; d += 1) {
    if (dayValueInMap(days, d) > 0) continue;
    days[d] = 1;
  }
}

export function mergeRecetaIntoMonth(month, recetaItems, fechaActualizacion) {
  const parsed = parseRecetaDateToDay(fechaActualizacion, month.year, month.monthIndex);
  if (!parsed.ok) return month;
  const target = parsed.day;
  const rows = (month.rows || []).slice();
  const items = recetaItems || [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (it.suspendido) continue;
    const fields = {
      med: trimStr(it.nombreRaw),
      dosis: trimStr(it.dosisRaw),
      freq: trimStr(it.frecuenciaRaw),
      via: trimStr(it.viaRaw),
    };
    const key = buildMedPharmRowKey(fields);
    let row = findRowByKey(rows, key);
    if (!row) {
      row = assignSomePharmCategory(
        Object.assign({}, fields, { rowKey: key, cat: '', days: {}, notAdmin: {} })
      );
      rows.push(row);
    }
    const last = lastIndicatedDay(row.days, month.daysInMonth);
    if (last > 0 && target > last + 1) fillGapDays(row.days, last + 1, target);
    if (!(dayValueInMap(row.days, target) > 0)) row.days[target] = 1;
  }
  return Object.assign({}, month, {
    rows,
    lastRecetaMergeDate: fechaActualizacion,
  });
}

export function mergeNotAdminFromPrevious(newRow, oldNotAdmin) {
  const notAdmin = {};
  const na = oldNotAdmin || {};
  const keys = Object.keys(newRow.days || {});
  for (let i = 0; i < keys.length; i += 1) {
    const d = parseInt(keys[i], 10);
    if (na[d] || na[String(d)]) notAdmin[d] = true;
  }
  return Object.assign({}, newRow, { notAdmin });
}

export function applySomePasteToProfile(profile, parsed) {
  const base = profile && profile.months ? profile : { months: {} };
  const prev = base.months[parsed.monthKey];
  const prevNa = Object.create(null);
  if (prev && prev.rows) {
    prev.rows.forEach(function (r) {
      prevNa[r.rowKey] = r.notAdmin || {};
    });
  }
  const prevRows = prev && prev.rows ? prev.rows : [];
  const prevByKey = Object.create(null);
  prevRows.forEach(function (r) {
    prevByKey[r.rowKey] = r;
  });
  const rows = parsed.rows.map(function (r) {
    const row = mergeNotAdminFromPrevious(r, prevNa[r.rowKey]);
    const old = prevByKey[r.rowKey];
    if (!old) return assignSomePharmCategory(row);
    const patch = {};
    if (old.catOverride) {
      patch.catOverride = old.catOverride;
      patch.cat = old.catOverride;
    }
    if (old.hidden) patch.hidden = true;
    return assignSomePharmCategory(Object.assign({}, row, patch));
  });
  const months = Object.assign({}, base.months);
  months[parsed.monthKey] = {
    monthKey: parsed.monthKey,
    year: parsed.year,
    monthIndex: parsed.monthIndex,
    daysInMonth: parsed.daysInMonth,
    lastSomePasteAt: new Date().toISOString(),
    rows,
  };
  return { months };
}

/** ISO timestamp for LAN LWW — latest SOME paste or Receta merge across months. */
export function medPharmProfileUpdatedAt(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const months = profile.months;
  if (!months || typeof months !== 'object') return '';
  let best = '';
  Object.keys(months).forEach(function (k) {
    const m = months[k];
    if (!m || typeof m !== 'object') return;
    const paste = m.lastSomePasteAt ? String(m.lastSomePasteAt).trim() : '';
    if (paste && paste > best) best = paste;
    const rec = m.lastRecetaMergeDate ? String(m.lastRecetaMergeDate).trim() : '';
    if (!rec) return;
    const parts = rec.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!parts) return;
    const iso =
      parts[3] +
      '-' +
      String(parts[2]).padStart(2, '0') +
      '-' +
      String(parts[1]).padStart(2, '0') +
      'T12:00:00.000Z';
    if (iso > best) best = iso;
  });
  return best;
}

export function getMonthFromProfile(profile, year, monthIndex) {
  if (!profile || !profile.months) return null;
  return profile.months[monthKeyFromParts(year, monthIndex)] || null;
}

export function profileHasMonthData(profile) {
  if (!profile || !profile.months || typeof profile.months !== 'object') return false;
  return Object.keys(profile.months).some(function (k) {
    const m = profile.months[k];
    return m && Array.isArray(m.rows) && m.rows.length > 0;
  });
}

export function monthHasData(profile, year, monthIndex) {
  const month = getMonthFromProfile(profile, year, monthIndex);
  return !!(month && Array.isArray(month.rows) && month.rows.length);
}

/** Quita un mes del perfil; devuelve null si no queda nada (ni draftPaste). */
export function deleteMonthFromProfile(profile, year, monthIndex) {
  if (!profile || !profile.months) return null;
  const key = monthKeyFromParts(year, monthIndex);
  if (!profile.months[key]) return profile;
  const months = Object.assign({}, profile.months);
  delete months[key];
  const next = Object.assign({}, profile, { months });
  if (!profileHasMonthData(next) && !trimStr(next.draftPaste)) return null;
  if (!Object.keys(months).length) delete next.months;
  return next;
}

export function ensureMonthOnProfile(profile, year, monthIndex) {
  const base = profile && profile.months ? profile : { months: {} };
  const key = monthKeyFromParts(year, monthIndex);
  if (base.months[key]) return base;
  const months = Object.assign({}, base.months);
  months[key] = emptyMonth(year, monthIndex);
  return { months };
}
