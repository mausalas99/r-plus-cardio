export const TEND_MESES_MAP = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
  jan: '01', apr: '04', aug: '08', dec: '12'
};

/** Solo paneles de laboratorio convencional; excluye cultivos/micro (UROCULTIVO, HEMOCULTIVO, SONDA, …). */
export function tendEligibleSectionKey(sec) {
  var u = String(sec == null ? '' : sec)
    .trim()
    .replace(/:+$/, '')
    .toUpperCase();
  if (!u) return false;
  return /^(BH|PLTCIT|QS|ESC|PFHS|GASES|LCR|LIQ|PROT12H|PROT24H|PIE|EGO|CUANTORINA|FROTIS|LIPASA|TROP)$/.test(u);
}

export function normalizeFechaLabHistory(fechaRaw) {
  if (fechaRaw == null || fechaRaw === '') return '';
  if (String(fechaRaw).trim() === 'Anterior') return 'Anterior';
  var t = String(fechaRaw).trim();
  var mEn = t.match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (mEn) {
    var mon = TEND_MESES_MAP[mEn[1].toLowerCase().slice(0, 3)];
    if (mon) return mEn[2].padStart(2, '0') + '/' + mon + '/' + mEn[3];
  }
  var mNum = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (mNum) {
    var y = mNum[3] ? String(mNum[3]) : String(new Date().getFullYear());
    if (y.length === 2) y = '20' + y;
    return mNum[1].padStart(2, '0') + '/' + mNum[2].padStart(2, '0') + '/' + y;
  }
  return t;
}

export function applyHoraToMs(ms, horaStr) {
  if (horaStr == null || !/^\d{1,2}:\d{2}/.test(String(horaStr).trim())) return ms;
  var h = String(horaStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!h) return ms;
  return ms + (parseInt(h[1], 10) * 3600 + parseInt(h[2], 10) * 60) * 1000;
}

export function normalizeHoraLabHistory(horaRaw) {
  if (horaRaw == null) return '';
  var t = String(horaRaw).trim();
  if (!t) return '';
  var m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  var hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  var mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  var ss = m[3] == null ? null : Math.max(0, Math.min(59, parseInt(m[3], 10)));
  var out = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (ss != null) out += ':' + String(ss).padStart(2, '0');
  return out;
}

export function parseFechaLabToMs(fechaStr, horaStr) {
  if (!fechaStr) return null;
  var t = String(fechaStr).trim();
  if (t === 'Anterior') return null;
  var mEn = t.match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (mEn) {
    var monStr = TEND_MESES_MAP[mEn[1].toLowerCase().slice(0, 3)];
    if (monStr) {
      var mo = parseInt(monStr, 10) - 1;
      var ms = new Date(parseInt(mEn[3], 10), mo, parseInt(mEn[2], 10)).getTime();
      return applyHoraToMs(ms, horaStr);
    }
  }
  var mNum = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (mNum) {
    var y = mNum[3] ? parseInt(mNum[3], 10) : new Date().getFullYear();
    if (y < 100) y += 2000;
    var ms2 = new Date(y, parseInt(mNum[2], 10) - 1, parseInt(mNum[1], 10)).getTime();
    return applyHoraToMs(ms2, horaStr);
  }
  return null;
}

function isAnteriorLabEntry(entry) {
  return !!(entry && (entry.fecha === 'Anterior' || entry.id === 'migrated-anterior'));
}

function compareAnteriorLabEntries(a, b) {
  var aAnterior = isAnteriorLabEntry(a);
  var bAnterior = isAnteriorLabEntry(b);
  if (aAnterior === bAnterior) return 0;
  return aAnterior ? 1 : -1;
}

function compareLabEntryTimestamps(a, b) {
  var ta = parseFechaLabToMs(a.fecha, a.hora);
  var tb = parseFechaLabToMs(b.fecha, b.hora);
  var aValid = typeof ta === 'number' && isFinite(ta);
  var bValid = typeof tb === 'number' && isFinite(tb);
  if (aValid !== bValid) return aValid ? -1 : 1;
  if (aValid && bValid && ta !== tb) return tb - ta;
  return 0;
}

