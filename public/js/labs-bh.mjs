// Biometría hemática (BH) — extracted from labs.js
import { extraerConRango, extraerConRangoBH, marcarSegunRango, fmt } from './labs-extract.mjs';
import { lineRichnessScore_ } from './labs-gaso-section.mjs';

export const BH_EXTRA_DISPLAY_LABELS = {
  RBC: 'Eri',
  CHCM: 'CHCM',
  RDW: 'RDW',
  MPV: 'VPM',
  Ret: 'Ret',
  Lin: 'Lin#',
  Mono: 'Mono#',
  Baso: 'Baso#',
  NeuPct: 'Seg',
  LinPct: 'Lin',
  MonoPct: 'Mono',
  EosPct: 'Eos',
  BasoPct: 'Baso',
  Bandas: 'Band',
  Mielo: 'Mielo',
  Metamielo: 'Meta',
  Promielo: 'Prom',
  Blastos: 'Blast',
  Atipicos: 'Atip',
};

export const BH_DIFF_DISPLAY_ORDER = [
  'NeuPct', 'LinPct', 'MonoPct', 'EosPct', 'BasoPct',
  'Bandas', 'Mielo', 'Metamielo', 'Promielo', 'Blastos', 'Atipicos',
];

export const BH_SCALAR_EXT_ORDER = ['RBC', 'CHCM', 'RDW', 'MPV', 'Ret', 'Lin', 'Mono', 'Baso'];

/** Orden de filas en tablas/gráficas de tendencia (reporte SOME, biometría hemática). */
export const BH_SOME_TREND_ORDER = [
  'RBC', 'Hb', 'Hto', 'VCM', 'HCM', 'CHCM', 'RDW',
  'Leu', 'Neu', 'NeuPct', 'Lin', 'LinPct', 'Mono', 'MonoPct', 'Eos', 'EosPct', 'Baso', 'BasoPct',
  'Plt', 'MPV',
  'Ret',
  'TP', 'TTP', 'INR', 'Fib', 'DD',
  'Bandas', 'Mielo', 'Metamielo', 'Promielo', 'Blastos', 'Atipicos',
];

/** Orden QS en SOME (QUIMICA CLINICA; analitos de la sección QS en R+). */
export const QS_SOME_TREND_ORDER = [
  'Glu', 'BUN', 'Cr', 'eTFG', 'AU',
  'PCR', 'PCT',
  'COL', 'TGL',
  'VSG', 'CPK',
];

export function sortTrendSpecsBySomeOrder(sectionKey, specs) {
  var order =
    sectionKey === 'BH' ? BH_SOME_TREND_ORDER : sectionKey === 'QS' ? QS_SOME_TREND_ORDER : null;
  if (!order) return (specs || []).slice();
  var rank = Object.create(null);
  order.forEach(function (fk, i) {
    rank[fk] = i;
  });
  return (specs || []).slice().sort(function (a, b) {
    var ra = Object.prototype.hasOwnProperty.call(rank, a.fieldKey) ? rank[a.fieldKey] : 9999;
    var rb = Object.prototype.hasOwnProperty.call(rank, b.fieldKey) ? rank[b.fieldKey] : 9999;
    if (ra !== rb) return ra - rb;
    return String(a.cardTitle || a.fieldKey).localeCompare(String(b.cardTitle || b.fieldKey), 'es');
  });
}

var BH_DIFF_RANGE_LABELS = {
  NeuPct: ['SEGMENTADOS', 'NEU%', 'NEUTROFILOS%'],
  LinPct: ['LINFOCITOS', 'LYM%', 'LINFOCITOS%'],
  MonoPct: ['MONOCITOS', 'MONO%'],
  EosPct: ['EOSINOFILOS', 'EOS%'],
  BasoPct: ['BASOFILOS', 'BASO%'],
  Bandas: ['BANDAS', 'CAYADOS'],
  Mielo: ['MIELOCITOS'],
  Metamielo: ['METAMIELOCITOS'],
  Promielo: ['PROMIELOCITOS'],
  Blastos: ['BLASTOS'],
  Atipicos: ['LINF. ATIPICOS', 'LINF ATIPICOS', 'LINFOCITOS ATIPICOS', 'VARIANTES', 'ATIPICOS'],
};

