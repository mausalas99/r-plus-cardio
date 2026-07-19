export const ERC_CONDITION_ID = 'enfermedadRenal';

export const CKD_STAGES = [
  { id: '', label: '— Estadio —' },
  { id: 'g1', label: 'G1 (normal o alto)' },
  { id: 'g2', label: 'G2 (leve)' },
  { id: 'g3a', label: 'G3a (moderada A)' },
  { id: 'g3b', label: 'G3b (moderada B)' },
  { id: 'g4', label: 'G4 (severa)' },
  { id: 'g5', label: 'G5 (falla renal)' },
  { id: 'g5d', label: 'G5D (diálisis)' },
];


export function defaultErcDetail() {
  return {
    stage: '',
    diagnosis: '',
    treatment: '',
    diagnosedAt: null,
    medications: [],
  };
}

export function normalizeErcDetail(raw) {
  const base = defaultErcDetail();
  if (!raw || typeof raw !== 'object') return base;
  return {
    stage: raw.stage != null ? String(raw.stage) : '',
    diagnosis: raw.diagnosis != null ? String(raw.diagnosis) : '',
    treatment: raw.treatment != null ? String(raw.treatment) : '',
    diagnosedAt: raw.diagnosedAt || null,
    medications: Array.isArray(raw.medications)
      ? raw.medications.map(function (m) {
          return {
            id: m.id || 'erc_med_' + Math.random().toString(36).slice(2, 8),
            medication: m.medication != null ? String(m.medication) : '',
            route: m.route != null ? String(m.route) : '',
            dosage: m.dosage != null ? String(m.dosage) : '',
            frequency: m.frequency != null ? String(m.frequency) : '',
          };
        })
      : [],
  };
}

/**
 * Push ERC-linked rows into medicamentosActuales (replaces prior ERC-linked rows).
 * @param {object} app
 */
export function syncErcMedicationsToApp(app) {
  if (!app || typeof app !== 'object') return app;
  const hasErc = (app.conditions || []).indexOf(ERC_CONDITION_ID) >= 0;
  const det = normalizeErcDetail(app.conditionDetails && app.conditionDetails[ERC_CONDITION_ID]);

  app.medicamentosActuales = (app.medicamentosActuales || []).filter(function (m) {
    return m && m.linkedFrom !== ERC_CONDITION_ID;
  });

  if (!hasErc) {
    app.conditionDetails = app.conditionDetails || {};
    delete app.conditionDetails[ERC_CONDITION_ID];
    return app;
  }

  app.conditionDetails[ERC_CONDITION_ID] = det;

  det.medications.forEach(function (m) {
    if (!trim(m.medication)) return;
    app.medicamentosActuales.push({
      id: m.id,
      medication: m.medication,
      route: m.route || '',
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      linkedFrom: ERC_CONDITION_ID,
    });
  });

  return app;
}

export function purgeErcMedicationsFromApp(app) {
  if (!app || typeof app !== 'object') return app;
  app.medicamentosActuales = (app.medicamentosActuales || []).filter(function (m) {
    return m && m.linkedFrom !== ERC_CONDITION_ID;
  });
  if (app.conditionDetails && app.conditionDetails[ERC_CONDITION_ID]) {
    delete app.conditionDetails[ERC_CONDITION_ID];
  }
  return app;
}

/**
 * @param {object} d
 */
export function ckdStageLabel(stageId) {
  const hit = CKD_STAGES.find(function (s) {
    return s.id === stageId;
  });
  return hit && hit.id ? hit.label : stageId || '';
}

/**
 * @param {object} d
 * @param {(date: object) => string} [formatDate]
 */
export function formatErcConditionSuffix(d, formatDate) {
  d = normalizeErcDetail(d);
  const parts = [];
  if (d.stage) parts.push(ckdStageLabel(d.stage));
  if (formatDate && d.diagnosedAt) {
    const when = formatDate(d.diagnosedAt);
    if (when) parts.push('fecha dx ' + when);
  }
  if (trim(d.diagnosis)) parts.push(trim(d.diagnosis));
  if (trim(d.treatment)) parts.push('tto: ' + trim(d.treatment));
  return parts.length ? parts.join('; ') : '';
}

import { trim } from './string-util.mjs';