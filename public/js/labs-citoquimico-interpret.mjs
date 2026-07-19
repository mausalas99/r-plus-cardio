// Citoquímico / LCR — interpretación clínica (infección, GASA, Light, etiología LCR).
import { dedupeSingletonSections_, labSectionKey_ } from './labs-gaso-section.mjs';
import {
  bloqueCitoquimicoLiquidosFull,
  computeGasaValue_,
  parsearCitoquimicoLiquidos,
  parseCitoquimicoLiquidosParsed,
  resolveSerumAlbuminForGasa_,
  resolveSerumGlucoseForInterpret_,
  resLabsHasAsciticFluid_,
  resLabsHasPleuralFluid_,
} from './labs-fluidos.mjs';
import { parseLcrParsed } from './labs-lcr-parse.mjs';
import {
  evaluarPbeAscitis_,
  evaluarPleuralInfeccion_,
  evaluarLcrEtiologia_,
  evaluarLcrPhSanity_,
} from './labs-citoquimico-interpret-rules.mjs';
import { parseFluidLeu_, parsePmnField_ } from './labs-fluid-interpret-values.mjs';

export const CITOQUIM_INTERPRETACION_HEADER = 'INTERPRETACIÓN CITOQUÍMICO:';
export const ASCITIS_INTERPRETACION_HEADER = 'INTERPRETACIÓN ASCITIS:';

const CITOQUIM_INTERP_HEADERS = [
  CITOQUIM_INTERPRETACION_HEADER,
  ASCITIS_INTERPRETACION_HEADER,
  'INTERPRETACIÓN PLEURAL:',
];

function escapeRegExp_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesInterpHeader_(head, header) {
  return new RegExp('^' + escapeRegExp_(header), 'i').test(head);
}

/** @param {string} text */
export function isCitoquimInterpretacionResLabChunk(text) {
  var head = String(text || '').split('\n')[0].trim();
  for (var i = 0; i < CITOQUIM_INTERP_HEADERS.length; i++) {
    if (matchesInterpHeader_(head, CITOQUIM_INTERP_HEADERS[i])) return true;
  }
  return false;
}

/** @deprecated use isCitoquimInterpretacionResLabChunk */
export function isAscitisInterpretacionResLabChunk(text) {
  return isCitoquimInterpretacionResLabChunk(text);
}

export function citoquimInterpretacionBody_(text) {
  var s = String(text || '');
  for (var i = 0; i < CITOQUIM_INTERP_HEADERS.length; i++) {
    var re = new RegExp('^' + escapeRegExp_(CITOQUIM_INTERP_HEADERS[i]) + '\\t?', 'i');
    if (re.test(s.split('\n')[0].trim())) {
      return s.replace(re, '').trim();
    }
  }
  return s.trim();
}

/** @deprecated use citoquimInterpretacionBody_ */
export function ascitisInterpretacionBody_(text) {
  return citoquimInterpretacionBody_(text);
}

export function formatCitoquimicoInterpretacionLine_(alerts) {
  var list = (alerts || []).filter(Boolean);
  if (!list.length) return '';
  return CITOQUIM_INTERPRETACION_HEADER + '\t' + list.join(' · ');
}

/** @deprecated use formatCitoquimicoInterpretacionLine_ */
export function formatAscitisInterpretacionLine_(alerts) {
  return formatCitoquimicoInterpretacionLine_(alerts);
}

/**
 * Causa probable de ascitis con GASA <1.1 g/dL (algoritmo secuencial: TGL→Prot→Amilasa→Citología).
 */
export function evaluarAscitisNoPortal_(gasa, protGdl, tglMgdl, amilUl, citologia) {
  if (gasa == null || gasa >= 1.1) return '';

  if (tglMgdl == null) {
    if (amilUl == null) return 'Solicitar triglicéridos y amilasa en líquido ascítico';
    return 'Solicitar triglicéridos en líquido ascítico';
  }
  if (tglMgdl > 200) return 'Ascitis quilosa (TGL>200)';

  if (protGdl == null) return 'Evaluar proteínas totales en líquido ascítico';
  if (protGdl < 2.5) return 'Síndrome nefrótico? (Prot<2.5; proteinuria 24h)';

  if (amilUl == null) {
    if (citologia === 'positive') return 'Carcinomatosis peritoneal? (citología +)';
    if (citologia === 'negative') return 'Peritonitis tuberculosa? (citología −; BAAR, ADA, biopsia)';
    return 'Solicitar amilasa y citología en líquido ascítico';
  }
  if (amilUl > 1000) return 'Ascitis pancreática/perforación? (Amil>1000)';

  if (citologia == null) return 'Solicitar citología de líquido ascítico';
  if (citologia === 'positive') return 'Carcinomatosis peritoneal? (citología +)';
  return 'Peritonitis tuberculosa? (citología −; BAAR, ADA, biopsia)';
}

