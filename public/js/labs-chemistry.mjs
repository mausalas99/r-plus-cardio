import { extraerConRango, extraerConRangoSuero, marcarSegunRango, fmt, toNum_ } from './labs-extract.mjs';
import { ageYearsFromLabDemographics, computeEgfrCkdEpi2021Creatinine } from './labs-egfr.mjs';

export function extraerProcalcitonina_(texto) {
  var defaultRange = { valor: '---', min: 0, max: 0.05 };
  if (!texto) return defaultRange;
  var t = texto.toUpperCase();
  var positions = [];
  var start = 0;
  while (true) {
    var p = t.indexOf('PROCALCITONINA', start);
    if (p === -1) break;
    positions.push(p);
    start = p + 'PROCALCITONINA'.length;
  }
  if (!positions.length) return defaultRange;
  for (var i = positions.length - 1; i >= 0; i--) {
    var pos = positions[i] + 'PROCALCITONINA'.length;
    var sub = texto.substring(pos, pos + 220);
    var mVal = sub.match(/(-?\d+[.,]?\d*)/);
    if (!mVal) continue;
    var valor = mVal[1];
    var rangeM = sub.match(/ADULTO[^0-9<]*<\s*=?\s*(\d+[.,]?\d*)/i);
    var max = rangeM ? parseFloat(rangeM[1].replace(',', '.')) : 0.05;
    return { valor: valor, min: 0, max: max };
  }
  return defaultRange;
}

function fmtSuero_(data) {
  return fmt(marcarSegunRango(data.valor, data.min, data.max));
}

function appendQsPair_(p, key, val) {
  if (val !== '---') p.push(key, val);
}

function appendEgfrIfEligible_(p, crData, patientCtx) {
  if (!patientCtx) return;
  var ageY = ageYearsFromLabDemographics(patientCtx.edad, patientCtx.edadUnidad);
  var sexo = patientCtx.sexo;
  if (ageY == null || ageY < 18 || (sexo !== 'M' && sexo !== 'F')) return;
  var scrNum = toNum_(crData.valor);
  if (scrNum == null || scrNum <= 0) return;
  var egfr = computeEgfrCkdEpi2021Creatinine(scrNum, ageY, sexo === 'F');
  if (egfr != null) p.push('eTFG', String(Math.round(egfr)));
}

function extractQsFormatted_(texto) {
  var crData = extraerConRangoSuero(['CREATININA EN SANGRE', 'CREATININA'], texto);
  return {
    Glu: fmtSuero_(extraerConRangoSuero(['GLUCOSA EN SANGRE', 'GLUCOSA EN', 'GLUCOSA'], texto)),
    crData: crData,
    Cr: fmtSuero_(crData),
    BUN: fmtSuero_(
      extraerConRangoSuero(['NITROGENO DE LA UREA EN SANGRE', 'NITROGENO DE LA UREA', 'UREA'], texto)
    ),
    PCR: fmtSuero_(extraerConRangoSuero(['PROTEINA C REACTIVA', 'PROTEÍNA C REACTIVA'], texto)),
    PCT: fmtSuero_(extraerProcalcitonina_(texto)),
    AU: fmtSuero_(extraerConRangoSuero(['ACIDO URICO EN SANGRE', 'ACIDO URICO', 'ÁCIDO ÚRICO'], texto)),
    TGL: fmtSuero_(extraerConRangoSuero(['TRIGLICERIDOS', 'TRIGLICÉRIDOS'], texto)),
    COL: fmtSuero_(extraerConRangoSuero(['COLESTEROL'], texto)),
    VSG: fmtSuero_(extraerConRangoSuero(['VSG ', 'VELOCIDAD DE SEDIMENTACION'], texto)),
    CPK: fmtSuero_(extraerConRangoSuero(['CPK CREATIN FOSFO QUINASA', 'CPK '], texto)),
  };
}

export function parseQS_(texto, patientCtx) {
  var q = extractQsFormatted_(texto);
  var vals = [q.Glu, q.Cr, q.BUN, q.PCR, q.PCT, q.AU, q.TGL, q.COL, q.VSG, q.CPK];
  if (vals.every(function (v) {
    return v === '---';
  })) {
    return '';
  }

  var p = ['QS'];
  appendQsPair_(p, 'Glu', q.Glu);
  if (q.Cr !== '---') {
    p.push('Cr', q.Cr);
    appendEgfrIfEligible_(p, q.crData, patientCtx);
  }
  appendQsPair_(p, 'BUN', q.BUN);
  appendQsPair_(p, 'PCR', q.PCR);
  appendQsPair_(p, 'PCT', q.PCT);
  appendQsPair_(p, 'AU', q.AU);
  appendQsPair_(p, 'TGL', q.TGL);
  appendQsPair_(p, 'COL', q.COL);
  appendQsPair_(p, 'VSG', q.VSG);
  appendQsPair_(p, 'CPK', q.CPK);
  return p[0] + '\t' + p.slice(1).join(' ');
}

