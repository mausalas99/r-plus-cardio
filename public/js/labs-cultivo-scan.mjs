// Cultivo line scanners — extracted from labs-cultivo.mjs.

function findBacteriologiaSectionIdx_(lineasTexto) {
  var idxBact = -1;
  var idxMyco = -1;
  for (var i = 0; i < lineasTexto.length; i++) {
    var sec = lineasTexto[i].replace(/\r/g, '').replace(/\s+/g, ' ').trim();
    if (/^BACTERIOLOGIA$/i.test(sec)) {
      idxBact = i;
      break;
    }
    if (/^MYCOBACTERIAS$/i.test(sec)) idxMyco = i;
  }
  return idxBact !== -1 ? idxBact : idxMyco;
}

function isTipoCultivoSkipLine_(lUp) {
  return (
    /^BACTERIOLOGIA$/.test(lUp) ||
    /^ESTUDIO\b/.test(lUp) ||
    /^RESULTADO$/.test(lUp) ||
    /^UNIDADES$/.test(lUp) ||
    /^VALOR DE REFERENCIA$/.test(lUp)
  );
}

function isExplicitTipoCultivoLine_(l, lUp) {
  return (
    /\bUROCULTIVO\b/i.test(l) ||
    /\bHEMOCULTIVO\b/i.test(l) ||
    /^CATETER(\b|$)/i.test(lUp) ||
    /^BACILOSCOPIA\b/i.test(lUp) ||
    /^CULTIVO\s+DE\s+MICOBACTERIAS\b/i.test(lUp)
  );
}

function isTipoCultivoCandidate_(lUp) {
  return !/^(TINCION|CALIDAD|ESTADO|MICROORGANISMO|COMENTARIO|CUENTA|ANTIBIOGRAMA|REPORTE\s+PRELIMINAR|1\s+MUESTRA|OBSERVACIONES|SECCION)\b/i.test(
    lUp
  );
}