export function bhExtraDisplayLabel(key) {
  return BH_EXTRA_DISPLAY_LABELS[key] || key;
}

/** Títulos en tablas/gráficas (como en el reporte SOME). */
export const BH_TREND_TITLES = {
  NeuPct: 'Segmentados',
  LinPct: 'Linfocitos',
  MonoPct: 'Monocitos',
  EosPct: 'Eosinófilos',
  BasoPct: 'Basófilos',
  Bandas: 'Bandas',
  Mielo: 'Mielocitos',
  Metamielo: 'Metamielocitos',
  Promielo: 'Promielocitos',
  Blastos: 'Blastos',
  Atipicos: 'Linf. atípicos',
};

export function bhTrendDisplayTitle(fieldKey) {
  return BH_TREND_TITLES[fieldKey] || bhExtraDisplayLabel(fieldKey) || fieldKey;
}

var BH_OUTPUT_LABEL_TO_FIELD = {
  Seg: 'NeuPct',
  Lin: 'LinPct',
  Mono: 'MonoPct',
  Eos: 'EosPct',
  Baso: 'BasoPct',
  Band: 'Bandas',
  Meta: 'Metamielo',
  Mielo: 'Mielo',
  Prom: 'Promielo',
  Blast: 'Blastos',
  Atip: 'Atipicos',
  NeuPct: 'NeuPct',
  LinPct: 'LinPct',
  MonoPct: 'MonoPct',
  EosPct: 'EosPct',
  BasoPct: 'BasoPct',
  Bandas: 'Bandas',
  Metamielo: 'Metamielo',
  Promielo: 'Promielo',
  Blastos: 'Blastos',
  Atipicos: 'Atipicos',
  Hb: 'Hb',
  Hto: 'Hto',
  VCM: 'VCM',
  HCM: 'HCM',
  Leu: 'Leu',
  Neu: 'Neu',
  Plt: 'Plt',
  RBC: 'RBC',
  Eri: 'RBC',
  CHCM: 'CHCM',
  RDW: 'RDW',
  VPM: 'MPV',
  MPV: 'MPV',
  Ret: 'Ret',
  TP: 'TP',
  TTP: 'TTP',
  INR: 'INR',
  Fib: 'Fib',
  DD: 'DD',
};

function bhFieldKeyFromOutputLabel(label) {
  return BH_OUTPUT_LABEL_TO_FIELD[label] || label;
}

function parseBhTokenPairs_(text, into) {
  if (!text) return;
  var tokens = String(text).trim().split(/\s+/);
  var i = 0;
  while (i < tokens.length) {
    var label = tokens[i];
    if (!label || label === '-') {
      i++;
      continue;
    }
    var next = tokens[i + 1];
    if (next == null) {
      i++;
      continue;
    }
    var m = next.match(/^(-?\d+(?:[.,]\d+)?)(?:%)?(\*)?$/);
    if (m) {
      var fk = bhFieldKeyFromOutputLabel(label);
      var val = m[1].replace(',', '.');
      into[fk] = { val: val, ab: next.indexOf('*') >= 0 };
      i += 2;
    } else {
      i++;
    }
  }
}

/** Extrae pares campo→valor de una entrada resLabs BH (línea compacta o bloque multilínea). */
export function parseBhTrendValuesFromResLab(entry) {
  var out = {};
  if (!entry) return out;
  var lines = String(entry).split(/\r?\n/);
  lines.forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed) return;
    var tab = trimmed.indexOf('\t');
    if (tab < 0) return;
    var head = trimmed.substring(0, tab).trim().replace(/:$/, '');
    var body = trimmed.substring(tab + 1).trim();
    if (/^BH$/i.test(head) || /^COAG$/i.test(head)) {
      parseBhTokenPairs_(body, out);
      return;
    }
    if (body) parseBhTokenPairs_(body, out);
  });
  return out;
}

