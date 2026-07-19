import { escapeHtml } from '../../dom-escape.mjs';
// Entrega handoff context panel
import { CLINICAL_STATUS_OPTIONS, VASOPRESSOR_AGENTS, VASOPRESSOR_INFUSION_DEFAULTS, VASOPRESSOR_UNIT_LABELS, VENTILATION_MODES, coerceVasopressorUnit, handoffContextSummary, normalizeHandoffContext, normalizeVasopressorAgent, defaultVasopressorInfusion } from '../../../../lib/entrega/entrega-handoff-context.mjs';
import { entregaDraft, entregaUiFlags } from './entrega-modal-state.mjs';

export function checkPill(name, label, checked, extraClass = '', inputId = '') {
  const cls = ['entrega-check-pill', extraClass].filter(Boolean).join(' ');
  const idAttr = inputId ? ` id="${escapeHtml(inputId)}"` : '';
  return `<label class="${cls}">
    <input type="checkbox" name="${name}"${idAttr} ${checked ? 'checked' : ''}>
    <span>${escapeHtml(label)}</span>
  </label>`;
}
function updateHandoffSummaryLine() {
  const text = handoffContextSummary(entregaDraft.handoffContext);
  const summary = document.getElementById('entrega-handoff-summary');
  const display = text === 'Sin resumen clínico' ? '' : text;
  if (summary) summary.textContent = display;
}

function syncHandoffSupportCards(host) {
  const vasoOn = !!host.querySelector('[name="entrega-vaso-active"]')?.checked;
  const ventOn = !!host.querySelector('[name="entrega-vent-active"]')?.checked;
  host.querySelector('[data-handoff-card="vasopressor"]')?.classList.toggle('is-active', vasoOn);
  host.querySelector('[data-handoff-card="ventilation"]')?.classList.toggle('is-active', ventOn);
  host.querySelector('[data-handoff-detail="vasopressor"]')?.classList.toggle('is-hidden', !vasoOn);
  host.querySelector('[data-handoff-detail="ventilation"]')?.classList.toggle('is-hidden', !ventOn);
}

/** @param {HTMLElement} host */
function readVasoUnitFromDom(host) {
  const agent = normalizeVasopressorAgent(
    host.querySelector('#entrega-vaso-agent')?.value || ''
  );
  if (agent === 'vasopresina') return 'ui_min';
  const selected = host.querySelector('[data-vaso-unit].is-selected');
  const unit = selected?.getAttribute('data-vaso-unit');
  if (unit === 'mcg_min' || unit === 'mcg_kg_min') return unit;
  return 'mcg_kg_min';
}

/** @param {HTMLElement} host @param {string} unit */
function syncVasoUnitUi(host, unit) {
  const agent = normalizeVasopressorAgent(
    host.querySelector('#entrega-vaso-agent')?.value || ''
  );
  const coerced = coerceVasopressorUnit(agent, unit);
  const chipsRow = host.querySelector('[data-vaso-unit-chips]');
  const fixedRow = host.querySelector('[data-vaso-unit-fixed]');
  const isVaso = agent === 'vasopresina';

  chipsRow?.classList.toggle('is-hidden', isVaso);
  fixedRow?.classList.toggle('is-hidden', !isVaso);

  host.querySelectorAll('[data-vaso-unit]').forEach((btn) => {
    const u = btn.getAttribute('data-vaso-unit');
    btn.classList.toggle('is-selected', !isVaso && u === coerced);
  });
}

/** @param {HTMLElement} host @param {{ applyDefaults?: boolean }} [opts] */
function applyVasoAgentDefaults(host, opts = {}) {
  const agent = normalizeVasopressorAgent(
    host.querySelector('#entrega-vaso-agent')?.value || 'norepinefrina'
  );
  const doseInp = host.querySelector('#entrega-vaso-dose');
  const defaults = defaultVasopressorInfusion(agent);
  if (opts.applyDefaults || !String(doseInp?.value || '').trim()) {
    if (doseInp) doseInp.value = defaults.dose;
  }
  syncVasoUnitUi(host, defaults.unit);
}

