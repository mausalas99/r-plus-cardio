// Step builders for gaso-extended evaluation (extracted for complexity budget).

/**
 * @param {unknown} v
 * @returns {number|null}
 */
export function toFiniteNum_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(/\*/g, '').replace(',', '.');
  if (!s || s === '---') return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/**
 * @param {number|null} agValue
 * @param {number|null} hco3
 * @returns {number|null}
 */
export function deltaDeltaValue_(agValue, hco3) {
  if (agValue == null || hco3 == null) return null;
  var deltaHco3 = 24 - hco3;
  if (deltaHco3 <= 0) return null;
  return (agValue - 12) / deltaHco3;
}

/**
 * @param {number|null} n
 * @param {number} [decimals]
 * @returns {string}
 */
export function fmtLab_(n, decimals) {
  if (n == null || !isFinite(n)) return '—';
  if (decimals == null) return String(n);
  var p = Math.pow(10, decimals);
  return String(Math.round((n + Number.EPSILON) * p) / p);
}

/** @param {number|null} n @returns {string} */
export function strLab_(n) {
  if (n == null || !isFinite(n)) return '---';
  return String(n);
}

/**
 * @param {number|null} pH
 * @returns {{ label: string, interpretation: string }}
 */
export function buildPhStep_(pH) {
  if (pH != null) {
    if (pH < 7.35) return { label: 'pH', interpretation: 'Acidemia (pH < 7.35).' };
    if (pH > 7.45) return { label: 'pH', interpretation: 'Alcalemia (pH > 7.45).' };
    return {
      label: 'pH',
      interpretation: 'pH dentro del rango fisiológico típico (7.35–7.45) o apenas compensado.',
    };
  }
  return { label: 'pH', interpretation: 'Sin dato de pH para clasificar estado ácido-base.' };
}

/**
 * @param {boolean} metaLow
 * @param {number|null} pCO2
 * @param {number|null} winterCenter
 * @param {number|null} hco3
 */
export function detectMixedFromWinter_(metaLow, pCO2, winterCenter, hco3) {
  if (!metaLow || pCO2 == null || winterCenter == null || !isFinite(winterCenter) || hco3 == null || hco3 >= 22) {
    return false;
  }
  return pCO2 > winterCenter + 2 || pCO2 < winterCenter - 2;
}

function classifyAcidemiaPrimary_(metaLow, respHigh) {
  if (metaLow) return { disorder: 'metabolic', type: 'acidosis' };
  if (respHigh) return { disorder: 'respiratory', type: 'acidosis' };
  return { disorder: 'mixed', type: 'acidosis' };
}

function classifyAlcalemiaPrimary_(metaHigh, respLow) {
  if (metaHigh) return { disorder: 'metabolic', type: 'alkalosis' };
  if (respLow) return { disorder: 'respiratory', type: 'alkalosis' };
  return { disorder: 'mixed', type: 'alkalosis' };
}

function classifyCompensatedPrimary_(metaLow, metaHigh, respLow, respHigh) {
  if (metaLow && respLow) return { disorder: 'compensated', type: 'acidosis' };
  if (metaHigh && respHigh) return { disorder: 'compensated', type: 'alkalosis' };
  return { disorder: 'compensated', type: 'none' };
}

/**
 * @param {number|null} pH
 * @param {boolean} metaLow
 * @param {boolean} metaHigh
 * @param {boolean} respLow
 * @param {boolean} respHigh
 * @param {boolean} mixedFromWinter
 * @returns {{ disorder: string, type: string }}
 */
export function classifyPrimaryDisorder_(pH, metaLow, metaHigh, respLow, respHigh, mixedFromWinter) {
  if (mixedFromWinter) {
    var type = 'acidosis';
    if (pH != null && pH > 7.45) type = 'alkalosis';
    return { disorder: 'mixed', type };
  }
  if (pH == null) return { disorder: 'unknown', type: 'none' };
  if (pH < 7.35) return classifyAcidemiaPrimary_(metaLow, respHigh);
  if (pH > 7.45) return classifyAlcalemiaPrimary_(metaHigh, respLow);
  return classifyCompensatedPrimary_(metaLow, metaHigh, respLow, respHigh);
}

/**
 * @param {number|null} hco3
 * @param {boolean} metaLow
 * @param {number|null} pCO2
 * @param {number|null} winterCenter
 */