function formatBhDiffPctDisplay_(key, rawVal, tNorm) {
  var label = bhExtraDisplayLabel(key);
  var val = String(rawVal);
  var labels = BH_DIFF_RANGE_LABELS[key];
  if (labels && tNorm) {
    var d = extraerConRangoBH(labels, tNorm);
    if (d.valor && d.valor !== '---') {
      val = fmt(marcarSegunRango(d.valor, d.min, d.max));
    }
  }
  if (val.endsWith('*')) return label + ' ' + val.slice(0, -1) + '%*';
  return label + ' ' + val + '%';
}

/** Pares legibles para BH extendida (copiar nota / segunda fila). */
export function formatBhExtrasDisplayParts(bhExtras, sourceText) {
  if (!bhExtras || typeof bhExtras !== 'object') return [];
  var tNorm = sourceText ? String(sourceText) : '';
  var parts = [];
  var seen = {};
  function addScalarKey(k) {
    if (seen[k]) return;
    var v = bhExtras[k];
    if (v == null || String(v).trim() === '') return;
    seen[k] = true;
    parts.push(bhExtraDisplayLabel(k) + ' ' + String(v));
  }
  BH_SCALAR_EXT_ORDER.forEach(addScalarKey);
  BH_DIFF_DISPLAY_ORDER.forEach(function (k) {
    if (seen[k] || !bhExtras[k]) return;
    seen[k] = true;
    parts.push(formatBhDiffPctDisplay_(k, bhExtras[k], tNorm));
  });
  Object.keys(bhExtras).forEach(function (k) {
    if (seen[k]) return;
    var v = bhExtras[k];
    if (v == null || String(v).trim() === '') return;
    seen[k] = true;
    if (BH_DIFF_DISPLAY_ORDER.indexOf(k) !== -1) {
      parts.push(formatBhDiffPctDisplay_(k, v, tNorm));
    } else {
      parts.push(bhExtraDisplayLabel(k) + ' ' + String(v));
    }
  });
  return parts;
}

export function formatBhExtrasDisplayLine(bhExtras, sourceText) {
  var parts = formatBhExtrasDisplayParts(bhExtras, sourceText);
  if (!parts.length) return '';
  return 'BH ext\t' + parts.join('  ');
}

function pairListToDisplay_(pairs) {
  var out = [];
  for (var i = 0; i < pairs.length; i += 2) {
    if (pairs[i + 1] !== undefined) out.push(pairs[i] + ' ' + pairs[i + 1]);
  }
  return out.join('  ');
}

function formatCoagResLabLine_(coagDisplay) {
  if (!coagDisplay || !coagDisplay.length) return '';
  return 'COAG\t' + coagDisplay.join('  ');
}

function extractCoagBodyFromBhLine_(line) {
  var m = String(line || '').match(/^(?:COAG|Coag\.?)\t(.+)/i);
  return m ? m[1].trim() : '';
}

function extraerSimpleBh_(labels, texto) {
  if (!texto) return '';
  for (var li = 0; li < labels.length; li++) {
    var lbl = labels[li];
    var idx = -1;
    var up = String(texto).toUpperCase();
    var lu = lbl.toUpperCase();
    var from = 0;
    while (true) {
      var p = up.indexOf(lu, from);
      if (p === -1) break;
      var after = up.charAt(p + lu.length);
      var before = up.charAt(p - 1) || ' ';
      var isWordBoundaryBefore = !/[A-Z0-9_]/.test(before);
      var isExactBoundary = lu.charAt(lu.length - 1) === '%' || !/[A-Z0-9]/.test(after);
      if (isWordBoundaryBefore && isExactBoundary) {
        idx = p + lu.length;
        break;
      }
      from = p + lu.length;
    }
    if (idx === -1) continue;
    var sub = texto.substring(idx, idx + 80);
    var m = sub.match(/(-?\d+[.,]?\d*)/);
    if (m) return m[1].replace(',', '.');
  }
  return '';
}

