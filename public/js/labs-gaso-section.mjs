import { extraerConRango, extraerConRangoSuero, marcarSegunRango, fmt, toNum_ } from './labs-extract.mjs';
import { buildGasoInterpretacionFromValues_ } from './labs-gaso-interpret.mjs';
import {
  computeAnionGapValue_,
  computeAnionGap_,
  computeAlbuminCorrectedAnionGapValue_,
  computeAlbuminCorrectedAnionGap_,
  computeUrinaryAnionGap_,
  extractUrineElectrolytes_,
  resolveEffectiveAnionGapValue_,
} from './labs-anion-gap.mjs';
export { parsearLCR } from './labs-lcr-parse.mjs';
export {
  computeAnionGapValue_,
  computeAnionGap_,
  computeAlbuminCorrectedAnionGapValue_,
  computeAlbuminCorrectedAnionGap_,
  computeUrinaryAnionGapValue_,
  computeUrinaryAnionGap_,
  extractUrineElectrolytes_,
  resolveEffectiveAnionGapValue_,
} from './labs-anion-gap.mjs';

function gasoBlockForExtract_(bloqueGaso) {
  return String(bloqueGaso || '').replace(/\r/g, '').replace(/\s+/g, ' ');
}

function extractGasoPh_(bloqueX) {
  var phData = extraerConRango(['PH '], bloqueX);
  if (phData.valor === '---') phData = extraerConRango(['PH'], bloqueX);
  return phData;
}

function fmtGasoRanged_(data) {
  return fmt(marcarSegunRango(data.valor, data.min, data.max));
}

function extractGasoFormatted_(bloqueX, textoFuera) {
  var phData = extractGasoPh_(bloqueX);
  var hco3Data = extraerConRango(['HCO3'], bloqueX);
  var naAG = textoFuera ? extraerConRangoSuero(['SODIO'], textoFuera) : { valor: '---' };
  var clAG = textoFuera ? extraerConRangoSuero(['CLORO'], textoFuera) : { valor: '---' };
  var albAG = textoFuera ? extraerConRangoSuero(['ALBUMINA'], textoFuera) : { valor: '---' };
  var urine = textoFuera ? extractUrineElectrolytes_(textoFuera) : { na: '---', k: '---', cl: '---' };
  var iCaData = extraerConRango(['CA++ IONIZADO', 'CALCIO IONIZADO', 'CA IONIZADO'], bloqueX);
  var iCaMin = iCaData.min != null ? iCaData.min : 1.12;
  var iCaMax = iCaData.max != null ? iCaData.max : 1.32;
  var agEff = resolveEffectiveAnionGapValue_(naAG.valor, clAG.valor, hco3Data.valor, albAG.valor);
  return {
    phData: phData,
    pH: fmtGasoRanged_(phData),
    pCO2: fmtGasoRanged_(extraerConRango(['PCO2'], bloqueX)),
    pO2: fmtGasoRanged_(extraerConRango(['PO2 '], bloqueX)),
    Na: fmtGasoRanged_(extraerConRango(['SODIO'], bloqueX)),
    K: fmtGasoRanged_(extraerConRango(['POTASIO'], bloqueX)),
    GLU: fmtGasoRanged_(extraerConRango(['GLUCOSA'], bloqueX)),
    Lac: fmtGasoRanged_(extraerConRango(['LACTATO'], bloqueX)),
    Bica: fmtGasoRanged_(hco3Data),
    Hto: fmtGasoRanged_(extraerConRango(['HCT ', 'HEMATOCRITO'], bloqueX)),
    iCa: fmtGasoRanged_({ valor: iCaData.valor, min: iCaMin, max: iCaMax }),
    AG: computeAnionGap_(naAG.valor, clAG.valor, hco3Data.valor),
    AGc: computeAlbuminCorrectedAnionGap_(naAG.valor, clAG.valor, hco3Data.valor, albAG.valor),
    UAG: computeUrinaryAnionGap_(urine.na, urine.k, urine.cl),
    DD: computeDeltaDelta_(agEff, hco3Data.valor),
  };
}

function appendGasoPair_(p, key, val) {
  if (val !== '---') p.push(key, val);
}