export function buildCompensation_(hco3, metaLow, pCO2, winterCenter) {
  var compensation = {
    expectedPCO2: null,
    expectedHCO3Acute: null,
    expectedHCO3Chronic: null,
    note: '',
  };
  var compParts = [];

  if (hco3 != null && metaLow && winterCenter != null && isFinite(winterCenter)) {
    compensation.expectedPCO2 = Math.round((winterCenter + Number.EPSILON) * 10) / 10;
    compParts.push(
      'Acidosis metabólica esperada Winter: PaCO₂ ≈ 1.5 × HCO₃⁻ + 8 (= ' +
        compensation.expectedPCO2 +
        ', margen habitual ±2 mmHg).'
    );
    if (metaLow && pCO2 != null && winterCenter != null && (pCO2 > winterCenter + 2 || pCO2 < winterCenter - 2)) {
      compParts.push(
        'La PaCO₂ medida discrepa del rango esperado para compensación de una acidosis metabólica única.'
      );
    }
  }

  if (pCO2 != null) {
    var deltaPCO2 = pCO2 - 40;
    compensation.expectedHCO3Acute = Math.round((24 + 0.1 * deltaPCO2 + Number.EPSILON) * 10) / 10;
    compensation.expectedHCO3Chronic = Math.round((24 + 0.4 * deltaPCO2 + Number.EPSILON) * 10) / 10;
    compParts.push(
      'Trastorno primario respiratorio (referencia ΔPaCO₂ frente a 40 mmHg): HCO₃⁻ esperada aguda ≈ 24 + 0.1×Δ (= ' +
        compensation.expectedHCO3Acute +
        '), crónica ≈ 24 + 0.4×Δ (= ' +
        compensation.expectedHCO3Chronic +
        ').'
    );
    if (hco3 != null) {
      if (Math.abs(hco3 - compensation.expectedHCO3Acute) < 2) {
        compParts.push('El HCO₃⁻ coincide mejor con patrón agudo (~0.1/ΔPaCO₂).');
      } else if (Math.abs(hco3 - compensation.expectedHCO3Chronic) < 2) {
        compParts.push('El HCO₃⁻ coincide mejor con patrón crónico/compensatorio (~0.4/ΔPaCO₂).');
      }
    }
  }

  compensation.note = compParts.length ? compParts.join(' ') : 'Sin suficientes datos para estimar compensación.';
  return compensation;
}

/** @param {number|null} agVal @param {number|null} [agcVal] */
export function buildAnionGapStep_(agVal, agcVal) {
  var display = agcVal != null ? agcVal : agVal;
  var anionGap = {
    value: agVal != null ? Math.round((agVal + Number.EPSILON) * 10) / 10 : null,
    corrected: agcVal != null ? Math.round((agcVal + Number.EPSILON) * 10) / 10 : null,
    interpretation: '',
  };
  if (display != null && isFinite(display)) {
    var label = agcVal != null ? 'Anión gap corregido por albúmina (AGc)' : 'Anión gap';
    if (display < 8) {
      anionGap.interpretation =
        label + ' por debajo del rango usual (referencia habitual 8–12 mEq/L).';
    } else if (display > 12) {
      anionGap.interpretation =
        label + ' elevado (>12): favorézcase gap en acidosis metabólica (lista amplia diferencial).';
    } else {
      anionGap.interpretation = label + ' dentro del rango usual (aproximadamente 8–12).';
    }
    if (agcVal != null && agVal != null) {
      anionGap.interpretation +=
        ' AG crudo ' +
        String(Math.round((agVal + Number.EPSILON) * 10) / 10) +
        ' → AGc ' +
        String(Math.round((agcVal + Number.EPSILON) * 10) / 10) +
        ' (corrección +2.5×(4−Alb)).';
    }
  } else {
    anionGap.interpretation = 'No se puede calcular (falta Na, Cl u HCO₃⁻).';
  }
  return anionGap;
}

/** @param {number|null} uagVal */
export function buildUrinaryAnionGapStep_(uagVal) {
  var urinaryAnionGap = {
    value: uagVal != null ? Math.round((uagVal + Number.EPSILON) * 10) / 10 : null,
    interpretation: '',
  };
  if (uagVal != null && isFinite(uagVal)) {
    if (uagVal < 0) {
      urinaryAnionGap.interpretation =
        'UAG negativo: favorece excreción renal adecuada de NH₄⁺ (p. ej. pérdidas GI / diarrea).';
    } else {
      urinaryAnionGap.interpretation =
        'UAG positivo o cero: sugiere alteración en excreción de NH₄⁺ (considerar ATR u otras causas renales).';
    }
  } else {
    urinaryAnionGap.interpretation =
      'No se puede calcular (faltan Na, K o Cl urinarios).';
  }
  return urinaryAnionGap;
}

