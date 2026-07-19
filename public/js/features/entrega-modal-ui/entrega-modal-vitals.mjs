// Entrega vitals plan panel
import {
  defaultFrequencySpec,
  defaultVitalsPlan,
  normalizeFrequencySpec,
  normalizeUntilTime,
  normalizeVitalsPlan,
  vitalsPlanSummary,
} from '../../../../lib/entrega/entrega-vitals-plan.mjs';
import { entregaDraft } from './entrega-modal-state.mjs';
import { buildTimeSelectMarkup } from './entrega-modal-time.mjs';
import { buildVitalsPanelMarkup, wireVitalsPanelControls } from './entrega-modal-vitals-render.mjs';

function updateVitalsSummary() {
  const summary = document.getElementById('entrega-vitals-summary');
  if (summary) summary.textContent = vitalsPlanSummary(entregaDraft.vitalsPlan);
}

/** @param {Record<string, unknown>} patch */
function mergeIntervalFrequency(patch) {
  const cur = normalizeFrequencySpec(entregaDraft.vitalsPlan.frequency);
  const base = cur.mode === 'interval' ? cur : { mode: 'interval', hours: 2 };
  return normalizeFrequencySpec({ ...base, mode: 'interval', ...patch });
}

/** @param {string|null|undefined} hhmm @param {'interval'|'shift'} scope */
function buildVitalsUntilTimeMarkup(hhmm, scope) {
  const enabled = !!hhmm;
  return `
    <div class="entrega-freq-until">
      <label class="entrega-check-pill entrega-freq-until-toggle">
        <input type="checkbox" data-vitals-until-enable${enabled ? ' checked' : ''}>
        <span>Detener a las</span>
      </label>
      ${buildTimeSelectMarkup(hhmm || '07:00', {
        hourName: `entrega-vitals-until-hour-${scope}`,
        minuteName: `entrega-vitals-until-minute-${scope}`,
        ariaLabel: 'Hora de fin',
        allowBlank: false,
        picker: true,
        wrapperClass: `entrega-freq-until-time entrega-time-picker--compact${
          enabled ? '' : ' is-disabled'
        }`,
        disabled: !enabled,
      })}
    </div>`;
}

/** @param {ParentNode} host */
function activeVitalsFreqPanel(host) {
  return (
    host.querySelector('#entrega-freq-interval-panel:not(.is-hidden)') ||
    host.querySelector('#entrega-freq-shift-panel:not(.is-hidden)')
  );
}

/** @param {ParentNode} host */
function readVitalsUntilTimeFromHost(host) {
  const panel = activeVitalsFreqPanel(host);
  if (!panel) return null;
  if (!panel.querySelector('[data-vitals-until-enable]')?.checked) return null;
  const hour = String(
    panel.querySelector('[name^="entrega-vitals-until-hour"]')?.value || ''
  ).trim();
  const minute = String(
    panel.querySelector('[name^="entrega-vitals-until-minute"]')?.value || ''
  ).trim();
  if (!hour || !minute) return null;
  return normalizeUntilTime(`${hour}:${minute}`);
}

/** @param {HTMLElement} host @param {HTMLElement|null} panel */
function wireVitalsUntilPanel(host, panel) {
  if (!panel) return;
  const untilEnable = panel.querySelector('[data-vitals-until-enable]');
  const untilTimeWrap = panel.querySelector('.entrega-freq-until-time');
  const setUntilEnabled = (on) => {
    untilTimeWrap?.classList.toggle('is-disabled', !on);
    untilTimeWrap?.querySelectorAll('select').forEach((sel) => {
      sel.disabled = !on;
    });
    if (on) {
      const hSel = panel.querySelector('[name^="entrega-vitals-until-hour"]');
      const mSel = panel.querySelector('[name^="entrega-vitals-until-minute"]');
      if (hSel && !hSel.value) hSel.value = '07';
      if (mSel && !mSel.value) mSel.value = '00';
    }
    syncFrequencyDraftFromDom(host);
  };
  untilEnable?.addEventListener('change', () => setUntilEnabled(!!untilEnable.checked));
  untilTimeWrap?.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => syncFrequencyDraftFromDom(host));
  });
}