function compareLabEntryHoras(a, b) {
  var ha = normalizeHoraLabHistory(a && a.hora);
  var hb = normalizeHoraLabHistory(b && b.hora);
  if (ha && hb && ha !== hb) return hb.localeCompare(ha);
  return 0;
}

function compareLabHistoryEntries(a, b) {
  var anteriorCmp = compareAnteriorLabEntries(a, b);
  if (anteriorCmp !== 0) return anteriorCmp;
  var timeCmp = compareLabEntryTimestamps(a, b);
  if (timeCmp !== 0) return timeCmp;
  return compareLabEntryHoras(a, b);
}

export function sortLabHistoryChronological(hist) {
  return (hist || []).slice().sort(compareLabHistoryEntries);
}

/** Número finito desde valor de tendencia (acepta <0.01, comas, *). */
export function parseTrendNumeric(raw) {
  if (raw == null || raw === '') return null;
  var s = String(typeof raw === 'object' && raw.val != null ? raw.val : raw).trim();
  if (!s || s === '---') return null;
  s = s.replace(/\*/g, '').replace(/^<\s*/, '').trim();
  if (!s) return null;
  var n = parseFloat(s.replace(',', '.'));
  return isFinite(n) ? n : null;
}

export function getSetTrendValueForSeries(set, sectionKey, fieldKey) {
  if (!set || !set.parsedBySection) return null;
  var pb = set.parsedBySection;
  if (!pb[sectionKey]) return null;
  return parseTrendNumeric(pb[sectionKey][fieldKey]);
}

/** Sets cronológicos ascendentes con al menos un valor en fieldKeys. */
export function columnSetsForFields(historyAsc, sectionKey, fieldKeys) {
  var seen = Object.create(null);
  var out = [];
  (historyAsc || []).forEach(function (set) {
    var ms = parseFechaLabToMs(set.fecha, set.hora);
    var colKey =
      typeof ms === 'number' && isFinite(ms)
        ? 't:' + ms
        : 'f:' + String(set.fecha) + '|h:' + normalizeHoraLabHistory(set.hora);
    if (seen[colKey]) return;
    var has = (fieldKeys || []).some(function (fk) {
      return getSetTrendValueForSeries(set, sectionKey, fk) != null;
    });
    if (!has) return;
    seen[colKey] = true;
    out.push(set);
  });
  return out;
}

export function dedupeTrendSetsForSeries(setsDesc, sectionKey, fieldKey) {
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < (setsDesc || []).length; i++) {
    var s = setsDesc[i];
    var v = getSetTrendValueForSeries(s, sectionKey, fieldKey);
    if (v == null || !isFinite(v)) continue;
    var ms = parseFechaLabToMs(s.fecha, s.hora);
    var key =
      typeof ms === 'number' && isFinite(ms)
        ? 't:' + ms + '|v:' + v + '|' + sectionKey + '|' + fieldKey
        : 'f:' + String(s.fecha) + '|h:' + normalizeHoraLabHistory(s.hora) + '|v:' + v + '|' + sectionKey + '|' + fieldKey;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(s);
  }
  return out;
}

/** setsAsc: cronológico ascendente (más antiguo primero). */
export function buildTrendAxisMeta(setsAsc) {
  var cols = setsAsc || [];
  var timeVis = buildTrendColumnTimeVisibility(cols);
  var dayCounts = Object.create(null);
  var points = cols.map(function (s, idx) {
    if (s.fecha === 'Anterior') {
      return { set: s, x: idx, dayLabel: 'Ant.', tooltipTime: '' };
    }
    var ms = parseFechaLabToMs(s.fecha, s.hora);
    var d = new Date(ms);
    var dayKey = isFinite(d.getTime())
      ? d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
      : 'raw:' + String(s.fecha);
    dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
    var n = dayCounts[dayKey];
    var dd = isFinite(d.getTime())
      ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
      : String(s.fecha).slice(0, 12);
    var hora = normalizeHoraLabHistory(s.hora);
    var jitter = n > 1 ? (n - 1) * 0.12 : 0;
    var showTimeInLabel = !!timeVis[colKeyForTrendSet(s)];
    return {
      set: s,
      x: idx + jitter,
      dayLabel: dd,
      tooltipTime: hora ? hora.slice(0, 5) : '',
      showTimeInLabel: showTimeInLabel
    };
  });
  return {
    points: points,
    labels: points.map(function (p) {
      if (p.set.fecha === 'Anterior') return 'Ant.';
      if (p.showTimeInLabel && p.tooltipTime) return p.dayLabel + ' ' + p.tooltipTime;
      return p.dayLabel;
    })
  };
}

