import {
  normalizeVasopressorAgent,
  defaultVasopressorInfusion,
  coerceVasopressorUnit,
  parseVasopressorRate,
  formatVasopressorInfusion,
} from './entrega-handoff-vasopressor-core.mjs';

/** @param {object|null|undefined} vas */
function isVasopressorActive(vas) {
  return vas != null && 'active' in vas
    ? !!vas.active
    : !!(vas?.agent || vas?.dose || vas?.rate);
}

/** @param {object|null|undefined} vas @param {string} agent */
function resolveVasopressorDose(vas, agent) {
  let dose = String(vas?.dose || '').trim();
  let unit = coerceVasopressorUnit(agent, vas?.unit);

  if (!dose && vas?.rate) {
    const parsed = parseVasopressorRate(vas.rate);
    dose = parsed.dose;
    if (!vas?.unit) unit = parsed.unit;
  }
  return { dose, unit };
}

/** @param {boolean} active @param {string} agent @param {string} dose */
function applyVasopressorDefaults(active, agent, dose) {
  let resolvedAgent = agent;
  let resolvedDose = dose;
  let unit = coerceVasopressorUnit(resolvedAgent, '');

  if (active && resolvedAgent && !resolvedDose) {
    const defaults = defaultVasopressorInfusion(resolvedAgent);
    resolvedDose = defaults.dose;
    unit = defaults.unit;
  }

  if (active && !resolvedAgent) {
    resolvedAgent = 'norepinefrina';
    const defaults = defaultVasopressorInfusion(resolvedAgent);
    if (!resolvedDose) resolvedDose = defaults.dose;
    unit = defaults.unit;
  }

  return { agent: resolvedAgent, dose: resolvedDose, unit };
}

/** @param {object|null|undefined} vas */
export function normalizeVasopressor(vas) {
  const active = isVasopressorActive(vas);
  let agent = normalizeVasopressorAgent(vas?.agent);
  const { dose: parsedDose, unit: parsedUnit } = resolveVasopressorDose(vas, agent);
  const defaults = applyVasopressorDefaults(active, agent, parsedDose);
  agent = defaults.agent;
  const dose = defaults.dose || parsedDose;
  const unit = coerceVasopressorUnit(agent, parsedUnit || defaults.unit);

  return {
    active,
    agent,
    dose,
    unit,
    rate: formatVasopressorInfusion({ agent, dose, unit }),
  };
}