function appendGasaAlerts_(alerts, parsed) {
  if (!parsed.alb) return;
  if (parsed.serumAlb == null) {
    alerts.push('Incluir albúmina sérica del mismo día para calcular GASA');
    return;
  }
  if (parsed.gasaVal == null) return;
  if (parsed.gasaVal >= 1.1) {
    alerts.push('GASA ' + parsed.gasaVal + ' ≥1.1 — probable hipertensión portal');
    return;
  }
  alerts.push('GASA ' + parsed.gasaVal + ' <1.1 — ascitis no portal');
  var dx = evaluarAscitisNoPortal_(
    parsed.gasaVal,
    parsed.protGdl,
    parsed.tgl,
    parsed.amil,
    parsed.citologia
  );
  if (dx) alerts.push(dx);
}

/** Alertas clínicas de ascitis (PBE + GASA; no van a resultados copiables). */
export function buildAscitisLabAlerts_(textoBruto, serumOpts, parsedIn) {
  var parsed = parsedIn || parseCitoquimicoLiquidosParsed(textoBruto, serumOpts);
  if (!parsed || !parsed.esAscitico) return [];
  var alerts = evaluarPbeAscitis_(parsed.leu, parsed.pmnInfo, parsed.gram);
  appendGasaAlerts_(alerts, parsed);
  return alerts;
}

/** Alertas clínicas de líquido pleural (Light + infección/empiema). */
export function buildPleuralLabAlerts_(textoBruto, serumOpts, parsedIn) {
  var parsed = parsedIn || parseCitoquimicoLiquidosParsed(textoBruto, serumOpts);
  if (!parsed || !parsed.esPleural) return [];
  var alerts = [];
  if (parsed.lightTxt) alerts.push(parsed.lightTxt);
  var inf = evaluarPleuralInfeccion_(parsed.pH, parsed.glu, parsed.leu);
  for (var i = 0; i < inf.length; i++) alerts.push(inf[i]);
  return alerts;
}

/** Alertas clínicas LCR (sanidad pH + etiología orientativa). */
export function buildLcrLabAlerts_(textoBruto, serumOpts) {
  var parsed = parseLcrParsed(textoBruto);
  if (!parsed) return [];
  var alerts = [];
  var phFlag = evaluarLcrPhSanity_(parsed.pH);
  if (phFlag) alerts.push(phFlag);
  var serumGlu = resolveSerumGlucoseForInterpret_(textoBruto, serumOpts);
  alerts = alerts.concat(
    evaluarLcrEtiologia_(
      parsed.leu,
      parsed.glu,
      parsed.protMgdl,
      parsed.gram,
      parsed.tinta,
      serumGlu
    )
  );
  return alerts;
}

/** Alertas combinadas Liq + LCR para el bloque de interpretación. */
export function buildCitoquimicoInterpretAlerts_(textoBruto, serumOpts, parsedIn) {
  var parsed = parsedIn || parseCitoquimicoLiquidosParsed(textoBruto, serumOpts);
  var alerts = [];
  if (parsed && parsed.line) {
    alerts = alerts.concat(
      buildAscitisLabAlerts_(textoBruto, serumOpts, parsed),
      buildPleuralLabAlerts_(textoBruto, serumOpts, parsed)
    );
  }
  alerts = alerts.concat(buildLcrLabAlerts_(textoBruto, serumOpts));
  return alerts;
}

function parseLiqValuesFromResLabLine_(line) {
  var leuMatch = line.match(/\bLeu\s+([0-9]+(?:[.,][0-9]+)?)\*?/i);
  var pmnMatch = line.match(/\bPMN\s+([^\s]+)/i);
  var albMatch = line.match(/\bAlb\s+([0-9]+(?:[.,][0-9]+)?)\*?/i);
  var leuNum = leuMatch ? parseFluidLeu_(leuMatch[1]) : null;
  return {
    esAscitico: /\bASCIT|PERITONEAL|L[IÍ]QUIDO\s+ASCIT/i.test(line),
    esPleural: /\bPLEURAL\b/i.test(line),
    alb: albMatch ? parseFloat(String(albMatch[1]).replace(',', '.')) : null,
    leu: leuNum,
    pmnInfo: pmnMatch ? parsePmnField_(pmnMatch[1], leuNum) : { pmnNum: null, pmnPct: null, predominant: false },
    gram: (line.match(/\bGram\s+([^\s]+(?:\s+[^\s]+)*)/i) || [])[1] || '',
    serumAlb: null,
    gasaVal: null,
    protGdl: null,
    tgl: null,
    amil: null,
    citologia: null,
    lightTxt: '',
    pH: null,
    glu: null,
    line: line,
  };
}

