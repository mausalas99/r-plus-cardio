/** @typedef {'norepinefrina'|'vasopresina'|''} VasopressorAgent */
/** @typedef {'mcg_kg_min'|'mcg_min'|'ui_min'} VasopressorUnit */

export const VASOPRESSOR_AGENTS = [
  { value: 'norepinefrina', label: 'Norepinefrina', short: 'Nore' },
  { value: 'vasopresina', label: 'Vasopresina', short: 'Vasopresina' },
];

export const VASOPRESSOR_UNIT_LABELS = {
  mcg_kg_min: 'mcg/kg/min',
  mcg_min: 'mcg/min',
  ui_min: 'UI/min',
};

/** @type {Record<string, { dose: string, unit: VasopressorUnit }>} */
export const VASOPRESSOR_INFUSION_DEFAULTS = {
  norepinefrina: { dose: '0.05', unit: 'mcg_kg_min' },
  vasopresina: { dose: '0.03', unit: 'ui_min' },
};

const AGENT_ALIASES = {
  norepinefrina: 'norepinefrina',
  nore: 'norepinefrina',
  vasopresina: 'vasopresina',
};

/** @param {string} agent */
export function normalizeVasopressorAgent(agent) {
  const key = String(agent || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (key.includes('vasopres')) return 'vasopresina';
  if (key.includes('nore') || key.includes('levophed')) return 'norepinefrina';
  return AGENT_ALIASES[key] || '';
}

/** @param {VasopressorAgent} agent */
export function defaultVasopressorInfusion(agent) {
  const norm = normalizeVasopressorAgent(agent);
  return (
    VASOPRESSOR_INFUSION_DEFAULTS[norm] || {
      dose: '',
      unit: 'mcg_kg_min',
    }
  );
}

/** @param {VasopressorAgent} agent @param {VasopressorUnit} unit */
export function coerceVasopressorUnit(agent, unit) {
  const normAgent = normalizeVasopressorAgent(agent);
  if (normAgent === 'vasopresina') return 'ui_min';
  if (unit === 'mcg_min' || unit === 'mcg_kg_min') return unit;
  return 'mcg_kg_min';
}

/**
 * @param {string} rate
 * @returns {{ dose: string, unit: VasopressorUnit }}
 */
export function parseVasopressorRate(rate) {
  const raw = String(rate || '').trim();
  if (!raw) return { dose: '', unit: 'mcg_kg_min' };
  const ui = raw.match(/([\d.]+)\s*UI\s*\/\s*min/i);
  if (ui) return { dose: ui[1], unit: 'ui_min' };
  const perKg = raw.match(/([\d.]+)\s*mcg\s*\/\s*kg\s*\/\s*min/i);
  if (perKg) return { dose: perKg[1], unit: 'mcg_kg_min' };
  const perMin = raw.match(/([\d.]+)\s*mcg\s*\/\s*min/i);
  if (perMin) return { dose: perMin[1], unit: 'mcg_min' };
  const num = raw.match(/([\d.]+)/);
  return { dose: num ? num[1] : '', unit: 'mcg_kg_min' };
}

/** @param {object} vas */
export function formatVasopressorInfusion(vas) {
  const agent = normalizeVasopressorAgent(vas?.agent);
  const dose = String(vas?.dose || '').trim();
  const unit = coerceVasopressorUnit(agent, vas?.unit);
  if (!dose) return '';
  const agentLabel =
    VASOPRESSOR_AGENTS.find((a) => a.value === agent)?.short ||
    VASOPRESSOR_AGENTS.find((a) => a.value === agent)?.label ||
    '';
  const unitLabel = VASOPRESSOR_UNIT_LABELS[unit] || '';
  return [agentLabel, dose, unitLabel].filter(Boolean).join(' ');
}