export function parseESC_(texto) {
  var naData = extraerConRangoSuero(['SODIO'], texto);
  if (naData.valor === '---') return '';
  var clData = extraerConRangoSuero(['CLORO'], texto);
  var kData  = extraerConRangoSuero(['POTASIO'], texto);
  var caData = extraerConRangoSuero(['CALCIO EN SUERO','CALCIO'], texto);
  var fData  = extraerConRangoSuero(['FOSFORO EN SANGRE','FOSFORO','FÓSFORO'], texto);
  var mgData = extraerConRangoSuero(['MAGNESIO'], texto);

  var Na = fmt(marcarSegunRango(naData.valor, naData.min, naData.max));
  var Cl = fmt(marcarSegunRango(clData.valor, clData.min, clData.max));
  var K  = fmt(marcarSegunRango(kData.valor,  kData.min,  kData.max));
  var Ca = fmt(marcarSegunRango(caData.valor, caData.min, caData.max));
  var F  = fmt(marcarSegunRango(fData.valor,  fData.min,  fData.max));
  var Mg = fmt(marcarSegunRango(mgData.valor, mgData.min, mgData.max));

  var p = ['ESC'];
  p.push('Na', Na);
  if (Cl !== '---') p.push('Cl', Cl);
  if (K  !== '---') p.push('K',  K);
  if (Ca !== '---') p.push('Ca', Ca);
  if (F  !== '---') p.push('F',  F);
  if (Mg !== '---') p.push('Mg', Mg);
  return p[0]+'\t'+p.slice(1).join(' ');
}

export function parsePFH_(tNorm) {
  var albData  = extraerConRangoSuero(['ALBUMINA'], tNorm);
  var astData  = extraerConRango(['AST(ASPARTATO AMINOTRANSFERASA)','AST '], tNorm);
  var altData  = extraerConRango(['ALT ALANIN AMINO TRANSFERASA','ALT '], tNorm);
  var alpData  = extraerConRango(['ALP FOSFATASA ALCALINA','FOSFATASA ALCALINA'], tNorm);
  var btData   = extraerConRango(['BILIRRUBINA TOTAL'], tNorm);
  var bdData   = extraerConRango(['BILIRRUBINA DIRECTA'], tNorm);
  var biData   = extraerConRango(['BILIRRUBINA INDIRECTA'], tNorm);
  var ldhData  = extraerConRango(['LDH DESHIDROGENASA LACTICA','LDH '], tNorm);
  var amilData = extraerConRango(['AMILASA SERICA','AMILASA'], tNorm);

  var Alb  = fmt(marcarSegunRango(albData.valor,  albData.min,  albData.max));
  var AST  = fmt(marcarSegunRango(astData.valor,  astData.min,  astData.max));
  var ALT  = fmt(marcarSegunRango(altData.valor,  altData.min,  altData.max));
  var FA   = fmt(marcarSegunRango(alpData.valor,  alpData.min,  alpData.max));
  var BT   = fmt(marcarSegunRango(btData.valor,   btData.min,   btData.max));
  var BD   = fmt(marcarSegunRango(bdData.valor,   bdData.min,   bdData.max));
  var BI   = fmt(marcarSegunRango(biData.valor,   biData.min,   biData.max));
  var LDH  = fmt(marcarSegunRango(ldhData.valor,  ldhData.min,  ldhData.max));
  var Amil = fmt(marcarSegunRango(amilData.valor, amilData.min, amilData.max));

  if ([Alb,AST,ALT,FA,BT,BD,BI,LDH,Amil].every(function(v){return v==='---';})) return '';
  var p = ['PFHs'];
  if (Alb  !== '---') p.push('Alb',  Alb);
  if (AST  !== '---') p.push('AST',  AST);
  if (ALT  !== '---') p.push('ALT',  ALT);
  if (FA   !== '---') p.push('FA',   FA);
  if (BT   !== '---') p.push('BT',   BT);
  if (BD   !== '---') p.push('BD',   BD);
  if (BI   !== '---') p.push('BI',   BI);
  if (LDH  !== '---') p.push('LDH',  LDH);
  if (Amil !== '---') p.push('Amil', Amil);
  return p[0]+'\t'+p.slice(1).join(' ');
}

export function parseLipasa_(texto) {
  var lipData = extraerConRango(['LIPASA SERICA', 'LIPASA'], texto);
  var Lip = fmt(marcarSegunRango(lipData.valor, lipData.min, lipData.max));
  if (Lip === '---') return '';
  return 'LIPASA\tLip ' + Lip;
}

