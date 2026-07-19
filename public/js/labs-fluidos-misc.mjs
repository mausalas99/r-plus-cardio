import { extraerConRango, marcarSegunRango, fmt } from './labs-extract.mjs';

var HECES_ROW_DEFS = [
  { key: 'ASPECTO', out: 'Asp' },
  { key: 'PH', out: 'pH' },
  { key: 'PROTEINAS', out: 'Prot' },
  { key: 'GLUCOSA', out: 'Glu' },
  { key: 'LEUCOCITOS', out: 'Leu' },
  { key: 'ERITROCITOS', out: 'Eri' },
  { key: 'GRASA', out: 'Grasa' },
  { key: 'FIBRAS MUSCULARES', out: 'Fibra' },
  { key: 'COPROPARASITOSCOPICO INMEDIATO', out: 'Copro' },
  { key: 'OBSERVACIONES', out: 'Obs' },
];

function nextMeaningfulInBlock_(bloque, iStart, maxStep, skipNumericOnly) {
  for (var k = iStart + 1; k < Math.min(iStart + maxStep, bloque.length); k++) {
    var txt = (bloque[k] || '').replace(/\*/g, '').trim();
    if (!txt || txt === ':') continue;
    if (/^ESTUDIO|RESULTADO|UNIDADES|VALOR DE REFERENCIA$/i.test(txt)) continue;
    if (skipNumericOnly && /^\d+(\.\d+)?$/.test(txt)) continue;
    return txt;
  }
  return '';
}

function findHecesBlock_(lineas) {
  var i0 = -1;
  for (var i = 0; i < lineas.length; i++) {
    if (lineas[i].toUpperCase().indexOf('FISICOQUIMICO DE HECES') !== -1) {
      i0 = i;
      break;
    }
  }
  if (i0 === -1) return null;
  var i1 = lineas.length;
  for (var j = i0 + 1; j < lineas.length; j++) {
    if (
      /^(BACTERIOLOGIA|HEMATOLOGIA|QUIMICA CLINICA|INMUNOLOGIA|GASOMETRIA|COAGULACION|URIANALISIS|EXAMEN GENERAL DE ORINA|CULTIVO)\b/i.test(
        lineas[j]
      )
    ) {
      i1 = j;
      break;
    }
  }
  return lineas.slice(i0, i1);
}

function readHecesRowValue_(bloque, row) {
  for (var bi = 0; bi < bloque.length; bi++) {
    if (bloque[bi].toUpperCase().indexOf(row.key) !== 0) continue;
    var v = nextMeaningfulInBlock_(bloque, bi, 7, false);
    if (row.key === 'ASPECTO' && /^\d+(\.\d+)?$/.test(v)) {
      var v2 = nextMeaningfulInBlock_(bloque, bi, 10, true);
      if (v2) v = v + ' ' + v2;
    }
    return v ? v.toUpperCase() : '';
  }
  return '';
}

export function parseFisicoquimicoHeces_(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  if (textoBruto.toUpperCase().indexOf('FISICOQUIMICO DE HECES') === -1) return '';
  var lineas = textoBruto.split(/\r?\n/).map(function (l) {
    return String(l || '').trim();
  });
  var bloque = findHecesBlock_(lineas);
  if (!bloque) return '';

  var p = ['HECES'];
  for (var r = 0; r < HECES_ROW_DEFS.length; r++) {
    var v = readHecesRowValue_(bloque, HECES_ROW_DEFS[r]);
    if (v) p.push(HECES_ROW_DEFS[r].out, v);
  }
  if (p.length <= 1) return '';
  return p[0] + '\t' + p.slice(1).join(' ');
}