function buildGasoLine_(g) {
  var p = ['GASES'];
  appendGasoPair_(p, 'pH', g.pH);
  appendGasoPair_(p, 'pCO2', g.pCO2);
  appendGasoPair_(p, 'pO2', g.pO2);
  appendGasoPair_(p, 'Na', g.Na);
  appendGasoPair_(p, 'K', g.K);
  appendGasoPair_(p, 'GLU', g.GLU);
  appendGasoPair_(p, 'Lactato', g.Lac);
  appendGasoPair_(p, 'Bica', g.Bica);
  appendGasoPair_(p, 'AG', g.AG);
  appendGasoPair_(p, 'AGc', g.AGc);
  appendGasoPair_(p, 'UAG', g.UAG);
  appendGasoPair_(p, 'Delta-Delta', g.DD);
  appendGasoPair_(p, 'Hto', g.Hto);
  appendGasoPair_(p, 'iCa', g.iCa);
  return p[0] + '\t' + p.slice(1).join(' ');
}

export function parseGaso_(bloqueGaso, textoFuera) {
  if (!bloqueGaso) return '';
  var bloqueX = gasoBlockForExtract_(bloqueGaso);
  var g = extractGasoFormatted_(bloqueX, textoFuera);
  if (g.phData.valor === '---') return '';
  return buildGasoLine_(g);
}

/** Product policy: auto gasometría interpretation line disabled (see labs-gases.test.mjs). */
const GASO_AUTO_INTERPRETATION_ENABLED = false;

export function buildGasoInterpretacion_(bloqueGaso, textoFuera) {
  if (!GASO_AUTO_INTERPRETATION_ENABLED) return '';
  if (!bloqueGaso) return '';
  var bloqueX = gasoBlockForExtract_(bloqueGaso);
  var phData   = extraerConRango(['PH '], bloqueX);
  if (phData.valor === '---') phData = extraerConRango(['PH'], bloqueX);
  if (phData.valor === '---') return '';
  var pco2Data = extraerConRango(['PCO2'], bloqueX);
  var hco3Data = extraerConRango(['HCO3'], bloqueX);
  var naAG = textoFuera ? extraerConRangoSuero(['SODIO'], textoFuera) : { valor: '---' };
  var clAG = textoFuera ? extraerConRangoSuero(['CLORO'], textoFuera) : { valor: '---' };
  var albAG = textoFuera ? extraerConRangoSuero(['ALBUMINA'], textoFuera) : { valor: '---' };
  var ag = resolveEffectiveAnionGapValue_(naAG.valor, clAG.valor, hco3Data.valor, albAG.valor);
  var dd = computeDeltaDeltaValue_(ag, hco3Data.valor);

  var pH = toNum_(phData.valor);
  var pCO2 = toNum_(pco2Data.valor);
  var hco3 = toNum_(hco3Data.valor);
  if (pH == null || (pCO2 == null && hco3 == null)) return '';

  return buildGasoInterpretacionFromValues_(pH, pCO2, hco3, ag, dd);
}

export function labSectionKey_(line) {
  var s = String(line == null ? '' : line).trim();
  if (!s) return '';
  var tab = s.indexOf('\t');
  if (tab >= 0) return s.substring(0, tab).trim().toUpperCase();
  var colon = s.indexOf(':');
  if (colon > 0) return s.substring(0, colon + 1).trim().toUpperCase();
  var m = s.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\b/);
  return m ? m[1].toUpperCase() : s.toUpperCase();
}

export function lineRichnessScore_(line) {
  var s = normalizeLabLine_(line);
  if (!s) return 0;
  var score = s.length;
  score += (s.match(/\b(?:AG|AGC|UAG|DELTA-DELTA|ICA|LACTATO|BICA|PCO2|PO2)\b/gi) || []).length * 8;
  score += (s.match(/\d/g) || []).length;
  return score;
}

function normalizeGasometryInterpretationLine_(line) {
  var s = String(line == null ? '' : line);
  return /^Interpretación gasometría:/i.test(s.trim()) ? s.toUpperCase() : s;
}

function normalizeLabLine_(line) {
  return normalizeGasometryInterpretationLine_(line).replace(/\s+/g, ' ').trim();
}

/** Texto de sección para filtrar / deduplicar (p. ej. fila BH como `{ visible, extras }`). */
function labRowText_(row) {
  if (row && typeof row === 'object' && typeof row.visible === 'string') return row.visible;
  return String(row == null ? '' : row);
}

