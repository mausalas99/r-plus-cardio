// Gasometría extendida (interpretación Ácido-Base auxiliar para Tendencias)
import {
  computeAnionGapValue_,
  computeAlbuminCorrectedAnionGapValue_,
  computeUrinaryAnionGapValue_,
} from './labs.js';
import {
  toFiniteNum_,
  buildPhStep_,
  detectMixedFromWinter_,
  classifyPrimaryDisorder_,
  buildCompensation_,
  buildAnionGapStep_,
  buildUrinaryAnionGapStep_,
  buildDeltaDeltaStep_,
  buildOxygenationStep_,
  buildSummaryLines_,
  strLab_,
} from './gaso-extended-steps.mjs';
import { buildPrimaryRationale_ } from './gaso-extended-rationale.mjs';

/** @typedef {object} GasoExtendedInput
 * @property {unknown} [pH]
 * @property {unknown} [pCO2]
 * @property {unknown} [pO2]
 * @property {unknown} [hco3]
 * @property {unknown} [na]
 * @property {unknown} [cl]
 * @property {unknown} [alb]
 * @property {unknown} [naU]
 * @property {unknown} [kU]
 * @property {unknown} [clU]
 * @property {unknown} [uag]
 * @property {unknown} [fio2]
 * @property {unknown} [ageMonths]
 */

/**
 * @param {GasoExtendedInput} input
 * @returns {{ steps: Record<string, any>, summaryLines: string[] }}
 */
export function evaluateGasoExtended(input) {
  var inp = input || {};
  var pH = toFiniteNum_(inp.pH);
  var pCO2 = toFiniteNum_(inp.pCO2);
  var pO2 = toFiniteNum_(inp.pO2);
  var hco3 = toFiniteNum_(inp.hco3);
  var na = toFiniteNum_(inp.na);
  var cl = toFiniteNum_(inp.cl);
  var alb = toFiniteNum_(inp.alb);
  var naU = toFiniteNum_(inp.naU);
  var kU = toFiniteNum_(inp.kU);
  var clU = toFiniteNum_(inp.clU);
  var ageMonths = toFiniteNum_(inp.ageMonths);
  var fio2 = toFiniteNum_(inp.fio2);
  if (fio2 == null || !isFinite(fio2)) fio2 = 0.21;

  var agVal = computeAnionGapValue_(strLab_(na), strLab_(cl), strLab_(hco3)) ?? null;
  var agcVal =
    computeAlbuminCorrectedAnionGapValue_(strLab_(na), strLab_(cl), strLab_(hco3), strLab_(alb)) ??
    null;
  var uagVal = toFiniteNum_(inp.uag);
  if (uagVal == null) {
    uagVal = computeUrinaryAnionGapValue_(strLab_(naU), strLab_(kU), strLab_(clU)) ?? null;
  }

  var phStep = buildPhStep_(pH);

  var metaLow = hco3 != null && hco3 < 22;
  var metaHigh = hco3 != null && hco3 > 26;
  var respLow = pCO2 != null && pCO2 < 35;
  var respHigh = pCO2 != null && pCO2 > 45;
  var winterCenter = hco3 != null ? 1.5 * hco3 + 8 : null;
  var mixedFromWinter = detectMixedFromWinter_(metaLow, pCO2, winterCenter, hco3);
  var classified = classifyPrimaryDisorder_(pH, metaLow, metaHigh, respLow, respHigh, mixedFromWinter);

  var primary = {
    disorder: classified.disorder,
    type: classified.type,
    rationale: buildPrimaryRationale_({
      pH,
      hco3,
      pCO2,
      primary: classified,
      mixedFromWinter,
      winterCenter,
      metaLow,
      metaHigh,
      respLow,
      respHigh,
    }),
  };

  var compensation = buildCompensation_(hco3, metaLow, pCO2, winterCenter);
  var anionGap = buildAnionGapStep_(agVal, agcVal);
  var urinaryAnionGap = buildUrinaryAnionGapStep_(uagVal);
  var deltaDelta = buildDeltaDeltaStep_(agVal, hco3, agcVal);
  var oxygenation = buildOxygenationStep_(pO2, pCO2, fio2, ageMonths);
  var summaryLines = buildSummaryLines_({
    phStep,
    primary,
    compensation,
    anionGap,
    urinaryAnionGap,
    deltaDelta,
    oxygenation,
  });

  return {
    steps: {
      ph: phStep,
      primary,
      compensation,
      anionGap,
      urinaryAnionGap,
      deltaDelta,
      oxygenation,
    },
    summaryLines,
  };
}
