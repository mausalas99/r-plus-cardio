import {
  VITALS_FREQ_HOUR_PRESETS,
  VITALS_FREQ_SHIFT_OPTIONS,
  VITALS_METRIC_KEYS,
  VITALS_METRIC_LABELS,
  defaultFrequencySpec,
  normalizeFrequencySpec,
  normalizeVitalsPlan,
  vitalsPlanSummary,
} from '../../../../lib/entrega/entrega-vitals-plan.mjs';
import { entregaDraft } from './entrega-modal-state.mjs';

/** @param {(hhmm: string|null|undefined, scope: 'interval'|'shift') => string} buildUntilMarkup @param {string} uiMode @param {object} freq */
function buildVitalsFreqPanelsMarkup(buildUntilMarkup, uiMode, freq) {
  const hourChips = VITALS_FREQ_HOUR_PRESETS.map(
    (h) =>
      `<button type="button" class="entrega-freq-chip${
        freq.mode === 'interval' && freq.hours === h ? ' is-selected' : ''
      }" data-freq-hours="${h}">${h} h</button>`
  ).join('');
  const shiftChips = VITALS_FREQ_SHIFT_OPTIONS.map(
    (t) =>
      `<button type="button" class="entrega-freq-chip${
        freq.mode === 'shift' && freq.timesPerShift === t ? ' is-selected' : ''
      }" data-freq-shift="${t}">${t}×</button>`
  ).join('');
  const hoursVal = freq.mode === 'interval' ? freq.hours ?? 2 : 2;
  const untilInterval = buildUntilMarkup(freq.mode === 'interval' ? freq.untilTime : null, 'interval');
  const untilShift = buildUntilMarkup(freq.mode === 'shift' ? freq.untilTime : null, 'shift');
  return `<div class="entrega-vitals-freq-detail-slot" aria-hidden="false">
              <div class="entrega-freq-panel${uiMode === 'interval' ? '' : ' is-hidden'}" id="entrega-freq-interval-panel">
                <div class="entrega-freq-detail-card">
                  <div class="entrega-freq-detail__row">
                    <span class="entrega-freq-detail__row-label">Atajos</span>
                    <div class="entrega-freq-chips" role="group" aria-label="Atajos cada N horas">${hourChips}</div>
                  </div>
                  <div class="entrega-freq-detail__row-split">
                    <div class="entrega-freq-detail__cell">
                      <span class="entrega-freq-detail__cell-label">Cada</span>
                      <div class="entrega-freq-stepper" role="group" aria-label="Intervalo en horas">
                        <button type="button" class="entrega-freq-step" data-hours-dec aria-label="Menos horas">−</button>
                        <input type="number" id="entrega-vitals-hours" class="entrega-freq-hours-input" min="1" max="24" step="1" inputmode="numeric" value="${hoursVal}" aria-label="Cada cuántas horas">
                        <button type="button" class="entrega-freq-step" data-hours-inc aria-label="Más horas">+</button>
                      </div>
                      <span class="entrega-freq-interval-suffix">horas</span>
                    </div>
                    <div class="entrega-freq-detail__cell entrega-freq-detail__cell--until">${untilInterval}</div>
                  </div>
                </div>
              </div>
              <div class="entrega-freq-panel${uiMode === 'shift' ? '' : ' is-hidden'}" id="entrega-freq-shift-panel">
                <div class="entrega-freq-detail-card">
                  <div class="entrega-freq-detail__row">
                    <span class="entrega-freq-detail__row-label">Veces</span>
                    <div class="entrega-freq-chips" role="group" aria-label="Veces por turno">${shiftChips}</div>
                  </div>
                  <div class="entrega-freq-detail__row">
                    <span class="entrega-freq-detail__row-label">Fin</span>
                    <div class="entrega-freq-detail__cell entrega-freq-detail__cell--until">${untilShift}</div>
                  </div>
                </div>
              </div>
              <p class="entrega-freq-routine-hint is-hidden" id="entrega-freq-routine-hint">No aparece en internos para signos vitales. Si agregas un estudio pendiente, sí se listará ahí.</p>
            </div>`;
}

/** @param {ReturnType<typeof normalizeVitalsPlan>} plan @param {(hhmm: string|null|undefined, scope: 'interval'|'shift') => string} buildUntilMarkup */

