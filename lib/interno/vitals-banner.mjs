import {
  frequencyDisplayLabel,
  frequencyIntervalMs,
  isVitalsFrequencyPaused,
  normalizeFrequencySpec,
} from '../entrega/entrega-vitals-plan.mjs';

/**
 * @param {string|Date|undefined|null} last
 * @param {import('../entrega/entrega-vitals-plan.mjs').VitalsFrequencySpec|unknown} frequencySpec
 */
export function calcVitalsBannerForSpec(last, frequencySpec) {
  const spec = normalizeFrequencySpec(frequencySpec);
  const label = frequencyDisplayLabel(spec);

  if (isVitalsFrequencyPaused(spec)) {
    return { str: label, cls: 'nominal-gray' };
  }

  const ms = frequencyIntervalMs(spec);
  if (!ms) {
    return { str: label, cls: 'nominal-gray' };
  }

  const due = new Date(last || Date.now()).getTime() + ms;
  const diff = due - Date.now();
  if (diff <= 0) return { str: 'Signos vencidos', cls: 'breached' };
  const mins = Math.floor(diff / 60000);
  if (mins <= 15) {
    return { str: `Toca en: ${mins} min`, cls: 'warning' };
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { str: `Toca en: ${h}h ${m}m`, cls: 'nominal' };
}

/**
 * @param {string|Date|undefined|null} last
 * @param {string|undefined|null} freq Legacy DB enum
 * @param {string} [freeTextLabel]
 */
export function calcVitalsBanner(last, freq, freeTextLabel = '') {
  const label = String(freeTextLabel || '').trim();
  if (label && (!freq || freq === 'None')) {
    return calcVitalsBannerForSpec(last, normalizeFrequencySpec(label));
  }
  return calcVitalsBannerForSpec(last, normalizeFrequencySpec(freq));
}