export function dedupeSingletonSections_(rows) {
  var singleton = {
    BH: 1, QS: 1, ESC: 1, PFHS: 1, LIPASA: 1, TROP: 1, GASES: 1, PIE: 1, 'LCR:': 1, 'LIQ:': 1,
    HECES: 1, FROTIS: 1, EGO: 1, SEROL: 1, PROT12H: 1, PROT24H: 1, 'INTERPRETACIÓN GASOMETRÍA:': 1,
    'INTERPRETACIÓN ASCITIS:': 1,
    'INTERPRETACIÓN CITOQUÍMICO:': 1,
  };
  var list = (rows || []).filter(function (r) { return normalizeLabLine_(labRowText_(r)) !== ''; });
  var best = Object.create(null);
  var keep = [];
  for (var i = 0; i < list.length; i++) {
    var raw = list[i];
    var rowText = labRowText_(raw);
    var key = labSectionKey_(rowText);
    if (!singleton[key]) {
      keep.push(raw);
      continue;
    }
    var cand = { row: raw, idx: i, score: lineRichnessScore_(rowText) };
    var prev = best[key];
    if (!prev || cand.score > prev.score || (cand.score === prev.score && cand.idx > prev.idx)) {
      best[key] = cand;
    }
  }
  var chosen = Object.create(null);
  Object.keys(best).forEach(function (k) { chosen[best[k].idx] = best[k].row; });
  var out = [];
  for (var j = 0; j < list.length; j++) {
    var rowRaw = list[j];
    var rText = labRowText_(rowRaw);
    var k = labSectionKey_(rText);
    if (!singleton[k]) out.push(rowRaw);
    else if (chosen[j]) out.push(chosen[j]);
  }
  return out;
}

function valueFromSectionLine_(line, key) {
  var s = normalizeLabLine_(line);
  if (!s) return null;
  var m = s.match(
    new RegExp(
      '(?:^|\\s)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(-?\\d+(?:\\.\\d+)?)(\\*)?',
      'i'
    )
  );
  return m ? m[1] + (m[2] || '') : null;
}

function gasoRefRange_(gasRefs, fieldKey) {
  var r = gasRefs && gasRefs[fieldKey];
  if (r && r.length === 2 && isFinite(r[0]) && isFinite(r[1]) && r[1] > r[0]) {
    return [r[0], r[1]];
  }
  return null;
}

function markGasoToken_(valStr, gasRefs, fieldKey) {
  if (valStr == null || valStr === '') return valStr;
  var bare = String(valStr).replace(/\*$/, '');
  var starred = String(valStr).endsWith('*');
  var range = gasoRefRange_(gasRefs, fieldKey);
  if (range) return fmt(marcarSegunRango(bare, range[0], range[1]));
  return fmt(starred ? bare + '*' : bare);
}

function pickBestSectionLine_(rows, sectionName) {
  var sec = String(sectionName || '').toUpperCase();
  var best = null;
  (rows || []).forEach(function (row, idx) {
    if (labSectionKey_(row) !== sec) return;
    var cand = { row: String(row), idx: idx, score: lineRichnessScore_(row) };
    if (!best || cand.score > best.score || (cand.score === best.score && cand.idx > best.idx)) best = cand;
  });
  return best ? best.row : '';
}

function formatNumericToken_(n) {
  if (n == null || !isFinite(n)) return '';
  var rounded = Math.round((n + Number.EPSILON) * 10) / 10;
  return rounded === Math.trunc(rounded) ? String(rounded.toFixed(0)) : String(rounded);
}

function appendMarkedAgToken_(out, key, value) {
  if (value == null) return;
  out.push(key, marcarSegunRango(formatNumericToken_(value), 8, 12));
}

function appendAnionGapDerivedTokens_(out, base, na, cl, bica, alb) {
  var agRaw = computeAnionGapValue_(na || '---', cl || '---', bica || '---');
  appendMarkedAgToken_(out, 'AG', agRaw);
  var agc = computeAlbuminCorrectedAnionGapValue_(
    na || '---',
    cl || '---',
    bica || '---',
    alb || '---'
  );
  appendMarkedAgToken_(out, 'AGc', agc);
  var uagExisting = valueFromSectionLine_(base, 'UAG');
  if (uagExisting != null && uagExisting !== '') {
    out.push('UAG', String(uagExisting).replace(/\*$/, ''));
  }
  var ddv = computeDeltaDeltaValue_(agc != null ? agc : agRaw, bica || '---');
  if (ddv != null) out.push('Delta-Delta', formatNumericToken_(ddv));
}

