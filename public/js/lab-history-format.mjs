/**
 * Utilidades de conjuntos de laboratorio en historial: parseo, fusión por tipo, estudios en nota.
 */
import { isCitoquimInterpretacionResLabChunk, looksLikeSomeLabReport } from './labs.js';
import { splitResLabsByTipo } from './cultivo-block-core.mjs';
import { compareLabSetIdForDedupe } from './lab-history-auto-store-core.mjs';
import {
  parseFechaLabToMs,
  normalizeFechaLabHistory,
  normalizeHoraLabHistory,
} from './tend-core.mjs';
import { inferFechaLabSetFromId } from './features/tendencias.mjs';
import { isModeSala } from './mode-features.mjs';

export function labSetParseFingerprint(set) {
  if (!set) return '';
  var parts = [];
  if (set.resLabs && set.resLabs.length) {
    parts.push('r:' + set.resLabs.join('\n'));
  }
  if (set.sourceText) parts.push('s:' + String(set.sourceText));
  if (set.bhExtras) {
    try {
      parts.push('b:' + JSON.stringify(set.bhExtras));
    } catch (_e) { void _e; }
  }
  return parts.join('|');
}

export function isLikelyLabDataLine(line) {
  if (!line) return false;
  var t = line.trim();
  if (!t) return false;
  if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(t)) return false;
  if (t.indexOf('\t') !== -1) return true;
  if (/^(BH|QS|ESC|PFHs|GASES|PIE|LCR|EGO|CUANTORINA|CULTIVO|SEROL|HECES)\b/i.test(t)) return true;
  return /\d/.test(t) && /[A-Za-z]/.test(t);
}

export function extractLabDataLines(lines) {
  return (lines || []).filter(isLikelyLabDataLine);
}

export function buildLabSetDateLine(set) {
  if (!set) return '';
  var rawDate = normalizeFechaLabHistory(set.fecha) || String(set.fecha || '').trim() || inferFechaLabSetFromId(set) || '';
  var rawHora = normalizeHoraLabHistory(set.hora);
  if (!rawDate) return '';
  return rawHora ? rawDate + ' ' + rawHora.slice(0, 5) : rawDate;
}

export function buildLabSetDateLineForNota(set) {
  if (!set) return '';
  if (set.fecha === 'Anterior' || set.id === 'migrated-anterior') return 'Anterior';
  var rawDate = normalizeFechaLabHistory(set.fecha) || String(set.fecha || '').trim() || inferFechaLabSetFromId(set) || '';
  if (!rawDate) return '';
  if (rawDate.length >= 5 && rawDate.indexOf('/') !== -1) return rawDate.slice(0, 5);
  return rawDate;
}

function resolveInferFn(inferFechaLabSetFromId) {
  return typeof inferFechaLabSetFromId === 'function'
    ? inferFechaLabSetFromId
    : function () {
        return '';
      };
}

function resolveLabHistoryRawFe(set, infer) {
  if (set.fecha === 'Anterior') return '';
  return (
    normalizeFechaLabHistory(set.fecha) ||
    String(set.fecha || '').trim() ||
    infer(set) ||
    ''
  );
}

function resolveLabHistoryFeLabel(set, infer, anteriorFallback) {
  var rawFe = resolveLabHistoryRawFe(set, infer);
  if (set.id === 'migrated-anterior') {
    return rawFe ? 'Anterior · ' + rawFe : anteriorFallback;
  }
  return rawFe || (set.fecha === 'Anterior' ? 'Anterior' : '—');
}

/** Etiqueta del historial: fecha y número de bloques (sin hora). */
export function formatLabHistoryListMeta(set, inferFechaLabSetFromId) {
  if (!set) return '—';
  var fe = resolveLabHistoryFeLabel(set, resolveInferFn(inferFechaLabSetFromId), 'Anterior (sin fecha en bloque)');
  var n = set.resLabs && set.resLabs.length ? set.resLabs.length : 0;
  return fe + ' · ' + n + ' bloque' + (n === 1 ? '' : 's');
}