import { escapeHtml } from '../../dom-escape.mjs';
export function buildVitalsPanelMarkup(plan, buildUntilMarkup) {
  const freq = plan.frequency;
  const metricChecks = VITALS_METRIC_KEYS.map(
    (key) =>
      `<label class="entrega-check-pill"><input type="checkbox" data-vital-metric="${key}" ${
        plan.metrics[key] ? 'checked' : ''
      }><span>${escapeHtml(VITALS_METRIC_LABELS[key])}</span></label>`
  ).join('');
  const uiMode =
    freq.mode === 'shift' ? 'shift' : freq.mode === 'routine' ? 'routine' : 'interval';
  const modeLabels = { interval: 'Intervalo', shift: 'Por turno', routine: 'Sin signos' };
  const modePills = (['interval', 'shift', 'routine'])
    .map(
      (mode) =>
        `<label class="entrega-check-pill entrega-freq-mode-pill">
          <input type="radio" name="entrega-freq-mode" value="${mode}" ${
            uiMode === mode ? 'checked' : ''
          }>
          <span>${modeLabels[mode]}</span>
        </label>`
    )
    .join('');
  const freqPanels = buildVitalsFreqPanelsMarkup(buildUntilMarkup, uiMode, freq);

  return `<div class="entrega-vitals-form">
      <div class="entrega-vitals-form__scroll">
        <section class="entrega-vitals-section" aria-labelledby="entrega-vitals-metrics-label">
          <span class="entrega-field-label" id="entrega-vitals-metrics-label">Parámetros</span>
          <div class="entrega-check-pills entrega-vitals-metrics" role="group" aria-labelledby="entrega-vitals-metrics-label">${metricChecks}</div>
        </section>
        <section class="entrega-vitals-section" aria-labelledby="entrega-vitals-freq-label">
          <span class="entrega-field-label" id="entrega-vitals-freq-label">Frecuencia</span>
          <div class="entrega-vitals-freq" role="group" aria-labelledby="entrega-vitals-freq-label">
            <div class="entrega-freq-segment entrega-check-pills entrega-freq-modes" role="radiogroup" aria-label="Modo de frecuencia">${modePills}</div>
            ${freqPanels}
          </div>
        </section>
      </div>
      <p class="entrega-vitals-summary" id="entrega-vitals-summary" role="status">${escapeHtml(vitalsPlanSummary(plan))}</p>
    </div>`;
}

/** @param {HTMLElement} host @param {{ mergeIntervalFrequency: Function, syncVitalsFreqUi: Function, syncFrequencyDraftFromDom: Function, updateVitalsSummary: Function, wireVitalsUntilPanel: Function }} api */
export function wireVitalsPanelControls(host, api) {
  host.querySelectorAll('[data-vital-metric]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.getAttribute('data-vital-metric');
      if (!key) return;
      entregaDraft.vitalsPlan = normalizeVitalsPlan({
        ...entregaDraft.vitalsPlan,
        metrics: { ...entregaDraft.vitalsPlan.metrics, [key]: input.checked },
      });
      api.updateVitalsSummary();
    });
  });

  host.querySelectorAll('input[name="entrega-freq-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      const mode = String(input.value || 'interval');
      if (mode === 'routine') {
        entregaDraft.vitalsPlan = normalizeVitalsPlan({
          ...entregaDraft.vitalsPlan,
          frequency: defaultFrequencySpec(),
        });
      } else if (mode === 'shift') {
        const cur = normalizeFrequencySpec(entregaDraft.vitalsPlan.frequency);
        entregaDraft.vitalsPlan = normalizeVitalsPlan({
          ...entregaDraft.vitalsPlan,
          frequency: normalizeFrequencySpec({ mode: 'shift', timesPerShift: 1, untilTime: cur.untilTime }),
        });
      } else {
        entregaDraft.vitalsPlan = normalizeVitalsPlan({
          ...entregaDraft.vitalsPlan,
          frequency: api.mergeIntervalFrequency({ hours: 2 }),
        });
      }
      api.syncVitalsFreqUi(host);
    });
  });

  host.querySelectorAll('[data-freq-hours]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hours = Number(btn.getAttribute('data-freq-hours') || 2);
      entregaDraft.vitalsPlan = normalizeVitalsPlan({
        ...entregaDraft.vitalsPlan,
        frequency: api.mergeIntervalFrequency({ hours }),
      });
      api.syncVitalsFreqUi(host);
    });
  });

  host.querySelectorAll('[data-freq-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const timesPerShift = Number(btn.getAttribute('data-freq-shift') || 1);
      const cur = normalizeFrequencySpec(entregaDraft.vitalsPlan.frequency);
      entregaDraft.vitalsPlan = normalizeVitalsPlan({
        ...entregaDraft.vitalsPlan,
        frequency: normalizeFrequencySpec({ mode: 'shift', timesPerShift, untilTime: cur.untilTime }),
      });
      api.syncVitalsFreqUi(host);
    });
  });

  api.wireVitalsUntilPanel(host, host.querySelector('#entrega-freq-interval-panel'));
  api.wireVitalsUntilPanel(host, host.querySelector('#entrega-freq-shift-panel'));

  const hoursInp = host.querySelector('#entrega-vitals-hours');
  const bumpHours = (delta) => {
    const cur = Number(hoursInp?.value || 2);
    const next = Math.min(24, Math.max(1, cur + delta));
    if (hoursInp) hoursInp.value = String(next);
    entregaDraft.vitalsPlan = normalizeVitalsPlan({
      ...entregaDraft.vitalsPlan,
      frequency: api.mergeIntervalFrequency({ hours: next }),
    });
    host.querySelectorAll('[data-freq-hours]').forEach((chip) => {
      chip.classList.toggle('is-selected', Number(chip.getAttribute('data-freq-hours')) === next);
    });
    api.updateVitalsSummary();
  };

  host.querySelector('[data-hours-dec]')?.addEventListener('click', () => bumpHours(-1));
  host.querySelector('[data-hours-inc]')?.addEventListener('click', () => bumpHours(1));
  hoursInp?.addEventListener('change', () => api.syncFrequencyDraftFromDom(host));
  hoursInp?.addEventListener('input', () => api.syncFrequencyDraftFromDom(host));
}