/** @param {HTMLElement} host */
function readFrequencyFromDom(host) {
  const mode = String(
    host.querySelector('input[name="entrega-freq-mode"]:checked')?.value || 'interval'
  );
  if (mode === 'routine') return defaultFrequencySpec();
  const untilTime = readVitalsUntilTimeFromHost(host);
  if (mode === 'shift') {
    const chip = host.querySelector('[data-freq-shift].is-selected');
    const times = Number(chip?.getAttribute('data-freq-shift') || 1);
    return normalizeFrequencySpec({
      mode: 'shift',
      timesPerShift: times,
      untilTime,
    });
  }
  const hours = Number(host.querySelector('#entrega-vitals-hours')?.value || 2);
  return normalizeFrequencySpec({
    mode: 'interval',
    hours,
    untilTime,
  });
}

/** @param {HTMLElement} host */
function syncFrequencyDraftFromDom(host) {
  entregaDraft.vitalsPlan = normalizeVitalsPlan({
    ...entregaDraft.vitalsPlan,
    frequency: readFrequencyFromDom(host),
  });
  updateVitalsSummary();
}

/** @param {HTMLElement} host */
function syncVitalsFreqUi(host) {
  const freq = normalizeFrequencySpec(entregaDraft.vitalsPlan.frequency);
  const mode = freq.mode;

  host.querySelectorAll('input[name="entrega-freq-mode"]').forEach((input) => {
    if (input instanceof HTMLInputElement) input.checked = input.value === mode;
  });

  host.querySelector('#entrega-freq-interval-panel')?.classList.toggle('is-hidden', mode !== 'interval');
  host.querySelector('#entrega-freq-shift-panel')?.classList.toggle('is-hidden', mode !== 'shift');
  host.querySelector('#entrega-freq-routine-hint')?.classList.toggle('is-hidden', mode !== 'routine');

  const slot = host.querySelector('.entrega-vitals-freq-detail-slot');
  slot?.setAttribute('aria-hidden', 'false');

  if (mode === 'interval') {
    const hours = freq.mode === 'interval' ? freq.hours ?? 2 : 2;
    const hoursInp = host.querySelector('#entrega-vitals-hours');
    if (hoursInp instanceof HTMLInputElement) hoursInp.value = String(hours);
    host.querySelectorAll('[data-freq-hours]').forEach((chip) => {
      chip.classList.toggle(
        'is-selected',
        Number(chip.getAttribute('data-freq-hours')) === hours
      );
    });
  }

  if (mode === 'shift') {
    const times = freq.mode === 'shift' ? freq.timesPerShift ?? 1 : 1;
    host.querySelectorAll('[data-freq-shift]').forEach((chip) => {
      chip.classList.toggle(
        'is-selected',
        Number(chip.getAttribute('data-freq-shift')) === times
      );
    });
  }

  updateVitalsSummary();
}

function renderVitalsPanel() {
  const host = document.getElementById('entrega-vitals-panel');
  if (!host) return;
  const plan = normalizeVitalsPlan(entregaDraft.vitalsPlan);
  entregaDraft.vitalsPlan = plan;
  host.innerHTML = buildVitalsPanelMarkup(plan, buildVitalsUntilTimeMarkup);
  wireVitalsPanelControls(host, {
    mergeIntervalFrequency,
    syncVitalsFreqUi,
    syncFrequencyDraftFromDom,
    updateVitalsSummary,
    wireVitalsUntilPanel,
  });
}

/** @returns {ReturnType<typeof defaultVitalsPlan>} */
export function readEntregaVitalsPlan() {
  const host = document.getElementById('entrega-vitals-panel');
  if (!host) return normalizeVitalsPlan(entregaDraft.vitalsPlan);
  const metrics = { ...entregaDraft.vitalsPlan.metrics };
  host.querySelectorAll('[data-vital-metric]').forEach((input) => {
    const key = input.getAttribute('data-vital-metric');
    if (key) metrics[key] = !!input.checked;
  });
  return normalizeVitalsPlan({ frequency: readFrequencyFromDom(host), metrics });
}

/**
 * @param {{ vitalsPlan?: object|null, vitalsFrequency?: string|null }} [opts]
 */
export function mountEntregaVitalsPanel(opts = {}) {
  if (opts.vitalsPlan) {
    entregaDraft.vitalsPlan = normalizeVitalsPlan(opts.vitalsPlan);
  } else if (opts.vitalsFrequency) {
    entregaDraft.vitalsPlan = normalizeVitalsPlan({
      ...defaultVitalsPlan(),
      frequency: normalizeFrequencySpec(opts.vitalsFrequency),
    });
  } else {
    entregaDraft.vitalsPlan = normalizeVitalsPlan({
      ...defaultVitalsPlan(),
      frequency: { mode: 'interval', hours: 2 },
    });
  }
  renderVitalsPanel();
}