export function parseFrotisSangre_(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  var tUp = textoBruto.toUpperCase();
  if (tUp.indexOf('FROTIS DE SANGRE PERIFERICA') === -1) return '';

  var lineas = textoBruto.split(/\r?\n/).map(function (l) {
    return String(l || '').trim();
  });
  var i0 = -1;
  for (var i = 0; i < lineas.length; i++) {
    if (lineas[i].toUpperCase().indexOf('FROTIS DE SANGRE PERIFERICA') !== -1) {
      i0 = i;
      break;
    }
  }
  if (i0 === -1) return '';

  function nextMeaningful(iStart, maxStep) {
    for (var j = iStart + 1; j < Math.min(iStart + maxStep, lineas.length); j++) {
      var txt = (lineas[j] || '').replace(/\*/g, '').trim();
      if (!txt || txt === ':') continue;
      if (/^ESTUDIO|RESULTADO|UNIDADES|VALOR DE REFERENCIA$/i.test(txt)) continue;
      if (/^FROTIS DE SANGRE PERIFERICA$/i.test(txt)) continue;
      return txt;
    }
    return '';
  }

  var desc = '';
  for (var k = i0; k < Math.min(i0 + 20, lineas.length); k++) {
    if (lineas[k].toUpperCase().indexOf('FROTIS DE SANGRE PERIFERICA') !== 0) continue;
    desc = nextMeaningful(k, 8);
    if (desc) break;
  }
  if (!desc) return '';
  var lines = formatFrotisSangreLines_(desc);
  var plaqObs = extraerObservacionPlaquetasHema_(textoBruto);
  if (plaqObs) {
    lines = lines ? lines + '\nFROTIS\tPlaqObs ' + plaqObs : 'FROTIS\tPlaqObs ' + plaqObs;
  }
  return lines;
}

/** OBSERVACIONES del bloque hematología (p. ej. PLAQUETAS DISMINUIDAS ++). */
function extraerObservacionPlaquetasHema_(textoBruto) {
  if (!textoBruto || !/PLAQUETAS\s+DISMINUIDAS/i.test(textoBruto)) return '';
  var lineas = textoBruto.split(/\r?\n/).map(function (l) {
    return String(l || '').replace(/\*/g, '').trim();
  });
  for (var i = 0; i < lineas.length; i++) {
    if (!/^OBSERVACIONES$/i.test(lineas[i])) continue;
    for (var j = i + 1; j < Math.min(i + 6, lineas.length); j++) {
      var t = lineas[j];
      if (!t || /^[ABHL]$/i.test(t)) continue;
      if (/^FROTIS|TIEMPO DE|FIBRINOGENO|DIMERO|HEMATOLOGIA/i.test(t)) break;
      if (/PLAQUETAS/i.test(t)) return t.toUpperCase();
    }
  }
  return 'PLAQUETAS DISMINUIDAS';
}

/** Separa calidad eritrocitaria (morfología) de observaciones plaquetarias/recuento en el frotis. */
function formatFrotisSangreLines_(desc) {
  var up = String(desc || '').toUpperCase().trim();
  if (!up) return '';
  var calTokens = [];
  var plaqTokens = [];
  var otros = [];
  up.split(/\s*,\s*/).forEach(function (chunk) {
    var c = chunk.trim();
    if (!c) return;
    if (/PLAQUET|MACROPLAQUET/i.test(c)) plaqTokens.push(c);
    else if (
      /HIPOCROM|ANISOCIT|POIKILOCIT|ESFEROCIT|ELIPT|DACRIOCIT|ESQUIZOCIT|BITE|ROD|HELIN|CABEZA|CUELLO|CABEZA DE FLECHA|POLICROM|NORMOCROM|NORMOCIT|MACROCIT|MICROCIT|\+/i.test(c)
    ) {
      calTokens.push(c);
    } else otros.push(c);
  });
  var lines = [];
  if (calTokens.length) lines.push('FROTIS\tCal ' + calTokens.join(', '));
  if (plaqTokens.length) lines.push('FROTIS\tPlaq ' + plaqTokens.join(', '));
  if (otros.length) lines.push('FROTIS\tObs ' + otros.join(', '));
  if (!lines.length) lines.push('FROTIS\tObs ' + up);
  return lines.join('\n');
}