function fmtBhRanged_(data) {
  return fmt(marcarSegunRango(data.valor, data.min, data.max));
}

function extractBhScalarFields_(tNorm) {
  return {
    Hb: fmtBhRanged_(extraerConRango(['HGB', 'HEMOGLOBINA TOTAL', 'HEMOGLOBINA'], tNorm)),
    Hto: fmtBhRanged_(extraerConRango(['HCT ', 'HEMATOCRITO'], tNorm)),
    VCM: fmtBhRanged_(extraerConRango(['MCV ', 'VCM '], tNorm)),
    HCM: fmtBhRanged_(extraerConRango(['MCH ', 'HCM '], tNorm)),
    CHCM: fmtBhRanged_(extraerConRango(['MCHC', 'CHCM'], tNorm)),
    RDW: fmtBhRanged_(extraerConRango(['RDW '], tNorm)),
    Leu: fmtBhRanged_(extraerConRango(['WBC '], tNorm)),
    RBC: fmtBhRanged_(extraerConRangoBH(['RBC ', 'ERITROCITOS', 'HEMATIES'], tNorm)),
    Plt: fmtBhRanged_(extraerConRango(['PLT '], tNorm)),
    MPV: fmtBhRanged_(extraerConRango(['MPV ', 'VPM '], tNorm)),
    Ret: fmtBhRanged_(extraerConRango(['RETICULOCITOS'], tNorm)),
    TP: fmtBhRanged_(extraerConRango(['TIEMPO DE PROTROMBINA'], tNorm)),
    TTP: fmtBhRanged_(extraerConRango(['TIEMPO DE TROMBOPLASTINA'], tNorm)),
    INR: fmtBhRanged_(extraerConRango(['INR ', 'INR'], tNorm)),
    Fib: fmtBhRanged_(extraerConRango(['FIBRINOGENO'], tNorm)),
    DD: fmtBhRanged_(extraerConRango(['DIMERO D', 'D-DIMERO', 'D DIMERO'], tNorm)),
    Neu: fmtBhRanged_(extraerConRango(['NEU '], tNorm)),
    Eos: fmtBhRanged_(extraerConRango(['EOS '], tNorm)),
  };
}

function pushBhExtra_(extras, key, value) {
  if (value && value !== '---' && value !== '') extras[key] = String(value);
}

function buildBhExtras_(tNorm, Leu) {
  var extras = {};
  var linData = extraerConRango(['LYM ', 'LINFOCITOS'], tNorm);
  var monoData = extraerConRango(['MONO '], tNorm);
  var basoData = extraerConRango(['BASO '], tNorm);
  if (Leu !== '---') {
    pushBhExtra_(extras, 'Lin', linData.valor);
    pushBhExtra_(extras, 'Mono', monoData.valor);
    pushBhExtra_(extras, 'Baso', basoData.valor);
  }
  pushBhExtra_(extras, 'NeuPct', extraerSimpleBh_(['NEU%', 'NEUTROFILOS%', 'SEGMENTADOS'], tNorm));
  pushBhExtra_(extras, 'LinPct', extraerSimpleBh_(['LYM%', 'LINFOCITOS%', 'LINFOCITOS'], tNorm));
  pushBhExtra_(extras, 'MonoPct', extraerSimpleBh_(['MONO%', 'MONOCITOS%', 'MONOCITOS'], tNorm));
  pushBhExtra_(extras, 'EosPct', extraerSimpleBh_(['EOS%', 'EOSINOFILOS%', 'EOSINOFILOS'], tNorm));
  pushBhExtra_(extras, 'BasoPct', extraerSimpleBh_(['BASO%', 'BASOFILOS%', 'BASOFILOS'], tNorm));
  pushBhExtra_(extras, 'Bandas', extraerSimpleBh_(['BANDAS', 'CAYADOS'], tNorm));
  pushBhExtra_(extras, 'Mielo', extraerSimpleBh_(['MIELOCITOS'], tNorm));
  pushBhExtra_(extras, 'Metamielo', extraerSimpleBh_(['METAMIELOCITOS'], tNorm));
  pushBhExtra_(extras, 'Promielo', extraerSimpleBh_(['PROMIELOCITOS'], tNorm));
  pushBhExtra_(extras, 'Blastos', extraerSimpleBh_(['BLASTOS'], tNorm));
  pushBhExtra_(
    extras,
    'Atipicos',
    extraerSimpleBh_(
      ['LINF. ATIPICOS', 'LINF ATIPICOS', 'LINFOCITOS ATIPICOS', 'VARIANTES', 'ATIPICOS'],
      tNorm
    )
  );
  return extras;
}