/** @param {number|null} agVal @param {number|null} hco3 @param {number|null} [agcVal] */
export function buildDeltaDeltaStep_(agVal, hco3, agcVal) {
  var effAg = agcVal != null ? agcVal : agVal;
  var ddValue = deltaDeltaValue_(effAg, hco3);
  var deltaDelta = {
    value: ddValue != null ? Math.round((ddValue + Number.EPSILON) * 10) / 10 : null,
    interpretation: '',
  };
  if (effAg != null && effAg > 12 && ddValue != null) {
    if (ddValue < 0.8) {
      deltaDelta.interpretation =
        'Delta-delta bajo: componente hiperclorémico destacado coexistiendo con AG elevado (coexistencia plausible).';
    } else if (ddValue > 2) {
      deltaDelta.interpretation =
        'Delta-delta alto: bicarbonato menor al esperado sólo por gap (alcalosis metabólica coexistiente o otros factores).';
    } else {
      deltaDelta.interpretation = 'Delta-delta cercano al patrón de acidosis típico de gap elevado.';
    }
  } else if (effAg != null && effAg <= 12) {
    deltaDelta.interpretation = 'Sin relevancia de delta-delta habitual si el AG no está elevado.';
  } else {
    deltaDelta.interpretation = 'No disponible.';
  }
  return deltaDelta;
}

function pfRatioInterpretation_(pfRatio) {
  if (pfRatio >= 400) return 'P/F alta (usualmente mejor perfusión/tejido si FiO₂ es confiable).';
  if (pfRatio >= 300) return 'P/F discretamente alterada.';
  if (pfRatio >= 200) return 'P/F compatible con déficit leve/moderado de oxigenación.';
  if (pfRatio > 0) return 'P/F bajo: hipoxemia significativa con la FiO₂ indicada.';
  return '';
}

function appendAaGradientNotes_(oxBits, pO2, pCO2, fio2, ageMonths) {
  var RQ = 0.8;
  var PAO2approx = fio2 * (760 - 47) - pCO2 / RQ;
  var aaGradient = Math.round((PAO2approx - pO2 + Number.EPSILON) * 10) / 10;
  oxBits.push(
    'Gradiente A–a simplificado (~nivel del mar; PAO₂ ≈ FiO₂×713 − PaCO₂/0.8): ≈ ' + aaGradient + ' mmHg.'
  );
  var ageYears = ageMonths != null ? ageMonths / 12 : null;
  if (ageYears != null && ageYears >= 18) {
    var expAa = Math.round((ageYears / 4 + 4 + Number.EPSILON) * 10) / 10;
    oxBits.push('Regla práctica esperada en adultos (orientativa ~edad años/4+4): ≈ ' + expAa + ' mmHg.');
  }
  return aaGradient;
}

/**
 * @param {number|null} pO2
 * @param {number|null} pCO2
 * @param {number} fio2
 * @param {number|null} ageMonths
 */
export function buildOxygenationStep_(pO2, pCO2, fio2, ageMonths) {
  var oxygenation = { pfRatio: null, aaGradient: null, note: '' };
  var oxBits = [];

  if (pO2 != null && isFinite(pO2) && fio2 > 0) {
    oxygenation.pfRatio = Math.round((pO2 / fio2 + Number.EPSILON) * 10) / 10;
    var pfNote = pfRatioInterpretation_(oxygenation.pfRatio);
    if (pfNote) oxBits.push(pfNote);
    oxBits.push('P/F ≈ ' + oxygenation.pfRatio + ' (PaO₂ / FiO₂).');
  }

  if (pO2 != null && pCO2 != null && fio2 > 0 && isFinite(fio2)) {
    oxygenation.aaGradient = appendAaGradientNotes_(oxBits, pO2, pCO2, fio2, ageMonths);
  }

  oxygenation.note = oxBits.join(' ');
  return oxygenation;
}

/**
 * @param {object} parts
 * @returns {string[]}
 */
export function buildSummaryLines_(parts) {
  var summaryLines = [];
  if (parts.phStep.interpretation) {
    summaryLines.push(parts.phStep.label + ': ' + parts.phStep.interpretation);
  }
  summaryLines.push(
    'Primario predominante inferido — ' +
      parts.primary.disorder +
      (parts.primary.type !== 'none' ? ' (' + parts.primary.type + ')' : '')
  );
  if (parts.compensation.note) summaryLines.push('Compensación: ' + parts.compensation.note);
  if (parts.anionGap.value != null) {
    var agLine = 'Anión gap: ' + String(parts.anionGap.value);
    if (parts.anionGap.corrected != null) {
      agLine += ' (AGc ' + String(parts.anionGap.corrected) + ')';
    }
    summaryLines.push(agLine + '. ' + parts.anionGap.interpretation);
  }
  if (parts.urinaryAnionGap && parts.urinaryAnionGap.value != null) {
    summaryLines.push(
      'UAG: ' + String(parts.urinaryAnionGap.value) + '. ' + parts.urinaryAnionGap.interpretation
    );
  }
  if (parts.deltaDelta.value != null) summaryLines.push('Delta-delta: ' + parts.deltaDelta.interpretation);
  if (parts.oxygenation.pfRatio != null || parts.oxygenation.aaGradient != null || parts.oxygenation.note) {
    summaryLines.push('Oxigenación: ' + parts.oxygenation.note);
  }
  return summaryLines;
}
