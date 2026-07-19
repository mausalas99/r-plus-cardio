/** Catálogos VPO — transcritos de CALCULADORA VPO.xlsx (hoja Lookups). */

export const GUPTA_INTERCEPT = -3.45;

export const ASA_OPTIONS = [
  { key: 'asa-i', labelEn: 'Healthy / no systemic disease', asaClass: 'I', guptaCoef: -5.17 },
  { key: 'asa-ii', labelEn: 'Mild controlled systemic disease', asaClass: 'II', guptaCoef: -3.29 },
  { key: 'asa-iii', labelEn: 'Severe systemic disease', asaClass: 'III', guptaCoef: -1.92 },
  { key: 'asa-iv', labelEn: 'Severe systemic disease, constant threat to life', asaClass: 'IV', guptaCoef: -0.95 },
  { key: 'asa-v', labelEn: 'Moribund, not expected to survive without surgery', asaClass: 'V', guptaCoef: 0 },
];

export const FUNCTIONAL_STATUS = [
  { key: 'independent', labelEn: 'Independent', guptaCoef: 0 },
  { key: 'partially-dependent', labelEn: 'Partially dependent', guptaCoef: 0.65 },
  { key: 'totally-dependent', labelEn: 'Totally dependent', guptaCoef: 1.03 },
];

/** @typedef {'peripheral'|'upperAbdominal'|'intrathoracic'} AriscatIncisionKey */

/**
 * @typedef {object} VpoProcedure
 * @property {string} id
 * @property {string} labelEn
 * @property {number} guptaCoef
 * @property {'Bajo'|'Intermedio'|'Alto'} ahaQuirurgico
 * @property {boolean} rcriHighRisk
 * @property {AriscatIncisionKey} ariscatIncisionKey
 */

/** @type {VpoProcedure[]} */
export const PROCEDURES = [
  { id: 'gupta-anorectal', labelEn: 'Anorectal', guptaCoef: -0.16, ahaQuirurgico: 'Bajo', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-aortic', labelEn: 'Aortic', guptaCoef: 1.6, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'intrathoracic' },
  { id: 'gupta-bariatric', labelEn: 'Bariatric', guptaCoef: -0.25, ahaQuirurgico: 'Intermedio', rcriHighRisk: true, ariscatIncisionKey: 'upperAbdominal' },
  { id: 'gupta-brain', labelEn: 'Brain', guptaCoef: 1.4, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'intrathoracic' },
  { id: 'gupta-breast', labelEn: 'Breast', guptaCoef: -1.61, ahaQuirurgico: 'Bajo', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-cardiac', labelEn: 'Cardiac', guptaCoef: 1.01, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'intrathoracic' },
  { id: 'gupta-ent', labelEn: 'ENT (except thyroid/parathyroid)', guptaCoef: 0.71, ahaQuirurgico: 'Intermedio', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  {
    id: 'gupta-foregut-hpb',
    labelEn: 'Foregut / hepato-pancreatobiliary (except isolated cholecystectomy)',
    guptaCoef: 1.39,
    ahaQuirurgico: 'Alto',
    rcriHighRisk: true,
    ariscatIncisionKey: 'upperAbdominal',
  },
  {
    id: 'gupta-gallbladder-appendix',
    labelEn: 'Gallbladder / appendix / adrenals / spleen',
    guptaCoef: 0.59,
    ahaQuirurgico: 'Intermedio',
    rcriHighRisk: false,
    ariscatIncisionKey: 'upperAbdominal',
  },
  { id: 'gupta-hernia', labelEn: 'Hernia', guptaCoef: 0, ahaQuirurgico: 'Bajo', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-intestinal', labelEn: 'Intestinal below duodenum', guptaCoef: 1.14, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'upperAbdominal' },
  { id: 'gupta-neck-thyroid', labelEn: 'Neck incl. thyroid/parathyroid', guptaCoef: 0.18, ahaQuirurgico: 'Intermedio', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-ob-gyn', labelEn: 'Obstetric / gynecologic', guptaCoef: 0.76, ahaQuirurgico: 'Intermedio', rcriHighRisk: true, ariscatIncisionKey: 'upperAbdominal' },
  { id: 'gupta-orthopedic', labelEn: 'Orthopedic', guptaCoef: 0.8, ahaQuirurgico: 'Intermedio', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-abdomen-other', labelEn: 'Abdomen - other', guptaCoef: 1.13, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'upperAbdominal' },
  { id: 'gupta-peripheral-vascular', labelEn: 'Peripheral vascular', guptaCoef: 0.86, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-skin', labelEn: 'Skin', guptaCoef: 0.54, ahaQuirurgico: 'Bajo', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-spine', labelEn: 'Spine', guptaCoef: 0.21, ahaQuirurgico: 'Intermedio', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-thoracic', labelEn: 'Thoracic non-esophageal', guptaCoef: 0.4, ahaQuirurgico: 'Alto', rcriHighRisk: true, ariscatIncisionKey: 'intrathoracic' },
  { id: 'gupta-vein', labelEn: 'Vein', guptaCoef: -1.09, ahaQuirurgico: 'Bajo', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
  { id: 'gupta-urology', labelEn: 'Urology', guptaCoef: -0.26, ahaQuirurgico: 'Intermedio', rcriHighRisk: false, ariscatIncisionKey: 'peripheral' },
];

export const ARISCAT_INCISION_POINTS = {
  peripheral: 0,
  upperAbdominal: 15,
  intrathoracic: 24,
};

export const CREATININE_GUPTA = [
  { key: 'lte-1.5', max: 1.5, guptaCoef: 0 },
  { key: 'gt-1.5', max: Infinity, guptaCoef: 0.42 },
];

function normSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** @param {string} id */
export function getProcedureById(id) {
  return PROCEDURES.find((p) => p.id === id) || null;
}

/** @param {string} key */
export function getAsaByKey(key) {
  return ASA_OPTIONS.find((a) => a.key === key) || null;
}

/** @param {string} key */
export function getFunctionalByKey(key) {
  return FUNCTIONAL_STATUS.find((f) => f.key === key) || null;
}

/** @param {number} creatinina */
export function creatinineGuptaCoef(creatinina) {
  var cr = Number(creatinina);
  if (!Number.isFinite(cr)) return 0;
  return cr <= 1.5 ? 0 : 0.42;
}

/**
 * @param {string} q
 * @returns {VpoProcedure[]}
 */
export function searchProcedures(q, searchTextFn) {
  var n = normSearch(q).trim();
  if (!n) return PROCEDURES.slice();
  var textOf =
    typeof searchTextFn === 'function'
      ? searchTextFn
      : function (p) {
          return p.labelEn;
        };
  return PROCEDURES.filter(function (p) {
    return normSearch(textOf(p)).includes(n);
  });
}

/** Sugerir AHA clínico desde ASA. @param {string} asaKey */
export function suggestAhaClinicoFromAsa(asaKey) {
  var a = getAsaByKey(asaKey);
  if (!a) return '';
  if (a.asaClass === 'I' || a.asaClass === 'II') return 'Bajo';
  if (a.asaClass === 'III') return 'Intermedio';
  return 'Alto';
}