function buildBhCorePairs_(f) {
  var corePairs = [];
  if (f.Hb !== '---') corePairs.push('Hb', f.Hb);
  if (f.Hto !== '---') corePairs.push('Hto', f.Hto);
  if (f.VCM !== '---') corePairs.push('VCM', f.VCM);
  if (f.HCM !== '---') corePairs.push('HCM', f.HCM);
  if (f.Leu !== '---') corePairs.push('Leu', f.Leu);
  if (f.Neu !== '---') corePairs.push('Neu', f.Neu);
  if (f.Eos !== '---') corePairs.push('Eos', f.Eos);
  if (f.Plt !== '---') corePairs.push('Plt', f.Plt);
  return corePairs;
}

function buildBhCoagDisplay_(f) {
  var coagDisplay = [];
  if (f.TP !== '---') coagDisplay.push('TP ' + f.TP);
  if (f.TTP !== '---') coagDisplay.push('TTP ' + f.TTP);
  if (f.INR !== '---') coagDisplay.push('INR ' + f.INR);
  if (f.Fib !== '---') coagDisplay.push('Fib ' + f.Fib);
  if (f.DD !== '---') coagDisplay.push('DD ' + f.DD);
  return coagDisplay;
}

function mergeBhIndexExtras_(extras, f) {
  if (f.RBC !== '---') pushBhExtra_(extras, 'RBC', f.RBC);
  if (f.CHCM !== '---') pushBhExtra_(extras, 'CHCM', f.CHCM);
  if (f.RDW !== '---') pushBhExtra_(extras, 'RDW', f.RDW);
  if (f.MPV !== '---') pushBhExtra_(extras, 'MPV', f.MPV);
  if (f.Ret !== '---') pushBhExtra_(extras, 'Ret', f.Ret);
}

function buildBhDiffDisplay_(extras, tNorm, hasCompactBody) {
  if (hasCompactBody) return [];
  var diffDisplay = [];
  BH_DIFF_DISPLAY_ORDER.forEach(function (k) {
    var v = extras[k];
    if (!v || v === '0') return;
    diffDisplay.push(formatBhDiffPctDisplay_(k, v, tNorm));
  });
  return diffDisplay;
}

function buildBhIndexDisplay_(f, hasCompactBody) {
  if (hasCompactBody) return [];
  var indexDisplay = [];
  if (f.RBC !== '---') indexDisplay.push('Eri ' + f.RBC);
  if (f.CHCM !== '---') indexDisplay.push('CHCM ' + f.CHCM);
  if (f.RDW !== '---') indexDisplay.push('RDW ' + f.RDW);
  if (f.MPV !== '---') indexDisplay.push('VPM ' + f.MPV);
  if (f.Ret !== '---') indexDisplay.push('Ret ' + f.Ret);
  return indexDisplay;
}

