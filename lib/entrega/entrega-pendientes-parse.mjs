import { defaultVitalsPlan, normalizeVitalsPlan } from './entrega-vitals-plan.mjs';
import { defaultHandoffContext, normalizeHandoffContext } from './entrega-handoff-context.mjs';

function newItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** @returns {object} */
export function emptyPendientesDoc() {
  return {
    version: 2,
    vitalsPlan: defaultVitalsPlan(),
    handoffContext: defaultHandoffContext(),
    items: [],
  };
}

/**
 * @param {object} parsed
 * @returns {object}
 */
export function normalizePendientesV2(parsed) {
  const census =
    parsed.patientCensus && typeof parsed.patientCensus === 'object'
      ? {
          nombre: String(parsed.patientCensus.nombre || '').trim(),
          cuarto: String(parsed.patientCensus.cuarto || '').trim(),
          cama: String(parsed.patientCensus.cama || '').trim(),
          sala: String(parsed.patientCensus.sala || '').trim(),
        }
      : null;
  return {
    version: 2,
    vitalsPlan: normalizeVitalsPlan(parsed.vitalsPlan),
    handoffContext: normalizeHandoffContext(parsed.handoffContext),
    ...(census && (census.nombre || census.cuarto || census.cama)
      ? { patientCensus: census }
      : {}),
    items: parsed.items.filter(Boolean),
  };
}

/**
 * @param {unknown[]} lines
 * @returns {object}
 */
export function normalizePendientesLegacyArray(lines) {
  return {
    version: 2,
    vitalsPlan: defaultVitalsPlan(),
    handoffContext: defaultHandoffContext(),
    items: lines
      .map((line) => String(line).trim())
      .filter(Boolean)
      .map((text) => ({
        id: newItemId(),
        type: 'legacy_text',
        text,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      })),
  };
}