/** Compat sparks: delegar a meta.labels */
export function buildTendChartLabels(setsAsc) {
  return buildTrendAxisMeta(setsAsc).labels;
}

function isErythrocytePercentField(fieldKey) {
  var f = String(fieldKey || '').trim();
  if (/^hto$/i.test(f)) return true;
  if (/^hct$/i.test(f)) return true;
  if (/^rdw$/i.test(f)) return true;
  if (/^ret/i.test(f)) return true;
  return false;
}

/** Paneles de la gráfica agrupada de BH (diferencial manual en panel propio). */
export const BH_PANEL_FAMILIES = [
  'bh-absolute',
  'bh-quality',
  'bh-diff-manual',
  'bh-coag'
];

/** Paneles para estudios distintos de BH / GASES. */
export const GENERIC_PANEL_FAMILIES = ['gases', 'percent-diff', 'percent-rbc', 'absolute'];

var BH_QUALITY_FIELDS = {
  VCM: true,
  HCM: true,
  CHCM: true,
  RDW: true,
  Hto: true,
  Ret: true,
  MPV: true
};
var BH_ABSOLUTE_FIELDS = {
  Hb: true,
  RBC: true,
  Leu: true,
  Neu: true,
  Lin: true,
  Mono: true,
  Baso: true,
  Eos: true,
  Plt: true
};
var BH_DIFF_FIELDS = {
  NeuPct: true,
  LinPct: true,
  MonoPct: true,
  EosPct: true,
  BasoPct: true,
  Bandas: true,
  Mielo: true,
  Metamielo: true,
  Promielo: true,
  Blastos: true,
  Atipicos: true
};
var BH_COAG_FIELDS = { TP: true, TTP: true, INR: true, Fib: true, DD: true };

/** Orden por defecto de paneles en el modal «Gráfica del estudio». */
export function familyOrderForSection(sectionKey) {
  if (sectionKey === 'BH') return BH_PANEL_FAMILIES.slice();
  return GENERIC_PANEL_FAMILIES.slice();
}

/** Migra claves de panel guardadas antes del split BH en 4 gráficas. */
export function migratePanelFamilyKey(sectionKey, familyKey) {
  var fam = String(familyKey || '');
  if (sectionKey !== 'BH') return fam;
  if (fam === 'percent-rbc') return 'bh-quality';
  if (fam === 'percent-diff' || fam === 'bh-diff') return 'bh-diff-manual';
  if (fam === 'absolute') return 'bh-absolute';
  return fam;
}

function classifyBhPanelFamily(fk, unit) {
  if (BH_COAG_FIELDS[fk]) return 'bh-coag';
  if (BH_DIFF_FIELDS[fk] || /Pct$/i.test(fk)) return 'bh-diff-manual';
  if (BH_QUALITY_FIELDS[fk] || isErythrocytePercentField(fk)) return 'bh-quality';
  if (BH_ABSOLUTE_FIELDS[fk]) return 'bh-absolute';
  if (String(unit || '').trim() === '%') return 'bh-quality';
  return 'bh-absolute';
}

function classifyGenericPanelFamily(fk, unit) {
  if (/Pct$/i.test(fk)) return 'percent-diff';
  if (isErythrocytePercentField(fk)) return 'percent-rbc';
  if (String(unit || '').trim() === '%' && !/Pct$/i.test(fk)) return 'percent-rbc';
  return 'absolute';
}

/** Familias de panel para gráfica agrupada (escalas compatibles). */
export function classifyTendPanelFamily(sectionKey, fieldKey, unit) {
  var fk = String(fieldKey || '').trim();
  if (sectionKey === 'GASES') return 'gases';
  if (sectionKey === 'BH') return classifyBhPanelFamily(fk, unit);
  return classifyGenericPanelFamily(fk, unit);
}