function rebuildGasesFromResults_(rows, gasRefs) {
  var gases = pickBestSectionLine_(rows, 'GASES');
  if (!gases) return { gasesLine: '', interpLine: '' };
  var base = normalizeLabLine_(gases);
  var out = ['GASES'];
  var orderedKeys = ['pH', 'pCO2', 'pO2', 'Na', 'K', 'GLU', 'Lactato', 'Bica', 'Hto', 'iCa'];
  var values = {};
  orderedKeys.forEach(function (k) {
    values[k] = valueFromSectionLine_(base, k);
  });

  var qs = pickBestSectionLine_(rows, 'QS');
  var esc = pickBestSectionLine_(rows, 'ESC');
  var pfhs = pickBestSectionLine_(rows, 'PFHS');
  var na = valueFromSectionLine_(qs, 'Na') || valueFromSectionLine_(esc, 'Na') || values.Na;
  var cl = valueFromSectionLine_(qs, 'Cl') || valueFromSectionLine_(esc, 'Cl');
  var alb = valueFromSectionLine_(pfhs, 'Alb');

  orderedKeys.forEach(function (k) {
    if (values[k] != null && values[k] !== '') {
      out.push(k, markGasoToken_(values[k], gasRefs, k));
    }
  });

  appendAnionGapDerivedTokens_(out, base, na, cl, values.Bica, alb);
  return { gasesLine: out[0] + '\t' + out.slice(1).join(' '), interpLine: '' };
}

export function reprocessLabResultLines_(rows, opts) {
  var gasRefs = opts && opts.gasRefs;
  var clean = dedupeSingletonSections_(rows || []);
  var rebuilt = rebuildGasesFromResults_(clean, gasRefs);
  var out = clean.filter(function (r) {
    var k = labSectionKey_(r);
    return k !== 'GASES' && k !== 'INTERPRETACIÓN GASOMETRÍA:';
  });
  if (rebuilt.gasesLine) out.push(rebuilt.gasesLine);
  if (rebuilt.interpLine) out.push(rebuilt.interpLine);
  return dedupeSingletonSections_(out);
}

function computeDeltaDeltaValue_(agValue, hco3Str) {
  if (agValue == null) return null;
  var hco3 = parseFloat(String(hco3Str).replace(',', '.'));
  if (isNaN(hco3)) return null;
  var deltaHco3 = 24 - hco3;
  if (deltaHco3 <= 0) return null;
  return (agValue - 12) / deltaHco3;
}

function computeDeltaDelta_(agValue, hco3Str) {
  var dd = computeDeltaDeltaValue_(agValue, hco3Str);
  if (dd == null) return '---';
  var rounded = Math.round(dd * 10) / 10;
  return (rounded === Math.trunc(rounded)) ? String(rounded.toFixed(0)) : String(rounded);
}

export function parsePIE_(tNorm) {
  var hasPIEInmuno = /PRUEBA INMUNOLOGICA DE EMBARAZO/i.test(tNorm);
  var hasPrueba    = /PRUEBA DE EMBARAZO/i.test(tNorm);
  if (!hasPIEInmuno && !hasPrueba) return '';

  if (hasPIEInmuno) {
    var idx = tNorm.toUpperCase().indexOf('PRUEBA INMUNOLOGICA DE EMBARAZO');
    var sub = tNorm.substring(idx, idx + 400);
    var subUp = sub.toUpperCase();
    // Preferir resultado del bloque SUERO (más confiable clínicamente)
    var sueroIdx = subUp.indexOf('SUERO');
    var m = null;
    if (sueroIdx !== -1) {
      m = sub.substring(sueroIdx, sueroIdx + 100).match(/\b(NEGATIVO|POSITIVO)\b/i);
    }
    // Fallback: buscar en bloque ORINA
    if (!m) {
      var orinaIdx = subUp.indexOf('ORINA');
      if (orinaIdx !== -1) m = sub.substring(orinaIdx, orinaIdx + 100).match(/\b(NEGATIVO|POSITIVO)\b/i);
    }
    if (!m) return '';
    return 'PIE\t' + m[1].toUpperCase() + '*';
  }

  // Formato original: "PRUEBA DE EMBARAZO"
  var idxPie = tNorm.toUpperCase().indexOf('PRUEBA DE EMBARAZO');
  var subPie = tNorm.substring(idxPie, idxPie + 300);
  var mPie = subPie.match(/\b(NEGATIVO|POSITIVO)\b/i);
  if (!mPie) return '';
  return 'PIE\t' + mPie[1].toUpperCase() + '*';
}