function buildVasoDoseMarkup(vas) {
  const agent = normalizeVasopressorAgent(vas.agent) || 'norepinefrina';
  const unit = coerceVasopressorUnit(agent, vas.unit);
  const dose = String(vas.dose || defaultVasopressorInfusion(agent).dose);
  const agentOpts = VASOPRESSOR_AGENTS.map(
    (a) =>
      `<option value="${escapeHtml(a.value)}"${
        a.value === agent ? ' selected' : ''
      }>${escapeHtml(a.label)}</option>`
  ).join('');
  const unitChips = ['mcg_kg_min', 'mcg_min']
    .map((u) => {
      const label = VASOPRESSOR_UNIT_LABELS[u];
      return `<button type="button" class="entrega-freq-chip entrega-vaso-unit-pill${
        unit === u && agent !== 'vasopresina' ? ' is-selected' : ''
      }" data-vaso-unit="${u}">${escapeHtml(label)}</button>`;
    })
    .join('');
  const isVaso = agent === 'vasopresina';

  return `
    <div class="entrega-vaso-dose">
      <div class="field-group">
        <label for="entrega-vaso-agent">Agente</label>
        <select id="entrega-vaso-agent" class="profile-input">${agentOpts}</select>
      </div>
      <div class="field-group entrega-vaso-dose-row">
        <label for="entrega-vaso-dose">Infusión</label>
        <div class="entrega-vaso-dose-input-wrap">
          <input id="entrega-vaso-dose" class="profile-input entrega-vaso-dose-input" type="number"
            inputmode="decimal" step="0.01" min="0" placeholder="${escapeHtml(
              VASOPRESSOR_INFUSION_DEFAULTS[agent]?.dose || '0.05'
            )}" value="${escapeHtml(dose)}">
          <div class="entrega-vaso-unit-inline" role="group" aria-label="Unidad de infusión">
            <div class="entrega-vaso-unit-chips${
              isVaso ? ' is-hidden' : ''
            }" data-vaso-unit-chips>${unitChips}</div>
            <span class="entrega-vaso-unit-pill-fixed${
              isVaso ? '' : ' is-hidden'
            }" data-vaso-unit-fixed>${escapeHtml(VASOPRESSOR_UNIT_LABELS.ui_min)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

/** @param {HTMLElement} host */
function readHandoffSupportFromDom(host) {
  return {
    vasopressor: {
      active: !!host.querySelector('[name="entrega-vaso-active"]')?.checked,
      agent: normalizeVasopressorAgent(host.querySelector('#entrega-vaso-agent')?.value || ''),
      dose: String(host.querySelector('#entrega-vaso-dose')?.value || '').trim(),
      unit: readVasoUnitFromDom(host),
    },
    ventilation: {
      active: !!host.querySelector('[name="entrega-vent-active"]')?.checked,
      mode: String(host.querySelector('#entrega-vent-mode')?.value || '').trim(),
      fio2: String(host.querySelector('#entrega-vent-fio2')?.value || '').trim(),
      settings: String(host.querySelector('#entrega-vent-settings')?.value || '').trim(),
    },
  };
}

/** @param {HTMLElement} host */
function readHandoffFieldsFromDom(host) {
  const support = readHandoffSupportFromDom(host);
  return {
    clinicalStatus: String(host.querySelector('#entrega-clinical-status')?.value || ''),
    signedRefusal: !!host.querySelector('#entrega-signed-refusal')?.checked,
    show: !!host.querySelector('#entrega-show')?.checked,
    ...support,
    notes: String(host.querySelector('#entrega-handoff-notes')?.value || '').trim(),
  };
}

/** @param {HTMLElement} host */
function syncHandoffDraftFromDom(host) {
  entregaDraft.handoffContext = normalizeHandoffContext(readHandoffFieldsFromDom(host));
  syncHandoffSupportCards(host);
  updateHandoffSummaryLine();
}

function buildClinicalStatusMarkup(ctx) {
  const norm = normalizeHandoffContext(ctx);
  const statusOpts = CLINICAL_STATUS_OPTIONS.map(
    (o) =>
      `<option value="${escapeHtml(o.value)}"${
        o.value === norm.clinicalStatus ? ' selected' : ''
      }>${escapeHtml(o.label)}</option>`
  ).join('');
  return `
    <label for="entrega-clinical-status">Estado general</label>
    <select id="entrega-clinical-status" class="profile-input">${statusOpts}</select>`;
}

function buildHandoffPanelMarkup(ctx, isCritical) {
  const norm = normalizeHandoffContext(ctx);
  const ventModes = VENTILATION_MODES.map(
    (m) =>
      `<option value="${escapeHtml(m.value)}"${
        m.value === norm.ventilation.mode ? ' selected' : ''
      }>${escapeHtml(m.label)}</option>`
  ).join('');

  return `
    <div class="entrega-markers-block">
      <span class="entrega-field-label">Marcadores</span>
      <div class="entrega-check-pills entrega-markers-pills">
        ${checkPill('entrega-critical', 'Paciente crítico', isCritical, 'entrega-check-pill--alert', 'entrega-critical')}
        ${checkPill('entrega-signed-refusal', 'Negativas firmadas', norm.signedRefusal, 'entrega-check-pill--alert', 'entrega-signed-refusal')}
        ${checkPill('entrega-show', 'Show', norm.show, 'entrega-check-pill--alert', 'entrega-show')}
      </div>
    </div>
    <div class="entrega-section-divider" aria-hidden="true">Soporte · Signos vitales</div>
    <div class="entrega-middle-row">
      <div class="entrega-support-stack">
        <div class="entrega-handoff-support-card${
          norm.vasopressor.active ? ' is-active' : ''
        }" data-handoff-card="vasopressor">
          <div class="entrega-handoff-support-card__head">
            ${checkPill('entrega-vaso-active', 'Vasopresor', norm.vasopressor.active)}
          </div>
          <div class="entrega-handoff-support-detail${
            norm.vasopressor.active ? '' : ' is-hidden'
          }" data-handoff-detail="vasopressor">
            ${buildVasoDoseMarkup(norm.vasopressor)}
          </div>
        </div>
        <div class="entrega-handoff-support-card${
          norm.ventilation.active ? ' is-active' : ''
        }" data-handoff-card="ventilation">
          <div class="entrega-handoff-support-card__head">
            ${checkPill('entrega-vent-active', 'Ventilación / soporte resp.', norm.ventilation.active)}
          </div>
          <div class="entrega-handoff-support-detail${
            norm.ventilation.active ? '' : ' is-hidden'
          }" data-handoff-detail="ventilation">
            <div class="field-group">
              <label for="entrega-vent-mode">Modalidad</label>
              <select id="entrega-vent-mode" class="profile-input">${ventModes}</select>
            </div>
            <div class="field-group">
              <label for="entrega-vent-fio2">FiO₂ / flujo</label>
              <input id="entrega-vent-fio2" class="profile-input" type="text" placeholder="ej. 40% · 50 L/min" value="${escapeHtml(norm.ventilation.fio2)}">
            </div>
            <div class="field-group">
              <label for="entrega-vent-settings">Parámetros</label>
              <input id="entrega-vent-settings" class="profile-input" type="text" placeholder="PEEP, VT, presiones…" value="${escapeHtml(norm.ventilation.settings)}">
            </div>
          </div>
        </div>
      </div>
      <div class="entrega-vitals-col" aria-label="Signos vitales en guardia">
        <div id="entrega-vitals-panel" class="entrega-vitals-panel"></div>
      </div>
    </div>
    <div class="field-group entrega-handoff-notes">
      <label for="entrega-handoff-notes">Notas breves de entrega</label>
      <textarea id="entrega-handoff-notes" class="profile-input entrega-handoff-notes-input" maxlength="240" rows="2" placeholder="Antecedentes relevantes para la guardia…">${escapeHtml(norm.notes)}</textarea>
    </div>`;
}

function handoffDomRoot() {
  return document.getElementById('entrega-form') || document.getElementById('entrega-modal');
}

function wireHandoffPanelOnce() {
  if (entregaUiFlags.handoffWired) return;
  const root = handoffDomRoot();
  if (!root) return;
  entregaUiFlags.handoffWired = true;

  root.addEventListener('change', (ev) => {
    if (!ev.target?.closest('#entrega-handoff-panel, #entrega-clinical-status-slot')) return;
    const host = handoffDomRoot();
    if (!host) return;
    if (ev.target?.id === 'entrega-vaso-agent') {
      applyVasoAgentDefaults(host, { applyDefaults: true });
    }
    if (ev.target?.name === 'entrega-vaso-active' && ev.target.checked) {
      applyVasoAgentDefaults(host, { applyDefaults: true });
    }
    syncHandoffDraftFromDom(host);
  });

  root.addEventListener('input', (ev) => {
    if (!ev.target?.closest('#entrega-handoff-panel, #entrega-clinical-status-slot')) return;
    syncHandoffDraftFromDom(handoffDomRoot());
  });

  root.addEventListener('click', (ev) => {
    const unitBtn = ev.target.closest('[data-vaso-unit]');
    if (!unitBtn || unitBtn.classList.contains('is-hidden')) return;
    const host = handoffDomRoot();
    if (!host) return;
    host.querySelectorAll('[data-vaso-unit]').forEach((btn) => {
      btn.classList.toggle('is-selected', btn === unitBtn);
    });
    syncVasoUnitUi(host, unitBtn.getAttribute('data-vaso-unit') || 'mcg_kg_min');
    syncHandoffDraftFromDom(host);
  });
}

/**
 * @param {object|null|undefined} handoffContext
 * @param {{ isCritical?: boolean, signedRefusal?: boolean }} [opts]
 */
export function mountEntregaHandoffPanel(handoffContext, opts = {}) {
  wireHandoffPanelOnce();
  entregaDraft.handoffContext = normalizeHandoffContext(handoffContext, {
    signedRefusal: !!opts.signedRefusal,
  });
  const statusSlot = document.getElementById('entrega-clinical-status-slot');
  if (statusSlot) statusSlot.innerHTML = buildClinicalStatusMarkup(entregaDraft.handoffContext);
  const host = document.getElementById('entrega-handoff-panel');
  if (!host) return;
  host.innerHTML = buildHandoffPanelMarkup(entregaDraft.handoffContext, !!opts.isCritical);
  const domRoot = handoffDomRoot() || host;
  syncHandoffSupportCards(domRoot);
  applyVasoAgentDefaults(domRoot);
  updateHandoffSummaryLine();
}

/** @returns {ReturnType<typeof defaultHandoffContext>} */
export function readEntregaHandoffContext() {
  const host = handoffDomRoot();
  if (host?.querySelector('#entrega-handoff-panel')?.innerHTML) syncHandoffDraftFromDom(host);
  return normalizeHandoffContext(entregaDraft.handoffContext);
}

/** @returns {boolean} */
export function readEntregaCriticalFromHandoff() {
  const host = document.getElementById('entrega-handoff-panel');
  if (!host) return false;
  const input = host.querySelector('#entrega-critical');
  return input instanceof HTMLInputElement ? input.checked : false;
}

export function getEntregaHandoffContext() {
  return readEntregaHandoffContext();
}