function buildBhVisibleLine_(hasCompactBody, corePairs, indexDisplay, diffDisplay) {
  if (hasCompactBody) return 'BH\t' + pairListToDisplay_(corePairs);
  if (!indexDisplay.length && !diffDisplay.length) return '';
  var sub = ['BH:'];
  if (indexDisplay.length) sub.push('  Hem.\t' + indexDisplay.join('  '));
  if (diffDisplay.length) sub.push('  Dif.\t' + diffDisplay.join('  '));
  return sub.join('\n');
}

function bhHasAnyData_(f, extras) {
  var hasCore = [f.Hb, f.Hto, f.VCM, f.HCM, f.Leu, f.Neu, f.Eos, f.Plt].some(function (v) {
    return v !== '---';
  });
  var hasExtIdx = [f.RBC, f.CHCM, f.RDW, f.MPV, f.Ret].some(function (v) {
    return v !== '---';
  });
  var hasCoag = [f.TP, f.TTP, f.INR, f.Fib, f.DD].some(function (v) {
    return v !== '---';
  });
  return hasCore || hasExtIdx || hasCoag || Object.keys(extras).length > 0;
}

export function parseBH_(tNorm) {
  var f = extractBhScalarFields_(tNorm);
  var extras = buildBhExtras_(tNorm, f.Leu);
  if (!bhHasAnyData_(f, extras)) return { visible: '', coagVisible: '', extras: {} };

  var corePairs = buildBhCorePairs_(f);
  var hasCompactBody = corePairs.length > 0;
  var coagDisplay = buildBhCoagDisplay_(f);
  if (hasCompactBody || coagDisplay.length) mergeBhIndexExtras_(extras, f);

  var visible = buildBhVisibleLine_(
    hasCompactBody,
    corePairs,
    buildBhIndexDisplay_(f, hasCompactBody),
    buildBhDiffDisplay_(extras, tNorm, hasCompactBody)
  );
  return { visible: visible, coagVisible: formatCoagResLabLine_(coagDisplay), extras: extras };
}

/** Une varias filas BH del mismo día (p. ej. biometría + dímero D en solicitudes distintas). */
export function mergeBhResLabRows_(rows) {
  var list = (rows || [])
    .map(function (r) {
      return String(r == null ? '' : r);
    })
    .filter(function (s) {
      return /^BH\b/i.test(s.trim());
    });
  if (!list.length) return { bh: '', coag: '' };

  var best = list[0];
  var bestScore = lineRichnessScore_(best);
  for (var i = 1; i < list.length; i++) {
    var sc = lineRichnessScore_(list[i]);
    if (sc > bestScore) {
      bestScore = sc;
      best = list[i];
    }
  }

  var coagByKey = Object.create(null);
  list.forEach(function (row) {
    String(row)
      .split(/\r?\n/)
      .forEach(function (line) {
        var body = extractCoagBodyFromBhLine_(line);
        if (!body) return;
        body.split(/\s{2,}/).forEach(function (tok) {
          var t = tok.trim();
          if (!t) return;
          var key = t.split(/\s+/)[0];
          var score = lineRichnessScore_(t);
          var prev = coagByKey[key];
          if (!prev || score > prev.score) coagByKey[key] = { tok: t, score: score };
        });
      });
  });
  var coagTokens = Object.keys(coagByKey).map(function (k) {
    return coagByKey[k].tok;
  });
  var coag = coagTokens.length ? formatCoagResLabLine_(coagTokens) : '';

  var lines = best.split(/\r?\n/).filter(function (line) {
    return !/^(?:\s*Coag\.|COAG)\t/i.test(line.trim());
  });
  var bh = lines.join('\n').trim();
  return { bh: bh, coag: coag };
}

// Procalcitonina viene en bloque "ESTUDIOS ESPECIALES" con un rango de
// referencia que mezcla intervalos pediátricos por horas (e.g. "0 - 5
// HORAS"); el extractor genérico tomaría esos números como rango. Aquí