function labHistoryTipoLabel(resLabs, primaryTipoFn) {
  var tipoFn =
    typeof primaryTipoFn === 'function'
      ? primaryTipoFn
      : function () {
          return 'labs';
        };
  var tipo = tipoFn(resLabs || []);
  if (tipo === 'cultivo') return 'Cultivo';
  if (tipo === 'mixed') return 'Mixto';
  return 'Labs';
}

/** Etiqueta compacta para el selector de fechas en Laboratorio → Resultados. */
export function formatLabHistoryDateSelectLabel(set, inferFechaLabSetFromId, primaryTipoFn) {
  if (!set) return '—';
  var fe = resolveLabHistoryFeLabel(set, resolveInferFn(inferFechaLabSetFromId), 'Anterior');
  var tipoLabel = labHistoryTipoLabel(set.resLabs, primaryTipoFn);
  var horaDisp = normalizeHoraLabHistory(set.hora);
  horaDisp = horaDisp ? String(horaDisp).trim().slice(0, 5) : '';
  if (horaDisp && fe !== '—' && fe.indexOf('Anterior') !== 0) {
    return fe + ' ' + horaDisp + ' · ' + tipoLabel;
  }
  return fe + ' · ' + tipoLabel;
}

export function labSetIsFromSome(set) {
  if (!set) return false;
  var src = String(set.sourceText || '').trim();
  if (!src) return false;
  if (/^Expediente\s*:/im.test(src)) return true;
  return looksLikeSomeLabReport(src);
}

export function dayKeyFromLabSet(set) {
  if (!set || set.fecha === 'Anterior') return 'Anterior';
  var ms = parseFechaLabToMs(set.fecha, set.hora);
  if (typeof ms === 'number' && isFinite(ms)) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  var n = normalizeFechaLabHistory(set.fecha);
  if (n && n !== 'Anterior') {
    var ms2 = parseFechaLabToMs(n, set.hora);
    if (typeof ms2 === 'number' && isFinite(ms2)) {
      var d2 = new Date(ms2);
      return d2.getFullYear() + '-' + (d2.getMonth() + 1) + '-' + d2.getDate();
    }
  }
  return 'unknown';
}

function dayKeyToSortMs(dk) {
  if (dk === 'Anterior') return Number.NEGATIVE_INFINITY;
  if (dk === 'unknown') return Number.MIN_SAFE_INTEGER;
  var p = dk.split('-').map(function (x) {
    return parseInt(x, 10);
  });
  if (p.length !== 3 || !isFinite(p[0])) return 0;
  return new Date(p[0], p[1] - 1, p[2]).getTime();
}

/**
 * Conjunto SOME solo gasometría (sin BH/QS/cultivo).
 * @param {unknown[]} [resLabs]
 */
export function isGasometriaOnlyResLabs(resLabs) {
  var sp = splitResLabsByTipo(resLabs || []);
  if (
    sp.cultivo.some(function (r) {
      return String(r || '').trim();
    })
  ) {
    return false;
  }
  var labRows = sp.labs.filter(function (r) {
    return String(r || '').trim();
  });
  if (!labRows.length) return false;
  return labRows.every(function (chunk) {
    var s = String(chunk).trim();
    return /^GASES\b/i.test(s) || /^INTERPRETACI[ÓO]N\s+GASOMETR[IÍ]A\s*:/i.test(s);
  });
}

export function primaryTipoForLabSet(resLabs) {
  if (isGasometriaOnlyResLabs(resLabs)) return 'gaso';
  var sp = splitResLabsByTipo(resLabs || []);
  var hasL = sp.labs.some(function (r) {
    return String(r || '').trim();
  });
  var hasC = sp.cultivo.some(function (r) {
    return String(r || '').trim();
  });
  if (hasC && hasL) return 'mixed';
  if (hasC) return 'cultivo';
  return 'labs';
}

function sortLabSetsWithinDay(a, b) {
  var ta = parseFechaLabToMs(a.fecha, a.hora);
  var tb = parseFechaLabToMs(b.fecha, b.hora);
  if (typeof ta === 'number' && typeof tb === 'number' && isFinite(ta) && isFinite(tb) && ta !== tb) {
    return tb - ta;
  }
  return compareLabSetIdForDedupe(a, b);
}

