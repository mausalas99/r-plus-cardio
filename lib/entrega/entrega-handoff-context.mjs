/** @typedef {'stable'|'unstable'|'critical'|'postop'|''} ClinicalStatus */

import {
  VASOPRESSOR_AGENTS,
  VASOPRESSOR_UNIT_LABELS,
  VASOPRESSOR_INFUSION_DEFAULTS,
  normalizeVasopressorAgent,
  defaultVasopressorInfusion,
  coerceVasopressorUnit,
  parseVasopressorRate,
  formatVasopressorInfusion,
} from './entrega-handoff-vasopressor-core.mjs';
import { normalizeVasopressor } from './entrega-handoff-vasopressor.mjs';

export {
  VASOPRESSOR_AGENTS,
  VASOPRESSOR_UNIT_LABELS,
  VASOPRESSOR_INFUSION_DEFAULTS,
  normalizeVasopressorAgent,
  defaultVasopressorInfusion,
  coerceVasopressorUnit,
  parseVasopressorRate,
  formatVasopressorInfusion,
  normalizeVasopressor,
};

export const CLINICAL_STATUS_OPTIONS = [
  { value: '', label: '— Seleccionar —' },
  { value: 'stable', label: 'Estable' },
  { value: 'unstable', label: 'Inestable' },
  { value: 'critical', label: 'Crítico / deterioro' },
  { value: 'postop', label: 'Postoperatorio inmediato' },
];

export const VENTILATION_MODES = [
  { value: '', label: '— Sin especificar —' },
  { value: 'room_air', label: 'Ambiente / cánula nasal' },
  { value: 'hfnc', label: 'Alto flujo (LAF)' },
  { value: 'niv', label: 'VMNI' },
  { value: 'invasive', label: 'VMI' },
  { value: 'other', label: 'Otro soporte' },
];

/** @returns {object} */
export function defaultHandoffContext() {
  const vaso = normalizeVasopressor({ active: false, agent: 'norepinefrina' });
  return {
    clinicalStatus: '',
    signedRefusal: false,
    show: false,
    vasopressor: vaso,
    ventilation: { active: false, mode: '', fio2: '', settings: '' },
    notes: '',
  };
}

/** @param {object} vent */
function normalizeVentilation(vent) {
  return {
    active: !!(vent.active || vent.mode || vent.fio2 || vent.settings),
    mode: String(vent.mode || '').trim(),
    fio2: String(vent.fio2 || '').trim(),
    settings: String(vent.settings || '').trim(),
  };
}

/**
 * @param {object|null|undefined} raw
 * @param {{ signedRefusal?: boolean }} [hints]
 */
export function normalizeHandoffContext(raw, hints = {}) {
  const base = defaultHandoffContext();
  if (!raw || typeof raw !== 'object') {
    if (hints.signedRefusal) base.signedRefusal = true;
    return base;
  }
  const vent = raw.ventilation && typeof raw.ventilation === 'object' ? raw.ventilation : {};
  const status = String(raw.clinicalStatus || '');
  const allowed = new Set(CLINICAL_STATUS_OPTIONS.map((o) => o.value));
  return {
    clinicalStatus: allowed.has(status) ? status : '',
    signedRefusal: !!(raw.signedRefusal ?? hints.signedRefusal),
    show: !!(raw.show ?? raw.shock),
    vasopressor: normalizeVasopressor(raw.vasopressor),
    ventilation: normalizeVentilation(vent),
    notes: String(raw.notes || '').trim(),
  };
}

/** @param {object} ctx */
export function handoffContextSummary(ctx) {
  const norm = normalizeHandoffContext(ctx);
  const parts = [];
  const statusLabel = CLINICAL_STATUS_OPTIONS.find((o) => o.value === norm.clinicalStatus)?.label;
  if (statusLabel && norm.clinicalStatus) parts.push(statusLabel);
  if (norm.signedRefusal) parts.push('Negativas firmadas');
  if (norm.show) parts.push('Show');
  if (norm.vasopressor.active) {
    const v = formatVasopressorInfusion(norm.vasopressor);
    parts.push(v ? `Vasopresor: ${v}` : 'Vasopresor');
  }
  if (norm.ventilation.active) {
    const modeLabel = VENTILATION_MODES.find((m) => m.value === norm.ventilation.mode)?.label;
    const v = [modeLabel, norm.ventilation.fio2 && `FiO₂ ${norm.ventilation.fio2}`]
      .filter(Boolean)
      .join(' · ');
    parts.push(v || 'Ventilación');
  }
  if (norm.notes) parts.push(norm.notes);
  return parts.length ? parts.join(' · ') : 'Sin resumen clínico';
}
