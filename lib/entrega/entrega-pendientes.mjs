import { defaultHandoffContext } from './entrega-handoff-context.mjs';
import { defaultVitalsPlan } from './entrega-vitals-plan.mjs';
import {
  emptyPendientesDoc,
  normalizePendientesLegacyArray,
  normalizePendientesV2,
} from './entrega-pendientes-parse.mjs';

function newItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * @param {object} partial
 */
export function createProcedimientoItem(partial) {
  const now = new Date().toISOString();
  return {
    id: newItemId(),
    type: 'procedimiento',
    kind: partial.kind === 'imagen' ? 'imagen' : 'otro',
    label: String(partial.label || '').trim(),
    scheduledAt: partial.scheduledAt || null,
    comentado: !!partial.comentado,
    autorizado: !!partial.autorizado,
    agendado: !!partial.agendado,
    requires: {
      familiar: !!partial.requires?.familiar,
      consentimiento: !!partial.requires?.consentimiento,
      anestesia: !!partial.requires?.anestesia,
    },
    lockedBase: !!partial.lockedBase,
    createdBy: partial.createdBy || null,
    updatedAt: now,
    completedAt: null,
    completedBy: null,
  };
}

/** @param {string|object|null|undefined} raw */
export function normalizePendientesJson(raw) {
  if (raw == null || raw === '') return emptyPendientesDoc();
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return emptyPendientesDoc();
  }
  if (parsed && parsed.version === 2 && Array.isArray(parsed.items)) {
    return normalizePendientesV2(parsed);
  }
  if (Array.isArray(parsed)) {
    return normalizePendientesLegacyArray(parsed);
  }
  return emptyPendientesDoc();
}

/** @param {object|null|undefined} patient */
export function buildEntregaPatientCensus(patient) {
  if (!patient || typeof patient !== 'object') return null;
  const nombre = String(patient.nombre || patient.name || '').trim();
  const cuarto = String(patient.cuarto || '').trim();
  const cama = String(patient.cama || '').trim();
  const sala = String(patient.sala || '').trim();
  if (!nombre && !cuarto && !cama) return null;
  return { nombre, cuarto, cama, sala };
}

/** @param {object} doc */
export function serializePendientesJson(doc) {
  return JSON.stringify(normalizePendientesJson(doc));
}

/** @param {object} doc */
export function listActiveProcedimientos(doc) {
  return normalizePendientesJson(doc).items.filter(
    (it) =>
      (it.type === 'procedimiento' || it.type === 'legacy_text') && !it.completedAt
  );
}

/** @param {object} item */
export function pendingRequirementBadges(item) {
  const badges = [];
  if (item.requires?.consentimiento && !item.autorizado) badges.push('consentimiento');
  if (item.requires?.anestesia && !item.agendado) badges.push('anestesia');
  if (item.requires?.familiar && !item.comentado) badges.push('familiar');
  return badges;
}

/** @param {object} item @param {{ role: 'diurno'|'guardia' }} actor */
export function canDeletePendienteItem(item, actor) {
  if (actor.role === 'diurno') return true;
  if (actor.role === 'guardia') return !item.lockedBase;
  return false;
}

/**
 * @param {object} doc
 * @param {string} itemId
 * @param {object|null|undefined} completedBy
 */
export function completePendienteItem(doc, itemId, completedBy) {
  const norm = normalizePendientesJson(doc);
  const items = norm.items.map((it) => {
    if (it.id !== itemId) return it;
    if (it.completedAt) return it;
    return {
      ...it,
      completedAt: new Date().toISOString(),
      completedBy: completedBy || { kind: 'interno' },
      updatedAt: new Date().toISOString(),
    };
  });
  return {
    version: 2,
    vitalsPlan: norm.vitalsPlan || defaultVitalsPlan(),
    handoffContext: norm.handoffContext || defaultHandoffContext(),
    items,
  };
}
