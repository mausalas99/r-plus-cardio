/** Bloques de texto copiables para nota externa VPO. */

export const VPO_OFFICIAL_CALCULATOR_DISCLAIMER =
  'R+ no calcula puntajes ni porcentajes de riesgo preoperatorio. Usa calculadoras médicas oficiales validadas (institucional o publicadas) para RCRI (Lee), Gupta MICA, ARISCAT, Caprini y clasificación ASA antes de documentar riesgo en la nota.';

/** Escalas a documentar manualmente (sin cálculo en R+). */
export const VPO_SUGGESTED_SCALES = [
  { key: 'asa', label: 'ASA', hint: 'Clasificación del estado físico (I–V).' },
  { key: 'rcri', label: 'RCRI (índice de Lee)', hint: 'Puntos y/o clase según calculadora validada.' },
  { key: 'gupta', label: 'Gupta MICA', hint: '% riesgo de IAM perioperatorio (herramienta validada).' },
  { key: 'ariscat', label: 'ARISCAT', hint: 'Puntos y categoría de riesgo pulmonar postoperatorio.' },
  { key: 'caprini', label: 'Caprini', hint: 'Puntos y categoría de riesgo tromboembólico.' },
];

/**
 * @param {object} state
 * @returns {string[]}
 */
export function formatVpoScaleResultLines(state) {
  var sr = (state && state.scaleResults) || {};
  return VPO_SUGGESTED_SCALES.map(function (s) {
    var val = String(sr[s.key] || '').trim();
    if (!val) return s.label + ': —';
    return s.label + ': ' + val;
  });
}

/**
 * Líneas de valoración sin puntajes calculados en R+.
 * @param {object} state
 */
export function formatVpoDocumentationLines(state) {
  return formatVpoScaleResultLines(state);
}

export function renderEkgWithFc(ekgText, fcLpm) {
  var t = String(ekgText || '');
  var fc = String(fcLpm || '').trim();
  if (!fc) return t;
  return t.replace(/FC\s*___\s*LPM/gi, 'FC ' + fc + ' LPM');
}

/**
 * Líneas de valoración documentada (escalas ingresadas manualmente).
 * @param {object} state
 */
export function formatRiskLines(_scores, state) {
  return formatVpoDocumentationLines(state);
}

/** @param {object} parts */
export function buildVpoFullCopyText(parts) {
  var blocks = [];
  if (parts.ekgBlock) {
    blocks.push('ELECTROCARDIOGRAMA:');
    blocks.push('');
    blocks.push(parts.ekgBlock);
    blocks.push('');
  }
  if (parts.rxBlock) {
    blocks.push('RADIOGRAFÍA DE TÓRAX:');
    blocks.push('');
    blocks.push(parts.rxBlock);
    blocks.push('');
  }
  if (parts.diagnosticosBlock) {
    blocks.push('DIAGNÓSTICOS:');
    blocks.push('');
    blocks.push(parts.diagnosticosBlock);
    blocks.push('');
  }
  if (parts.valoracionBlock) {
    blocks.push('VALORACIÓN PREOPERATORIA:');
    blocks.push('');
    blocks.push(parts.valoracionBlock);
  }
  return blocks.join('\n').trim();
}

/** @param {Array<{ nombreDisplay: string, notaEditable: string }>} farmacos */
export function buildFarmacosCopyText(farmacos) {
  return (farmacos || [])
    .map(function (f) {
      return '- ' + (f.nombreDisplay || '') + ': ' + (f.notaEditable || f.sugerencia || '');
    })
    .join('\n');
}
