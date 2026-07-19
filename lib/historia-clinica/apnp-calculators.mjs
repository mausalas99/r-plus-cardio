import {
  GRAMS_ETHANOL_PER_DRINK,
  TOBACCO_INDEX_WARN,
  TOBACCO_INDEX_HIGH,
  ALCOHOL_GRAMS_WEEK_WARN,
  ALCOHOL_GRAMS_WEEK_HIGH,
  FREQ_PER_WEEK,
} from './apnp-calculators-constants.mjs';
import {
  computeTobaccoEffectiveYears,
  tobaccoIndexAlert,
  buildTobaccoSummary,
} from './apnp-tobacco-index.mjs';

export {
  GRAMS_ETHANOL_PER_DRINK,
  TOBACCO_INDEX_WARN,
  TOBACCO_INDEX_HIGH,
  ALCOHOL_GRAMS_WEEK_WARN,
  ALCOHOL_GRAMS_WEEK_HIGH,
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ status?: string, ageStarted?: number, cigarettesPerDay?: number, yearsSmoked?: number, ageStopped?: number, currentAge?: number }} input
 */
export function calcTobaccoIndex(input) {
  const status = input && input.status ? String(input.status) : 'negado';
  if (status === 'negado') {
    return {
      status: 'negado',
      summary: 'Negado',
      packYears: null,
      alert: null,
      copyLine: 'Tabaquismo: negado',
    };
  }

  const ageStarted = num(input.ageStarted);
  const cpd = num(input.cigarettesPerDay);
  const ageStopped = num(input.ageStopped);
  const effectiveYears = computeTobaccoEffectiveYears(input);

  if (cpd == null || effectiveYears == null || effectiveYears < 0) {
    return {
      status,
      summary: 'Incompleto',
      packYears: null,
      alert: null,
      copyLine: 'Tabaquismo: datos incompletos',
      effectiveYears: effectiveYears,
      cigarettesPerDay: cpd,
    };
  }

  const packYears = Math.round(((cpd / 20) * effectiveYears) * 10) / 10;
  const alert = tobaccoIndexAlert(packYears);
  const summary = buildTobaccoSummary(
    status,
    ageStarted,
    cpd,
    effectiveYears,
    packYears,
    ageStopped
  );

  return {
    status,
    summary,
    packYears,
    effectiveYears,
    cigarettesPerDay: cpd,
    ageStarted,
    ageStopped,
    alert,
    copyLine: 'Tabaquismo: ' + summary,
  };
}

/**
 * @param {{ status?: string, ageStarted?: number, drinksPerOccasion?: number, frequencyKind?: string, frequencyCount?: number }} input
 */
export function calcAlcoholBurden(input) {
  const status = input && input.status ? String(input.status) : 'negado';
  if (status === 'negado') {
    return {
      status: 'negado',
      summary: 'Negado',
      gramsPerWeek: null,
      gramsPerDay: null,
      alert: null,
      copyLine: 'Alcoholismo: negado',
    };
  }

  const drinks = num(input.drinksPerOccasion);
  const kind = String(input.frequencyKind || 'semana').toLowerCase();
  const count = num(input.frequencyCount) ?? 1;
  const ageStarted = num(input.ageStarted);

  const perWeekBase = FREQ_PER_WEEK[kind];
  if (drinks == null || perWeekBase == null) {
    return {
      status,
      summary: 'Incompleto',
      gramsPerWeek: null,
      alert: null,
      copyLine: 'Alcoholismo: datos incompletos',
    };
  }

  const occasionsPerWeek = kind === 'semana' || kind === 'weekly' ? count : perWeekBase * count;
  const gramsPerWeek = Math.round(drinks * GRAMS_ETHANOL_PER_DRINK * occasionsPerWeek);
  const gramsPerDay = Math.round((gramsPerWeek / 7) * 10) / 10;

  let alert = null;
  if (gramsPerWeek >= ALCOHOL_GRAMS_WEEK_HIGH) alert = 'high';
  else if (gramsPerWeek >= ALCOHOL_GRAMS_WEEK_WARN) alert = 'warn';

  let summary = 'Consumo';
  if (ageStarted != null) summary += ' desde los ' + ageStarted + ' años';
  summary +=
    ': ' +
    drinks +
    ' bebida(s) estándar, ' +
    formatFrequencyLabel(kind, count) +
    ' (~' +
    gramsPerWeek +
    ' g etanol/semana, ~' +
    gramsPerDay +
    ' g/día)';

  return {
    status,
    summary,
    gramsPerWeek,
    gramsPerDay,
    drinksPerOccasion: drinks,
    frequencyKind: kind,
    frequencyCount: count,
    ageStarted,
    alert,
    copyLine: 'Alcoholismo: ' + summary,
  };
}

function formatFrequencyLabel(kind, count) {
  if (kind === 'dia' || kind === 'daily') return count > 1 ? count + ' veces al día' : 'diario';
  if (kind === 'semana' || kind === 'weekly') {
    return count === 1 ? '1 vez por semana' : count + ' veces por semana';
  }
  if (kind === 'fin' || kind === 'weekend') return 'fines de semana';
  if (kind === 'mes' || kind === 'monthly') return 'mensual';
  return 'ocasional';
}

/**
 * @param {object} apnp
 * @param {{ currentAge?: number }} [ctx]
 */
export function summarizeApnpHabits(apnp, ctx) {
  apnp = apnp || {};
  const tab = calcTobaccoIndex(
    Object.assign({}, apnp.tabaquismoDetail || {}, {
      currentAge: ctx && ctx.currentAge != null ? ctx.currentAge : undefined,
    })
  );
  const alc = calcAlcoholBurden(apnp.alcoholismoDetail || {});
  return { tabaquismo: tab, alcoholismo: alc };
}
