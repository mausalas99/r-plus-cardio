import { gramIsPositive_, isGramNegative_ } from './labs-fluid-interpret-values.mjs';

const PBE_PMN_CUTOFF = 250;
const PBE_LEU_CUTOFF = 250;
const PLEURAL_PH_EMPYEMA = 7.2;
const PLEURAL_GLU_EMPYEMA = 60;
const PLEURAL_LEU_EMPYEMA = 50000;
const LCR_PH_MIN = 7.28;
const LCR_PH_MAX = 7.42;

/** pH LCR implausible → flag orientativo (solo bloque interpretación). */
export function evaluarLcrPhSanity_(pH) {
  if (pH == null || !isFinite(pH)) return '';
  if (pH < LCR_PH_MIN || pH > LCR_PH_MAX) {
    return (
      'pH LCR ' +
      pH +
      ' fuera de rango fisiológico (' +
      LCR_PH_MIN +
      '–' +
      LCR_PH_MAX +
      ') — verificar muestra/reporte'
    );
  }
  return '';
}

/**
 * Peritonitis bacteriana espontánea / secundaria (Runyon: PMN ≥250/mm³).
 * @param {number|null} leu
 * @param {{ pmnNum: number|null, pmnPct: number|null, predominant: boolean }} pmnInfo
 * @param {string} gram
 */
export function evaluarPbeAscitis_(leu, pmnInfo, gram) {
  var alerts = [];
  var pmn = pmnInfo && pmnInfo.pmnNum;
  if (pmn == null && leu != null && leu >= PBE_PMN_CUTOFF && pmnInfo && pmnInfo.predominant) {
    pmn = leu;
  }
  if (pmn != null && pmn >= PBE_PMN_CUTOFF) {
    alerts.push(
      'PMN ' + pmn + ' ≥250/mm³ — peritonitis bacteriana espontánea? (cultivo + ATB empírico)'
    );
  } else if (leu != null && leu >= PBE_LEU_CUTOFF) {
    alerts.push('Leu ' + leu + ' ≥250/mm³ — descartar PBE (confirmar PMN absoluto)');
  }
  if (gramIsPositive_(gram)) {
    alerts.push('Gram ' + gram + ' — infección bacteriana en líquido ascítico?');
  }
  return alerts;
}

/**
 * Derrame pleural complicado / empiema (pH, glucosa, celularidad).
 * @param {number|null} pH
 * @param {number|null} glu
 * @param {number|null} leu
 */
export function evaluarPleuralInfeccion_(pH, glu, leu) {
  var alerts = [];
  if (pH != null && pH < PLEURAL_PH_EMPYEMA) {
    alerts.push('pH pleural ' + pH + ' <7.20 — derrame complicado / empiema?');
  }
  if (glu != null && glu < PLEURAL_GLU_EMPYEMA) {
    alerts.push('Glu pleural ' + glu + ' <60 mg/dL — derrame complicado / empiema?');
  }
  if (leu != null && leu >= PLEURAL_LEU_EMPYEMA) {
    alerts.push('Leu ' + leu + ' ≥50k/mm³ — empiema?');
  }
  return alerts;
}

function lcrGluLow_(glu, serumGlu) {
  if (glu == null) return false;
  if (glu < 40) return true;
  if (serumGlu != null && serumGlu > 0 && glu / serumGlu < 0.4) return true;
  return false;
}

function pushLcrBacterialAlert_(alerts, leu, glu, gram) {
  if (gramIsPositive_(gram)) {
    alerts.push('Meningitis bacteriana? (Gram ' + gram + ')');
    return;
  }
  var gluTxt = glu != null ? ', Glu LCR ' + glu : '';
  alerts.push('Meningitis bacteriana? (Leu ' + leu + gluTxt + ' — cultivo/ATB empírico)');
}

function pushLcrViralAlert_(alerts, leu) {
  alerts.push('Meningitis viral/aséptica? (Leu ' + leu + ' — correlacionar PCR/virología)');
}

function pushLcrTbAlert_(alerts, leu, glu, prot) {
  var bits = ['Leu ' + leu];
  if (glu != null) bits.push('Glu ' + glu);
  if (prot != null) bits.push('Prot ' + prot);
  alerts.push('Meningitis tuberculosa? (' + bits.join(', ') + ' — ADA/BAAR/genXpert)');
}

/**
 * Orientación etiológica LCR (bacteriana vs viral vs TB).
 * @param {number|null} leu
 * @param {number|null} glu
 * @param {number|null} prot
 * @param {string} gram
 * @param {string} tinta
 * @param {number|null} serumGlu
 */
export function evaluarLcrEtiologia_(leu, glu, prot, gram, tinta, serumGlu) {
  var alerts = [];
  if (leu == null && glu == null && prot == null) return alerts;

  if (leu != null && leu <= 5 && !lcrGluLow_(glu, serumGlu) && (prot == null || prot <= 45)) {
    return alerts;
  }

  if (gramIsPositive_(gram) || (tinta && !isGramNegative_(tinta) && /POSITIV|LEVADUR|COC/i.test(tinta))) {
    pushLcrBacterialAlert_(alerts, leu, glu, gram || tinta);
    return alerts;
  }

  if (leu != null && leu >= 1000) {
    pushLcrBacterialAlert_(alerts, leu, glu, gram);
    return alerts;
  }

  if (leu != null && leu >= 100 && lcrGluLow_(glu, serumGlu) && prot != null && prot > 100) {
    pushLcrTbAlert_(alerts, leu, glu, prot);
    return alerts;
  }

  if (leu != null && leu >= 100 && lcrGluLow_(glu, serumGlu)) {
    pushLcrBacterialAlert_(alerts, leu, glu, gram);
    return alerts;
  }

  if (leu != null && leu >= 100 && !lcrGluLow_(glu, serumGlu)) {
    alerts.push(
      'Meningitis bacteriana parcialmente tratada vs viral? (Leu ' + leu + ' — correlacionar clínica)'
    );
    return alerts;
  }

  if (leu != null && leu >= 10 && leu < 100) {
    pushLcrViralAlert_(alerts, leu);
    return alerts;
  }

  if (leu != null && leu > 5) {
    alerts.push('Pleocitosis leve LCR (Leu ' + leu + ') — correlacionar clínica');
  }
  return alerts;
}
