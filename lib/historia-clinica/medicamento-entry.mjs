import { toClinicalHistoryText } from './clinical-text.mjs';
import { trim } from './string-util.mjs';


function upperMed(s) {
  const t = trim(s);
  return t ? toClinicalHistoryText(t) : '';
}

export function newMedicamentoRowId(prefix) {
  return (
    (prefix || 'med') +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 6)
  );
}

/**
 * @param {unknown} raw
 * @returns {Array<{ id: string, medication: string, route: string, dosage: string, frequency: string, linkedFrom?: string }>}
 */
export function normalizeMedicamentosList(raw) {
  if (Array.isArray(raw)) {
    return raw
      .filter(function (m) {
        return m && typeof m === 'object';
      })
      .map(function (m) {
        return {
          id: m.id || newMedicamentoRowId('med'),
          medication: upperMed(m.medication),
          route: upperMed(m.route),
          dosage: upperMed(m.dosage),
          frequency: upperMed(m.frequency),
          linkedFrom: m.linkedFrom || undefined,
        };
      });
  }
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.medicamentos)) {
      return normalizeMedicamentosList(raw.medicamentos);
    }
    return [];
  }
  const legacy = trim(raw);
  if (!legacy) return [];
  return [
    {
      id: newMedicamentoRowId('med'),
      medication: legacy,
      route: '',
      dosage: '',
      frequency: '',
    },
  ];
}

/**
 * @param {{ medication?: string, route?: string, dosage?: string, frequency?: string }} m
 */
export function formatMedicamentoLine(m) {
  if (!m) return '';
  const name = trim(m.medication);
  if (!name) return '';
  const parts = [name];
  if (trim(m.route)) parts.push('vía ' + trim(m.route));
  if (trim(m.dosage)) parts.push(trim(m.dosage));
  if (trim(m.frequency)) parts.push(trim(m.frequency));
  return parts.join(', ');
}