export function isPercentPanelFamily(family) {
  return (
    family === 'percent-diff' ||
    family === 'percent-rbc' ||
    family === 'bh-diff-manual' ||
    family === 'bh-diff' ||
    family === 'bh-quality'
  );
}

export function colKeyForTrendSet(set) {
  var ms = parseFechaLabToMs(set.fecha, set.hora);
  return typeof ms === 'number' && isFinite(ms)
    ? 't:' + ms
    : 'f:' + String(set.fecha) + '|h:' + normalizeHoraLabHistory(set.hora);
}

export function trendDayKey(set) {
  if (!set || set.fecha === 'Anterior') return 'anterior';
  var ms = parseFechaLabToMs(set.fecha, set.hora);
  if (typeof ms === 'number' && isFinite(ms)) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  return 'f:' + normalizeFechaLabHistory(set.fecha);
}

/** Muestra hora en encabezados solo si el mismo día tiene ≥2 tomas con horas distintas. */
export function buildTrendColumnTimeVisibility(columns) {
  var byDay = Object.create(null);
  (columns || []).forEach(function (set) {
    var dk = trendDayKey(set);
    if (!byDay[dk]) byDay[dk] = [];
    byDay[dk].push(normalizeHoraLabHistory(set.hora));
  });
  var showTime = Object.create(null);
  (columns || []).forEach(function (set) {
    var ck = colKeyForTrendSet(set);
    var horasOnDay = byDay[trendDayKey(set)] || [];
    if (horasOnDay.length < 2) {
      showTime[ck] = false;
      return;
    }
    var distinct = Object.create(null);
    horasOnDay.forEach(function (h) {
      distinct[h || ''] = true;
    });
    showTime[ck] = Object.keys(distinct).length >= 2;
  });
  return showTime;
}

export function formatTrendColumnHeader(set, columns, opts) {
  if (!set) return '';
  if (set.fecha === 'Anterior') return 'Anterior';
  var cols = columns && columns.length ? columns : [set];
  var vis =
    (opts && opts.timeVisibility) || buildTrendColumnTimeVisibility(cols);
  var ck = colKeyForTrendSet(set);
  var showTime = !!vis[ck];
  var date = normalizeFechaLabHistory(set.fecha) || String(set.fecha || '').trim();
  var hora = normalizeHoraLabHistory(set.hora);
  if (showTime && hora) return date + ' ' + hora.slice(0, 5);
  return date;
}

/** Etiqueta sin «%» duplicado; unidad aparte para tooltip/leyenda. */
export function formatTendSeriesLabel(cardTitle, fieldKey, unit) {
  var name = String(cardTitle || fieldKey || '').trim();
  var u = String(unit || '').trim();
  if (u === '%' && /%\s*$/.test(name)) {
    name = name.replace(/\s*%+\s*$/, '').trim();
  }
  return { name: name || fieldKey, unit: u };
}

/** Columnas compartidas por estudio (unión de sets con al menos un valor en la sección). */
export function buildSectionTableModel(historyAsc, sectionKey, catalogSpecs, getValue) {
  var colSets = [];
  var seenCol = Object.create(null);
  historyAsc.forEach(function (set) {
    var ms = parseFechaLabToMs(set.fecha, set.hora);
    var colKey =
      typeof ms === 'number' && isFinite(ms)
        ? 't:' + ms
        : 'f:' + set.fecha + '|h:' + normalizeHoraLabHistory(set.hora);
    if (seenCol[colKey]) return;
    var hasAny = catalogSpecs.some(function (sp) {
      return getValue(set, sp.fieldKey) != null;
    });
    if (!hasAny) return;
    seenCol[colKey] = true;
    colSets.push(set);
  });
  var rows = catalogSpecs.map(function (sp) {
    return {
      fieldKey: sp.fieldKey,
      label: sp.cardTitle || sp.fieldKey,
      unit: sp.unit || '',
      values: colSets.map(function (set) {
        return getValue(set, sp.fieldKey);
      })
    };
  });
  return { columns: colSets, rows: rows };
}