/**
 * Plaquetas con citrato (SOME): solo conteo plaquetario en muestra citratada.
 */
export function parsePlaquetasCitrato_(textoBruto, tNorm) {
  if (!tNorm || !/PLAQUETAS\s+CON\s+CITRATO/i.test(tNorm)) return '';
  var bloque = '';
  var m = textoBruto.match(
    /PLAQUETAS\s+CON\s+CITRATO[\s\S]*?(?=\n\s*(?:HEMATOLOGIA|QUIMICA\s+CLINICA|URIANALISIS|BACTERIOLOGIA|GASOMETRIA|BIOMETRIA|COAGULACION)\b|$)/i
  );
  bloque = m ? m[0].replace(/\s+/g, ' ') : tNorm;
  var pltData = extraerConRango(['CUENTA DE PLAQUETAS', 'PLT '], bloque);
  if (pltData.valor === '---') return '';
  var Plt = fmt(marcarSegunRango(pltData.valor, pltData.min, pltData.max));
  return 'PltCit\tPlt ' + Plt;
}

function formatSerolSco_(raw) {
  var n = parseFloat(String(raw || '').replace(',', '.'));
  if (!isFinite(n)) return String(raw || '').trim();
  var s = n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function qualSerolShort_(qual) {
  var q = String(qual || '').toUpperCase();
  if (q === 'NEGATIVO') return 'neg';
  if (q === 'POSITIVO') return 'pos*';
  if (q === 'INDETERMINADO') return 'indet*';
  return '';
}

function lineMatchesSerolPatterns_(line, patterns) {
  for (var p = 0; p < patterns.length; p++) {
    if (patterns[p].test(line)) return true;
  }
  return false;
}

function readSerolQualFromFollowLines_(lineas, i) {
  var sco = null;
  var qual = '';
  for (var j = i + 1; j < Math.min(i + 12, lineas.length); j++) {
    var t = String(lineas[j] || '').replace(/\*/g, '').trim();
    if (!t || t === ':') continue;
    if (/^ESTUDIO|RESULTADO|UNIDADES|VALOR DE REFERENCIA$/i.test(t)) continue;
    if (/^S\/CO$/i.test(t)) continue;
    if (/^(Positivo|Indeterminado|Negativo)\s*[<>=]/i.test(t)) continue;
    if (/^(Anticuerpos|Ant[ií]geno)\b/i.test(t)) break;
    var mNum = t.match(/^(\d+\.\d+|\d+)$/);
    if (mNum && sco === null) {
      sco = mNum[1];
      continue;
    }
    var mQ = t.match(/^(NEGATIVO|POSITIVO|INDETERMINADO)$/i);
    if (mQ) {
      qual = mQ[1].toUpperCase();
      break;
    }
  }
  return qual ? { sco: sco, qual: qual } : null;
}

function extraerSerolEstudio_(lineas, iStart, patterns) {
  for (var i = iStart; i < lineas.length; i++) {
    var line = String(lineas[i] || '').replace(/\t.*$/, '').trim();
    if (!line || !lineMatchesSerolPatterns_(line, patterns)) continue;
    return readSerolQualFromFollowLines_(lineas, i);
  }
  return null;
}

/**
 * Serología de banco de sangre (VIH/VHC/HBsAg) — bloque BANCO DE SANGRE / Serología SOME.
 */
function hasSerolReportMarkers_(textoBruto) {
  return (
    /HIV\s*1\s*\/\s*HIV\s*2/i.test(textoBruto) ||
    /ANTI\s+VIRUS\s+DE\s+LA\s+HEPATITIS\s+C/i.test(textoBruto) ||
    /ANTIGENO\s+DE\s+SUPERFICIE.*HEPATITIS\s+B/i.test(textoBruto)
  );
}

function findBancoSangreStart_(lineas) {
  for (var i = 0; i < lineas.length; i++) {
    if (/^BANCO\s+DE\s+SANGRE$/i.test(lineas[i])) return i;
  }
  return 0;
}

function buildSerolToken_(est, res) {
  var qShort = qualSerolShort_(res.qual);
  if (!qShort) return '';
  var token = est.key + ' ' + qShort;
  if (res.sco != null) token += ' (' + formatSerolSco_(res.sco) + ')';
  return token;
}

export function parseSerologiaBancoSangre_(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  var tUp = textoBruto.toUpperCase();
  if (tUp.indexOf('BANCO DE SANGRE') === -1 && !hasSerolReportMarkers_(textoBruto)) return '';

  var lineas = textoBruto.split(/\r?\n/).map(function (l) {
    return String(l || '').trim();
  });
  var startSearch = findBancoSangreStart_(lineas);
  var estudios = [
    { key: 'VIH', patterns: [/HIV\s*1\s*\/\s*HIV\s*2/i, /\bANTI\s+HIV/i] },
    { key: 'VHC', patterns: [/ANTI\s+VIRUS\s+DE\s+LA\s+HEPATITIS\s+C/i, /HEPATITIS\s+C/i] },
    { key: 'HBsAg', patterns: [/ANTIGENO\s+DE\s+SUPERFICIE.*HEPATITIS\s+B/i, /\bHBSAG\b/i] },
  ];

  var parts = [];
  for (var e = 0; e < estudios.length; e++) {
    var res = extraerSerolEstudio_(lineas, startSearch, estudios[e].patterns);
    if (!res || !res.qual) continue;
    var token = buildSerolToken_(estudios[e], res);
    if (token) parts.push(token);
  }
  if (!parts.length) return '';
  return 'SEROL\t' + parts.join(' ');
}

/** Na/K/Cl/Cr de QUIMICA CLINICA (orina); Cl suele venir en COMENTARIO DE MUESTRA. */

function readNumericFromLines_(lineas, i, maxLook) {
  for (var j = i + 1; j < Math.min(i + maxLook, lineas.length); j++) {
    var v = lineas[j];
    if (!v || /^[A-Z]$/.test(v)) continue;
    var m = v.match(/^(\d+\.?\d*)/);
    if (m) return m[1];
  }
  return '---';
}

function extractOrinaVolRes_(lineas) {
  var vol = '---';
  var res = '---';
  for (var i = 0; i < lineas.length; i++) {
    var lUp = lineas[i].toUpperCase();
    if (lUp.indexOf('VOLUMEN') !== -1) vol = readNumericFromLines_(lineas, i, 6);
    if (lUp === 'RESULTADO') res = readNumericFromLines_(lineas, i, 6);
  }
  return { vol: vol, res: res };
}

export function parseCuantOrina_(textoBruto) {
  var tUp = textoBruto.toUpperCase();
  var startIdx = tUp.indexOf('CUANTIFICACION PROTEINAS');
  if (startIdx === -1) return '';

  var bloque = textoBruto.substring(startIdx);
  var nextSec = bloque.search(/\n(?:HEMATOLOGIA|BACTERIOLOGIA|CULTIVO|EXAMEN GENERAL|GASOMETRIA|BIOMETRIA)\b/i);
  if (nextSec > 0) bloque = bloque.substring(0, nextSec);

  var lineas = bloque.split(/\r?\n/).map(function (l) {
    return l.replace(/\*/g, '').replace(/\t.*/, '').trim();
  });
  var extracted = extractOrinaVolRes_(lineas);
  if (extracted.res === '---') return '';

  var tipo = /orina\s+de\s+12/i.test(bloque) ? '12h' : '24h';
  var parts = ['Prot' + tipo];
  if (extracted.vol !== '---') parts.push('Vol ' + extracted.vol + 'ml');
  parts.push(extracted.res + '*');
  parts.push('gr/vol');
  return parts[0] + '\t' + parts.slice(1).join(' ');
}