export function detectTipoCultivoLine(lineasTexto) {
  var idxSec = findBacteriologiaSectionIdx_(lineasTexto);
  if (idxSec === -1) return '';
  var candidate = '';
  for (var ii = idxSec + 1; ii < Math.min(idxSec + 35, lineasTexto.length); ii++) {
    var l = lineasTexto[ii].replace(/\r/g, '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!l) continue;
    var lUp = l.toUpperCase();
    if (isTipoCultivoSkipLine_(lUp)) continue;
    if (/^PRODUCTO$/.test(lUp)) break;
    if (isExplicitTipoCultivoLine_(l, lUp)) return l;
    if (!candidate && isTipoCultivoCandidate_(lUp)) candidate = l;
  }
  return candidate;
}

function cleanMycoLine_(line) {
  return String(line || '').replace(/\r/g, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

function extractMuestraMycobacterias_(slice) {
  for (var o = 0; o < slice.length; o++) {
    if (!/^OBSERVACIONES\b/i.test(cleanMycoLine_(slice[o]))) continue;
    for (var o2 = o + 1; o2 < Math.min(o + 8, slice.length); o2++) {
      var obs = cleanMycoLine_(slice[o2]);
      if (!obs || /^OBSERVACIONES$/i.test(obs)) continue;
      if (/^(ESTUDIO|RESULTADO|UNIDADES|\*+)$/i.test(obs)) continue;
      return obs.toUpperCase();
    }
    break;
  }
  return '';
}

function isMycoResultSkipLine_(tUp) {
  return (
    /^(ESTUDIO|RESULTADO|UNIDADES|VALOR DE REFERENCIA|1\s+MUESTRA)$/i.test(tUp) ||
    /^SECCION\s+DE\s+MICOBACTERIAS/i.test(tUp) ||
    /^REPORTE\s+PRELIMINAR/i.test(tUp)
  );
}

function readMycoCultivoValue_(slice, k) {
  for (var k2 = k + 1; k2 < Math.min(k + 6, slice.length); k2++) {
    var v = cleanMycoLine_(slice[k2]);
    if (v && v.length > 2) return v.toUpperCase();
  }
  return '';
}

function findMycoStudyResult_(slice, fromIdx) {
  for (var k = fromIdx + 1; k < Math.min(fromIdx + 22, slice.length); k++) {
    var t = cleanMycoLine_(slice[k]);
    if (!t) continue;
    var tUp = t.toUpperCase();
    if (/^(BACILOSCOPIA|CULTIVO\s+DE\s+MICOBACTERIAS)/i.test(tUp)) break;
    if (/^OBSERVACIONES/i.test(tUp)) break;
    if (isMycoResultSkipLine_(tUp)) continue;
    if (/^CULTIVO$/i.test(tUp)) {
      var cultVal = readMycoCultivoValue_(slice, k);
      if (cultVal) return cultVal;
      continue;
    }
    if (/NEGATIVO|POSITIVO|PENDIENTE|EN CURSO|CRECIMIENTO|NO SE AISL/i.test(tUp) && t.length < 120) {
      return tUp;
    }
  }
  return 'NEGATIVO';
}

/** Reportes SOME solo MYCOBACTERIAS (baciloscopia + cultivo micobacteriano). */
export function parseMycobacteriasStudies_(lineasTexto, fechaC) {
  var idxM = -1;
  for (var i = 0; i < lineasTexto.length; i++) {
    if (/^MYCOBACTERIAS$/i.test(cleanMycoLine_(lineasTexto[i]))) { idxM = i; break; }
  }
  if (idxM === -1) return '';
  var end = lineasTexto.length;
  for (var j = idxM + 1; j < lineasTexto.length; j++) {
    var sec = cleanMycoLine_(lineasTexto[j]);
    if (/^(HEMATOLOGIA|BACTERIOLOGIA|QUIMICA|BIOMETRIA|GASOMETRIA)\b/i.test(sec)) { end = j; break; }
  }
  var slice = lineasTexto.slice(idxM, end);
  var muestra = extractMuestraMycobacterias_(slice);
  var studyRe = /^(BACILOSCOPIA|CULTIVO\s+DE\s+MICOBACTERIAS|CULTIVO\s+DE\s+MYCOBACTERIAS)\b/i;
  var chunks = [];
  for (var si = 0; si < slice.length; si++) {
    var tipo = cleanMycoLine_(slice[si]);
    if (!studyRe.test(tipo)) continue;
    tipo = tipo.toUpperCase();
    var resultado = findMycoStudyResult_(slice, si);
    var header = tipo;
    if (muestra && header.indexOf(muestra) === -1) header += ' (' + muestra + ')';
    chunks.push(header + ' ' + fechaC + ': ' + resultado);
  }
  return chunks.length ? chunks.join('\n\n') : '';
}

export function detectMuestraDesdeProducto(lineasTexto) {
  var idxProd = -1;
  for (var i = 0; i < lineasTexto.length; i++) {
    var prodLine = lineasTexto[i].replace(/\r/g, '').replace(/\*+/g, '').trim();
    if (/^PRODUCTO\b/i.test(prodLine)) { idxProd = i; break; }
  }
  if (idxProd === -1) return '';
  for (var j = idxProd + 1; j < Math.min(idxProd + 14, lineasTexto.length); j++) {
    var s = lineasTexto[j].replace(/\r/g, '').replace(/\*/g, '').trim();
    if (!s) continue;
    if (/^TINCION(\s+DE)?\s*GRAM/i.test(s)) break;
    if (/^CALIDAD DE LA MUESTRA$/i.test(s)) break;
    if (/^ESTADO DE CULTIVO$/i.test(s)) break;
    if (/^REPORTE PRELIMINAR$/i.test(s)) break;
    if (/^MICROORGANISMO$/i.test(s)) break;
    if (/^COMENTARIO/i.test(s)) break;
    return s;
  }
  return '';
}

export function buildCultivoTipoDisplay(tipoLine, muestra) {
  var t = tipoLine ? tipoLine.replace(/\s+/g, ' ').trim().toUpperCase() : '';
  var m = muestra ? muestra.replace(/\s+/g, ' ').trim().toUpperCase() : '';
  if (t && m) return t + ' (' + m + ')';
  if (t) return t;
  if (m) return 'CULTIVO (' + m + ')';
  return 'CULTIVO';
}

function parseInterpAntibiograma(vL) {
  var vClean = vL.replace(/\*+$/g, '').trim();
  if (!vClean) return null;
  var tabs = vClean.split(/\t+/).map(function(x) { return x.trim(); }).filter(Boolean);
  if (tabs.length >= 2) {
    var interp = tabs[tabs.length - 1].toUpperCase().replace(/\*+$/, '');
    var mic = tabs.slice(0, -1).join(' ').trim();
    if (/^(S|R|I|NEG|POS|ESBL|BLEE|BLAC|KPC|NDM|VIM|IMP|MBL)$/.test(interp)) return { mic: mic, interp: interp };
    if (/^NO\s+SUSCEPTIBLE$/i.test(interp)) return { mic: mic, interp: 'NO SUSCEPTIBLE' };
  }
  var mV = vClean.match(/^([<>]=?\s*\d+(?:\.\d+)?(?:\/\d+)?)\s+(S|R|I|NEG|POS|ESBL|BLEE|BLAC|KPC|NDM|VIM|IMP|MBL)$/i);
  if (mV) return { mic: mV[1].replace(/\s/g, ''), interp: mV[2].toUpperCase() };
  var mN = vClean.match(/^(\d+)\s+(S|R|I|ESBL|BLEE|BLAC|KPC|NDM|VIM|IMP|MBL)$/i);
  if (mN) return { mic: mN[1], interp: mN[2].toUpperCase() };
  var lim = vClean.toUpperCase();
  if (/^(S|R|I)$/.test(lim)) return { mic: '', interp: lim };
  if (/NO\s+SUSCEPTIBLE/i.test(vClean)) return { mic: '', interp: 'NO SUSCEPTIBLE' };
  return null;
}

/** Orden de visualización: carbapenemasas y mecanismos graves primero. */
var ORDEN_MARCA_RESISTENCIA = {
  KPC: 1, NDM: 2, VIM: 3, IMP: 4, 'OXA-48': 5, 'OXA-otras': 6, MBL: 7, SPM: 8, GIM: 9,
  ESBL: 20, BLEE: 21, CRE: 30, 'Carb-R': 31, AmpC: 40, MRSA: 50, VRE: 51, 'Col-R': 52,
};

/**
 * Detecta mecanismos y fenotipos de resistencia en texto de bacteriología (comentarios, notas, MALDI).
 * Incluye carbapenemasas (KPC, NDM, OXA-48, VIM, IMP, MBL…), ESBL/BLEE, CRE, AmpC, MRSA/VRE, colistin R.
 */
function normalizeResistenciaText_(texto) {
  return texto
    .toUpperCase()
    .replace(/Á/g, 'A')
    .replace(/É/g, 'E')
    .replace(/Í/g, 'I')
    .replace(/Ó/g, 'O')
    .replace(/Ú/g, 'U');
}

function applyCarbapenemasaTags_(u, add) {
  if (/\bKPC\b|KPC-/.test(u)) add('KPC');
  if (/\bNDM\b|NDM-/.test(u)) add('NDM');
  if (/\bVIM\b|VIM-/.test(u)) add('VIM');
  if (/\bIMP-\d|\bIMP\s*1\b|\bIMP1\b/.test(u) || /BETALACTAMASA\s+IMP/.test(u)) add('IMP');
  if (/\bOXA[- ]?48\b|OXA48\b/.test(u)) add('OXA-48');
  if (/\bOXA[- ]?(23|24|51|58)(?![0-9])\b/i.test(u)) add('OXA-otras');
  if (/\bMBL\b|METALO\s*BETA|METALOCARBAPENEMAS|METALO-?\s*BETALACTAMASA|BETALACTAMASA\s+DE\s+ZINC/.test(u)) {
    add('MBL');
  }
  if (/\bSPM\b|SPM-/.test(u)) add('SPM');
  if (/\bGIM\b|GIM-/.test(u)) add('GIM');
}

function applyCreCarbTags_(u, add, seen) {
  if (/\bCPE\b|\bCRE\b|ENTEROBACTER(I)?A\s+RESISTENTE\s+A\s+CARBAPEN|BACILO\s+CARBAPEN/.test(u)) {
    add('CRE');
  }
  if (
    /RESISTEN(CIA|TE)\s+.*CARBAPEN|CARBAPEN.*RESIST|NO\s+SUSCEPTIB.*CARBAPEN|ANTICARBAPEN|ANTI-?CARBAPEN|PRODUCTOR\s+DE\s+CARBAPENEMASA|PRODUCTOR(ES)?\s+CARBAPEN|DETECTO\s+CARBAPENEMASA|DETECT[OÓ]\s+CARBAPENEMASA|CARBAPENEMASA\s+DETECTAD/i.test(
      u
    )
  ) {
    if (!seen.KPC && !seen.NDM && !seen.VIM && !seen.IMP && !seen['OXA-48'] && !seen.MBL) add('Carb-R');
  }
}

function applyBetaLactamTags_(u, add) {
  if (/\bESBL\b|BETALACTAMASAS?\s+DE\s+ESPECTRO|ESPECTRO\s+EXTENDIDO|BLEE\s*\+\s*ESBL/.test(u)) add('ESBL');
  if (/\(BLEE\)|\bBLEE\b|BETALACTAMASAS?\s*\(?BLEE\)?|PRODUCTOR\s+DE\s+BETALACTAMASAS(?!\s+DE\s+ESPECTRO)/.test(u)) {
    add('BLEE');
  }
  if (/\bAMPC\b|AMP\s*C\b|BETALACTAMASA\s+AMPC|CEPHAMYCIN/.test(u)) add('AmpC');
}

function applyStaphEnteroColTags_(u, add) {
  if (/\bMECA\b|\bMRSA\b|METICILIN(A)?\s*-?\s*RESIST|OXACILIN(A)?\s*:\s*R(?!\s*\d)/.test(u)) add('MRSA');
  if (/\bVRE\b|VANCOMICIN(A)?\s*-?\s*RESIST|ENTEROCOC.*VANCO\s*R|VANCO\s*[-–]\s*R/.test(u)) add('VRE');
  if (/COLISTIN(A)?\s*[-–:]?\s*R|POLIMIXIN(A)?\s*[-–:]?\s*R|RESIST.*COLISTIN/.test(u)) add('Col-R');
}

function extractMarcasResistenciaDesdeTexto(texto) {
  var u = normalizeResistenciaText_(texto);
  var seen = {};
  var tags = [];
  function add(tag) {
    if (!tag || seen[tag]) return;
    seen[tag] = 1;
    tags.push(tag);
  }
  applyCarbapenemasaTags_(u, add);
  applyCreCarbTags_(u, add, seen);
  applyBetaLactamTags_(u, add);
  applyStaphEnteroColTags_(u, add);
  tags.sort(function (a, b) {
    return (ORDEN_MARCA_RESISTENCIA[a] || 99) - (ORDEN_MARCA_RESISTENCIA[b] || 99);
  });
  return tags;
}

function finalizeMarcasResistencia_(marcas) {
  marcas.sort(function(a, b) {
    return (ORDEN_MARCA_RESISTENCIA[a] || 99) - (ORDEN_MARCA_RESISTENCIA[b] || 99);
  });
  if (marcas.indexOf('BLEE') !== -1) marcas = marcas.filter(function(m) { return m !== 'ESBL'; });
  if (marcas.some(function(m) { return /^(KPC|NDM|VIM|IMP|OXA-48|OXA-otras|MBL|SPM|GIM)$/.test(m); })) {
    marcas = marcas.filter(function(m) { return m !== 'Carb-R'; });
  }
  if (marcas.indexOf('CRE') !== -1) marcas = marcas.filter(function(m) { return m !== 'Carb-R'; });
  return marcas;
}

/** Marcas de resistencia en un solo aislamiento (comentario + antibiograma del slice). */
export function detectMarcasResistenciaCultivoSlice(sliceLines) {
  var blob = sliceLines.join('\n');
  var marcas = extractMarcasResistenciaDesdeTexto(blob);
  var seen = {};
  marcas.forEach(function(m) { seen[m] = 1; });
  var inAb = false;
  for (var i = 0; i < sliceLines.length; i++) {
    var L = sliceLines[i].replace(/\*+$/g, '').trim();
    if (/^ANTIBIOGRAMA/i.test(L)) { inAb = true; continue; }
    if (inAb && /^MICROORGANISMO|^IDENTIFICACION/i.test(L)) { inAb = false; continue; }
    if (!inAb) continue;
    var p = parseInterpAntibiograma(L);
    if (!p || !p.interp) continue;
    var it = p.interp.toUpperCase();
    if (it === 'ESBL' && !seen.ESBL) { marcas.push('ESBL'); seen.ESBL = 1; }
    if (it === 'BLEE' && !seen.BLEE) { marcas.push('BLEE'); seen.BLEE = 1; }
    if (/^(KPC|NDM|VIM|IMP|MBL)$/.test(it) && !seen[it]) { marcas.push(it); seen[it] = 1; }
  }
  return finalizeMarcasResistencia_(marcas);
}

/**
 * Resumen ATB sin CMI: conserva R | I | ESBL/BLEE y también S para mostrar
 * el biograma completo sin los valores MIC.
 */
export function compactarLineasAntibiograma(sensCrudas, abreviarFn) {
  if (!sensCrudas.length) return '';
  var rank = { R: 4, 'NO SUSCEPTIBLE': 4, ESBL: 4, BLEE: 4, BLAC: 4, KPC: 4, NDM: 4, VIM: 4, IMP: 4, MBL: 4, I: 2, S: 1, POS: 1 };
  var byKey = {};
  sensCrudas.forEach(function(s) {
    var key = abreviarFn(s.med);
    if (!key) return;
    var it = String(s.interp || '').toUpperCase();
    var r = rank[it] || 0;
    if (!byKey[key] || r > byKey[key]._r) byKey[key] = { interp: it, _r: r };
  });
  var R = [], I = [], E = [], S = [];
  Object.keys(byKey).sort().forEach(function(k) {
    var it = byKey[k].interp;
    if (it === 'S' || it === 'POS') S.push(k);
    else if (it === 'I') I.push(k);
    else if (it === 'ESBL') E.push(k);
    else R.push(k);
  });
  function cap(arr, n) {
    if (!arr.length) return '';
    if (arr.length <= n) return arr.join(', ');
    return arr.slice(0, n).join(', ') + ' +' + (arr.length - n);
  }
  var parts = [];
  if (R.length) parts.push('R: ' + cap(R, 14));
  if (I.length) parts.push('I: ' + cap(I, 8));
  if (E.length) parts.push('ESBL: ' + cap(E, 8));
  if (S.length) parts.push('S: ' + cap(S, 18));
  if (!parts.length) return 'ATB sin interpretaciones';
  var line = 'ATB ' + parts.join(' | ');
  if (line.length <= 220) return line;
  return 'ATB ' + parts.join('\n');
}

/**
 * Texto para portapapeles: cabecera del cultivo (fecha dd/mm en la línea), ATB y cuenta.
 * No antepone la fecha/hora del envío; sin marca «Preliminar».
 */

function readGermenName_(lineasTexto, i) {
  for (var k = i + 1; k < Math.min(i + 14, lineasTexto.length); k++) {
    var cand = lineasTexto[k].replace(/\r/g, '').replace(/\*/g, '').trim();
    if (!cand) continue;
    if (/^COMENTARIO/i.test(cand)) break;
    if (/^MICROORGANISMO/i.test(cand)) break;
    if (/^ANTIBIOGRAMA/i.test(cand)) break;
    if (/^CUENTA/i.test(cand)) break;
    if (!/MALDI|IDENTIF|ESPECTROMETRIA|ESPECTRO/i.test(cand)) {
      return { germen: cand.toUpperCase(), nameEnd: k };
    }
  }
  return null;
}

function findGermenRunEnd_(lineasTexto, i, nameEnd) {
  for (var m = i + 1; m < lineasTexto.length; m++) {
    var Lm = lineasTexto[m].replace(/\r/g, '').replace(/\*+$/g, '').trim();
    if (/^MICROORGANISMO(\s|$)/i.test(Lm) && m > nameEnd) return m;
    if (/^IDENTIFICACION\s+POR\s+ESPECTROMETRIA/i.test(Lm)) return m;
  }
  return lineasTexto.length;
}

export function findCultivoGermenRuns(lineasTexto) {
  var runs = [];
  for (var i = 0; i < lineasTexto.length; i++) {
    var L = lineasTexto[i].replace(/\r/g, '').replace(/\*+$/g, '').trim();
    if (!/^MICROORGANISMO(\s|$)/i.test(L)) continue;
    var named = readGermenName_(lineasTexto, i);
    if (!named) continue;
    runs.push({ germen: named.germen, i0: i, i1: findGermenRunEnd_(lineasTexto, i, named.nameEnd) });
    i = findGermenRunEnd_(lineasTexto, i, named.nameEnd) - 1;
  }
  return runs;
}

export function extractCuentaKassFromLineas(sliceLines) {
  var tNorm = sliceLines.join(' ').replace(/\s+/g, ' ');
  var tUpper = tNorm.toUpperCase();
  var pCuenta = tUpper.indexOf('CUENTA DE KASS');
  if (pCuenta === -1) pCuenta = tUpper.indexOf('CUENTA');
  if (pCuenta === -1) return '';
  var fragC = tNorm.substring(pCuenta, pCuenta + 110);
  var fragBeforeAb = fragC.split(/\bANTIBIOGRAMA\b/i)[0];
  var mUfc = fragBeforeAb.match(/\+?\d[\d,]*(?:\.\d+)?\s*UFC(?:\s*\/\s*M?L)?/i);
  if (mUfc) {
    return mUfc[0]
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/')
      .trim()
      .toUpperCase();
  }
  var mC = fragBeforeAb.match(/([<>]=?\s?\d+(\.\d+)?\s*[A-Z%/]*)/i);
  if (mC) return mC[1].trim().toUpperCase();
  var mColonias = fragBeforeAb.match(/(\d[\d,]*\s+COLONIAS?)/i);
  if (mColonias) return mColonias[1].replace(/\s+/g, ' ').trim().toUpperCase();
  for (var li = 0; li < sliceLines.length; li++) {
    var Lc = sliceLines[li].replace(/\r/g, '').replace(/\*+$/g, '').trim();
    if (!/^CUENTA/i.test(Lc)) continue;
    for (var lk = li + 1; lk < Math.min(li + 6, sliceLines.length); lk++) {
      var cand = sliceLines[lk].replace(/\r/g, '').replace(/\*/g, '').trim();
      if (!cand || cand === '*') continue;
      if (/^MICROORGANISMO|^ANTIBIOGRAMA|^COMENTARIO/i.test(cand)) break;
      return cand.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim().toUpperCase();
    }
  }
  return '';
}

export function parseSensCrudasAntibiogramaSlice(lineasAb) {
  var sensCrudas = [];
  for (var i = 0; i < lineasAb.length - 1; i++) {
    var nL = lineasAb[i], vL = lineasAb[i + 1];
    if (!nL || nL.length <= 3 || /ANTIBIOGRAMA|MICROORGANISMO|COMENTARIO:?|CUENTA|PRODUCTO|ESTADO|MUESTRA|GRAM|IDENTIFICACION|ESTUDIO\s+RESULTADO/i.test(nL)) continue;
    var parsed = parseInterpAntibiograma(vL);
    if (!parsed) {
      var lim = vL.toUpperCase();
      if (/^(S|R|I)$/.test(lim)) parsed = { mic: '', interp: lim };
    }
    if (parsed && parsed.interp) sensCrudas.push({ med: nL.toUpperCase(), mic: parsed.mic, interp: parsed.interp });
  }
  return sensCrudas;
}

/** Línea «Cuenta: …» en un bloque condensado de cultivo (tras la cabecera sitio/fecha:germen). */
export function parseCuentaFromCultivoChunkLines(lines) {
  if (!lines || !lines.length) return '';
  for (var i = 0; i < lines.length; i++) {
    var m = String(lines[i] == null ? '' : lines[i])
      .replace(/\*+$/g, '')
      .trim()
      .match(/^Cuenta:\s*(.+)$/i);
    if (m) {
      return m[1]
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .trim();
    }
  }
  return '';
}
