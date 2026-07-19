import { escTxt } from './labs-display.mjs';
import { findCultivoGermenRuns, parseSensCrudasAntibiogramaSlice } from './labs-cultivo-scan.mjs';

export function formatCultivoCondensedForCopy(chunkText, _studyDateLine) {
  var lines = [];
  var chunkLines = String(chunkText || '')
    .trim()
    .split(/\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  if (!chunkLines.length) return lines.join('\n');
  var head = chunkLines[0]
    .replace(/\s*·\s*Preliminar\b/gi, '')
    .replace(/\s*·\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (head) lines.push(head);
  for (var i = 1; i < chunkLines.length; i++) {
    if (/^ATB\b/i.test(chunkLines[i]) || /^Cuenta:/i.test(chunkLines[i])) {
      lines.push(chunkLines[i]);
    }
  }
  return lines.join('\n');
}

export function formatSensCrudasBlockForCopy(sensCrudas) {
  if (!sensCrudas || !sensCrudas.length) return '';
  var lines = [];
  sensCrudas.forEach(function (s) {
    lines.push(String(s.med || '').trim());
    var mic = String(s.mic || '').trim();
    var it = String(s.interp || '').trim().toUpperCase();
    lines.push((mic ? mic + '\t' : '') + it);
    lines.push('*');
  });
  return lines.join('\n');
}

/** Clasifica interpretación de antibiograma en buckets r | i | s. */
export function classifyAtbInterp(itRaw) {
  var u = String(itRaw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (u === 'S' || u === 'POS' || u === 'SENSIBLE' || u === 'SUSCEPTIBLE') return 's';
  if (
    u === 'I' ||
    u === 'IND' ||
    u.indexOf('INDETER') !== -1 ||
    u.indexOf('INTERMED') !== -1
  ) {
    return 'i';
  }
  return 'r';
}

/**
 * Chips compactos: solo R / I / S. title = antibiótico + CMI + interpretación original.
 */
export function buildAtbChipsHtml(sensCrudas) {
  if (!sensCrudas || !sensCrudas.length) return '';
  return sensCrudas
    .map(function (s) {
      var itTrim = String(s.interp || '').trim();
      var bucket = classifyAtbInterp(itTrim);
      var label = bucket === 's' ? 'S' : bucket === 'i' ? 'I' : 'R';
      var med = String(s.med || '').trim();
      var mic = String(s.mic || '').trim();
      var title = escTxt(
        med + (mic ? ' ' + mic : '') + (itTrim ? ' — ' + itTrim : '')
      );
      return (
        '<span class="atb-chip atb-chip--' +
        bucket +
        '" title="' +
        title +
        '" tabindex="0">' +
        escTxt(label) +
        '</span>'
      );
    })
    .join('');
}

/** Para ordenar: primer valor numérico de CMI (≤8 → 8, >=256 → 256). */
export function extractMicSortKey(micRaw) {
  var t = String(micRaw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,/g, '.')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=');
  if (!t) return NaN;
  var m = t.match(/(?:<=|>=|<|>|=)?\s*(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return NaN;
}

function sortSensByGradeInBucket(items, bucket) {
  var arr = items.slice();
  arr.sort(function (a, b) {
    var ka = extractMicSortKey(a.mic);
    var kb = extractMicSortKey(b.mic);
    var na = isNaN(ka);
    var nb = isNaN(kb);
    if (na && nb) {
      return String(a.med || '').localeCompare(String(b.med || ''), 'es', { sensitivity: 'base' });
    }
    if (na) return 1;
    if (nb) return -1;
    if (bucket === 'r') {
      if (kb !== ka) return kb - ka;
      return String(a.med || '').localeCompare(String(b.med || ''), 'es', { sensitivity: 'base' });
    }
    if (ka !== kb) return ka - kb;
    return String(a.med || '').localeCompare(String(b.med || ''), 'es', { sensitivity: 'base' });
  });
  return arr;
}

function formatAtbDetailRowHtml(s) {
  var med = String(s.med || '').trim();
  var mic = String(s.mic || '').trim();
  var itTrim = String(s.interp || '').trim();
  var medEl = '<span class="atb-ris-drug">' + escTxt(med || '—') + '</span>';
  var chunks = [];
  if (mic) {
    chunks.push(
      '<span class="atb-ris-mic"><span class="atb-ris-mic-lbl">CMI</span> ' + escTxt(mic) + '</span>'
    );
  }
  if (itTrim) {
    chunks.push(
      '<span class="atb-ris-int atb-ris-int--' +
        escTxt(classifyAtbInterp(itTrim)) +
        '">' +
        escTxt(itTrim) +
        '</span>'
    );
  }
  var meta =
    chunks.length > 0
      ? '<span class="atb-ris-meta">' +
        chunks.join('<span class="atb-ris-meta-sep" aria-hidden="true">·</span>') +
        '</span>'
      : '';
  return (
    '<li class="atb-ris-detail-item">' +
    '<div class="atb-ris-detail-line">' +
    medEl +
    (meta ? meta : '') +
    '</div></li>'
  );
}

/**
 * Resumen antibiograma: como mucho tres letras (R, I, S), cada una una sola vez.
 * Hover / foco en cada letra abre solo el bloque correspondiente.
 */
export function buildAtbRisSummaryHtml(sensCrudas) {
  if (!sensCrudas || !sensCrudas.length) return '';
  var buckets = { r: [], i: [], s: [] };
  sensCrudas.forEach(function (s) {
    buckets[classifyAtbInterp(s.interp)].push(s);
  });
  var order = [
    { key: 'r', label: 'R', panelTitle: 'Resistencias' },
    { key: 'i', label: 'I', panelTitle: 'Indeterminado' },
    { key: 's', label: 'S', panelTitle: 'Sensible' },
  ];
  var wraps = [];
  order.forEach(function (o) {
    var list = buckets[o.key];
    if (!list.length) return;
    var sorted = sortSensByGradeInBucket(list, o.key);
    var items = sorted.map(formatAtbDetailRowHtml).join('');
    wraps.push(
      '<span class="cult-atb-ris-chip-wrap">' +
      '<span class="atb-chip atb-chip--' +
      o.key +
      '" tabindex="0" role="button">' +
      escTxt(o.label) +
      '</span>' +
      '<div class="atb-ris-hover-panel atb-ris-hover-panel--' +
      o.key +
      '" role="region" aria-label="' +
      escTxt(o.panelTitle) +
      '">' +
      '<div class="atb-ris-panel-head">' +
      escTxt(o.panelTitle) +
      '</div>' +
      '<ul class="atb-ris-detail-list">' +
      items +
      '</ul>' +
      '</div>' +
      '</span>'
    );
  });
  return (
    '<div class="cult-atb-ris-summary">' +
    '<div class="cult-atb-ris-chips" role="group" aria-label="Antibiograma (R / I / S); coloca el cursor sobre cada letra para el detalle">' +
    wraps.join('') +
    '</div>' +
    '</div>'
  );
}

/** Recupera pares antibiótico–resultado desde el informe pegado para un germen. */
export function extractSensCrudasForGermFromSource(sourceText, germQuery) {
  var q = String(germQuery || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!q || q === '—' || q === 'NEGATIVO') return null;
  var lineasTexto = String(sourceText || '').split('\n').map(function (l) {
    return l.replace(/\r/g, '');
  });
  var runs = findCultivoGermenRuns(lineasTexto);
  function matches(run) {
    var g = String(run.germen || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    if (!g) return false;
    if (g === q || q === g) return true;
    if (q.indexOf(g) !== -1 || g.indexOf(q) !== -1) return true;
    var qTok = q.split(/\s+/).filter(Boolean)[0] || '';
    var gTok = g.split(/\s+/).filter(Boolean)[0] || '';
    if (qTok.length > 3 && gTok.length > 3 && (qTok === gTok || q.indexOf(gTok) === 0 || g.indexOf(qTok) === 0)) return true;
    return false;
  }
  for (var ri = 0; ri < runs.length; ri++) {
    if (!matches(runs[ri])) continue;
    var sliceLines = lineasTexto.slice(runs[ri].i0, runs[ri].i1);
    var subNorm = sliceLines.join('\n');
    var idxAbLoc = subNorm.toUpperCase().indexOf('ANTIBIOGRAMA');
    if (idxAbLoc === -1) return null;
    var lineasAb = subNorm.substring(idxAbLoc).split('\n').map(function (l) {
      return l.replace(/\r/g, '').replace(/\*+/g, '').trim();
    });
    return parseSensCrudasAntibiogramaSlice(lineasAb);
  }
  return null;
}

/**
 * Cabecera de bloque generado por parseCultivo_ (p. ej. SECRECION DE HERIDA (TRAQUEO) 24/05: PSEUDOMONAS).
 * Usar en Cultivos / historial para no descartar muestras con paréntesis.
 */
export function isParsedCultivoHeaderLine(t) {
  var s = String(t || '').trim();
  if (!s) return false;
  if (/^CULTIVO\b/i.test(s)) return true;
  if (/^(UROCULTIVO|HEMOCULTIVO|FUNGICULTIVO)\b/i.test(s)) return true;
  if (/^TINCION\s+DE\s+GRAM/i.test(s)) return true;
  if (/^CATETER\b/i.test(s)) return true;
  if (/^BACILOSCOPIA\b/i.test(s)) return true;
  if (/^CULTIVO\s+DE\s+MICOBACTERIAS\b/i.test(s)) return true;
  if (/^(SECRECION|LIQUIDO|ASPIRADO|ABSCESO|BRONCOALVEOLAR)\b/i.test(s)) return true;
  return /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ()\s/.-]*\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?:\s+\S/i.test(s);
}