function sortLabHistoryDayKeys(a, b) {
  if (a === 'Anterior') return 1;
  if (b === 'Anterior') return -1;
  return dayKeyToSortMs(b) - dayKeyToSortMs(a);
}

function dayGroupLabel(dayKey, sets) {
  if (dayKey === 'Anterior') return 'Anterior';
  var header = sets[0];
  var dateLine = buildLabSetDateLineForNota(header) || dayKey;
  if (sets.length > 1) return dateLine + ' · ' + sets.length + ' envíos';
  return dateLine;
}

/**
 * Agrupa conjuntos de historial por día calendario (más reciente primero).
 * @param {unknown[]} orderedSets
 * @returns {Array<{ dayKey: string, sets: unknown[], label: string }>}
 */
export function groupLabHistoryByDay(orderedSets) {
  var byDay = Object.create(null);
  (orderedSets || []).forEach(function (set) {
    if (!set || !set.resLabs || !set.resLabs.length) return;
    var dk = dayKeyFromLabSet(set);
    if (!byDay[dk]) byDay[dk] = { dayKey: dk, sets: [] };
    byDay[dk].sets.push(set);
  });
  return Object.keys(byDay)
    .sort(sortLabHistoryDayKeys)
    .map(function (dk) {
      var sets = byDay[dk].sets.slice().sort(sortLabSetsWithinDay);
      return { dayKey: dk, sets: sets, label: dayGroupLabel(dk, sets) };
    });
}

/**
 * Texto de estudios (mismo formato que expediente) para uno o más días del historial.
 * @param {unknown[]} orderedSets
 * @param {{ onlyDayKeys?: Set<string>|string[] }} [options]
 * @returns {string[]}
 */
export function buildEstudiosCopyLinesFromLabSets(orderedSets, options) {
  var only = options && options.onlyDayKeys;
  var allowDay = null;
  if (only) {
    allowDay = only instanceof Set ? only : new Set(only);
  }
  var groups = groupLabHistoryByDay(orderedSets);
  var lines = [];
  groups.forEach(function (group) {
    if (allowDay && !allowDay.has(group.dayKey)) return;
    var sets = group.sets;
    var multiOnDay = sets.length > 1;
    sets.forEach(function (set) {
      var sp = splitResLabsByTipo(set.resLabs);
      var labsAcc = [];
      var cultAcc = [];
      sp.labs.forEach(function (row) {
        var clean = String(row == null ? '' : row).trim();
        if (!clean || isCitoquimInterpretacionResLabChunk(clean)) return;
        labsAcc.push(row);
      });
      sp.cultivo.forEach(function (row) {
        var clean = String(row == null ? '' : row).trim();
        if (!clean) return;
        cultAcc.push(row);
      });
      if (!labsAcc.length && !cultAcc.length) return;
      var dateLine = buildLabSetDateLineForNota(set);
      if (multiOnDay) {
        var hora = normalizeHoraLabHistory(set.hora);
        if (hora && dateLine) dateLine = dateLine + ' ' + hora.slice(0, 5);
      }
      if (dateLine) lines.push(dateLine);
      if (labsAcc.length) {
        labsAcc.forEach(function (row) {
          var clean = String(row == null ? '' : row).trim();
          if (clean) lines.push(clean);
        });
      }
      if (cultAcc.length) {
        if (labsAcc.length) lines.push('');
        lines.push('Cultivos');
        cultAcc.forEach(function (row) {
          var clean = String(row == null ? '' : row).trim();
          if (clean) lines.push(clean);
        });
      }
      lines.push('');
    });
  });
  while (lines.length && !String(lines[lines.length - 1]).trim()) lines.pop();
  return lines;
}

/**
 * En interconsulta la nota solo lleva el día más reciente; en sala, historial completo.
 * @param {unknown[]} orderedSets
 * @param {Record<string, unknown>|null|undefined} [settings]
 * @returns {{ onlyDayKeys?: string[] }}
 */
export function resolveEstudiosCopyOptions(orderedSets, settings) {
  if (isModeSala(settings)) return {};
  var groups = groupLabHistoryByDay(orderedSets);
  if (!groups.length) return {};
  return { onlyDayKeys: [groups[0].dayKey] };
}