function ascitisParsedFromResLabsLiq_(resLabs) {
  var rows = resLabs || [];
  for (var i = 0; i < rows.length; i++) {
    var line = String(rows[i] || '');
    if (labSectionKey_(line) !== 'LIQ:') continue;
    return parseLiqValuesFromResLabLine_(line);
  }
  return null;
}

function enrichAscitisGasa_(parsed, src, serumOpts) {
  if (parsed.alb == null || parsed.serumAlb != null) return;
  var serumAlb = resolveSerumAlbuminForGasa_(src, src ? bloqueCitoquimicoLiquidosFull(src) : '', serumOpts);
  if (serumAlb == null) return;
  parsed.serumAlb = serumAlb;
  parsed.gasaVal = computeGasaValue_(serumAlb, parsed.alb);
}

function replaceLiqLineFromSource_(out, src, serumOpts) {
  var newLiq = parsearCitoquimicoLiquidos(src, serumOpts);
  if (!newLiq) return out;
  return out
    .filter(function (r) {
      return labSectionKey_(r) !== 'LIQ:';
    })
    .concat([newLiq]);
}

function updateLiqLineWithGasa_(out, parsed) {
  if (parsed.gasaVal == null || !parsed.line) return out;
  var liqLine = parsed.line;
  if (!/\bGASA\b/.test(liqLine)) {
    liqLine = liqLine + ' GASA ' + String(parsed.gasaVal);
  } else {
    liqLine = liqLine.replace(/\bGASA\s+[0-9]+(?:[.,][0-9]+)?/, 'GASA ' + String(parsed.gasaVal));
  }
  return out
    .filter(function (r) {
      return labSectionKey_(r) !== 'LIQ:';
    })
    .concat([liqLine]);
}

export function resLabsHasLcr_(resLabs) {
  return !!(resLabs || []).some(function (row) {
    return labSectionKey_(String(row || '')) === 'LCR:';
  });
}

export function resLabsHasCitoquimFluid_(resLabs) {
  return resLabsHasAsciticFluid_(resLabs) || resLabsHasPleuralFluid_(resLabs) || resLabsHasLcr_(resLabs);
}

/**
 * Actualiza línea Liq/LCR y bloque INTERPRETACIÓN CITOQUÍMICO con datos del mismo día.
 */
export function refreshCitoquimicoInterpretacionInResLabs_(resLabs, textoBruto, serumOpts) {
  var rows = resLabs || [];
  var src = String(textoBruto || '').trim();
  var parsed = src ? parseCitoquimicoLiquidosParsed(src, serumOpts) : ascitisParsedFromResLabsLiq_(rows);
  var hasLcr = src ? !!parseLcrParsed(src) : resLabsHasLcr_(rows);
  if ((!parsed || (!parsed.esAscitico && !parsed.esPleural && !parsed.line)) && !hasLcr) {
    return rows.slice();
  }

  if (parsed && parsed.esAscitico) enrichAscitisGasa_(parsed, src, serumOpts);

  var out = rows.filter(function (r) {
    return !isCitoquimInterpretacionResLabChunk(r);
  });
  if (src) {
    out = replaceLiqLineFromSource_(out, src, serumOpts);
  } else if (parsed && parsed.esAscitico) {
    out = updateLiqLineWithGasa_(out, parsed);
  }

  var interp = formatCitoquimicoInterpretacionLine_(
    buildCitoquimicoInterpretAlerts_(src, serumOpts, parsed && parsed.line ? parsed : null)
  );
  if (interp) out.push(interp);
  return dedupeSingletonSections_(out);
}

/** @deprecated use refreshCitoquimicoInterpretacionInResLabs_ */
export function refreshAscitisInterpretacionInResLabs_(resLabs, textoBruto, serumOpts) {
  return refreshCitoquimicoInterpretacionInResLabs_(resLabs, textoBruto, serumOpts);
}

export { evaluarPbeAscitis_, evaluarPleuralInfeccion_, evaluarLcrEtiologia_, evaluarLcrPhSanity_ } from './labs-citoquimico-interpret-rules.mjs';
