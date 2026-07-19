import { TOBACCO_INDEX_WARN, TOBACCO_INDEX_HIGH } from './apnp-calculators-constants.mjs';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ status?: string, ageStarted?: number, cigarettesPerDay?: number, yearsSmoked?: number, ageStopped?: number, currentAge?: number }} input
 */
export function computeTobaccoEffectiveYears(input) {
  const status = input && input.status ? String(input.status) : 'negado';
  const ageStarted = num(input.ageStarted);
  const yearsSmoked = num(input.yearsSmoked);
  const ageStopped = num(input.ageStopped);
  const currentAge = num(input.currentAge);

  if (status === 'exfumador' && ageStarted != null && ageStopped != null && ageStopped > ageStarted) {
    return ageStopped - ageStarted;
  }
  if (yearsSmoked != null) return yearsSmoked;
  if (ageStarted == null || currentAge == null || currentAge <= ageStarted) return null;
  if (status === 'exfumador' && ageStopped != null) {
    return Math.max(0, ageStopped - ageStarted);
  }
  if (status === 'activo') return currentAge - ageStarted;
  return null;
}

/**
 * @param {number|null} packYears
 * @returns {'high'|'warn'|null}
 */
export function tobaccoIndexAlert(packYears) {
  if (packYears == null) return null;
  if (packYears >= TOBACCO_INDEX_HIGH) return 'high';
  if (packYears >= TOBACCO_INDEX_WARN) return 'warn';
  return null;
}

/**
 * @param {string} status
 * @param {number|null} ageStarted
 * @param {number} cpd
 * @param {number} effectiveYears
 * @param {number} packYears
 * @param {number|null} ageStopped
 */
export function buildTobaccoSummary(status, ageStarted, cpd, effectiveYears, packYears, ageStopped) {
  const statusLabel =
    status === 'exfumador' ? 'Exfumador' : status === 'activo' ? 'Activo' : status;
  let summary =
    statusLabel +
    ': inicio ' +
    (ageStarted != null ? ageStarted + ' años' : '—') +
    ', ' +
    cpd +
    ' cig/día, ' +
    effectiveYears +
    ' años efectivos';
  summary += '. Índice tabáquico ' + packYears + ' paquetes-año';
  if (status === 'exfumador' && ageStopped != null) {
    summary += ' (dejó a los ' + ageStopped + ' años)';
  }
  return summary;
}
