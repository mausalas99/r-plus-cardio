/**
 * Entrega roster panel — full-width slide-over listing all patients
 * for handoff. Opened by the "Entrega" toolbar button.
 */
import {
  clinicalSessionContext,
  getClinicalScopeContextForEvaluate,
  mapPatientForGuardiaGrid,
  refreshGuardiaCensusFromDb,
} from '../clinical-access-runtime.mjs';
import { patients } from '../app-state.mjs';
import { elevatedPatientFilters } from './clinical-census-filters-state.mjs';
import { filterPatientsForGuardiaCensus } from './patients-clinical-filter.mjs';
import {
  listActiveProcedimientos,
  normalizePendientesJson,
} from '../../../lib/entrega/entrega-pendientes.mjs';
import { vitalsStructuredMonitoringEnabled } from '../../../lib/entrega/entrega-vitals-plan.mjs';
import {
  normalizeHandoffContext,
  handoffContextSummary,
} from '../../../lib/entrega/entrega-handoff-context.mjs';
import {
  patientClinicalPriorityRank,
  sortPatientsByPriorityThenBed,
} from '../../../lib/patient-priority-sort.mjs';

const PANEL_ID = 'entrega-roster-panel';
const WARN_SVG = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;
const LUNG_SVG = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 4.5 7 13 7 13s7-8.5 7-13a7 7 0 00-7-7z"/></svg>`;
const ACTIVE_SVG = `<svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`;

const STATUS_LABELS = {
  critical: 'Crítico',
  unstable: 'Inestable',
  stable: 'Estable',
  postop: 'Postoperatorio',
  '': '—',
};

const STATUS_CLASS = {
  critical: 'roster-sbadge--critical',
  unstable: 'roster-sbadge--unstable',
  stable: 'roster-sbadge--stable',
  postop: 'roster-sbadge--stable',
  '': 'roster-sbadge--none',
};

/** @param {object} g — guardia map entry */
function rowContextSummary(g) {
  if (!g?.pendientes_json) return null;
  const doc = normalizePendientesJson(g.pendientes_json);
  const ctx = normalizeHandoffContext(doc.handoffContext);
  const summary = handoffContextSummary(ctx);
  if (summary !== 'Sin resumen clínico') return summary;
  if (vitalsStructuredMonitoringEnabled(doc.vitalsPlan)) {
    const n = listActiveProcedimientos(doc).length;
    return n > 0 ? `Signos vitales · ${n} estudio(s)` : 'Signos vitales configurados';
  }
  const n = listActiveProcedimientos(doc).length;
  return n > 0 ? `${n} estudio(s) pendiente(s)` : null;
}

/** @param {object} g */
function rowIcons(g) {
  if (!g?.pendientes_json) return '';
  const doc = normalizePendientesJson(g.pendientes_json);
  const ctx = normalizeHandoffContext(doc.handoffContext);
  const flags = [];
  if (ctx.vasopressor.active) flags.push(`<span class="roster-icon-flag">${WARN_SVG} Vaso</span>`);
  if (ctx.ventilation.active) flags.push(`<span class="roster-icon-flag">${LUNG_SVG} Vent</span>`);
  return flags.join('');
}

/** @param {object} g */
function rowStatus(g) {
  if (!g?.pendientes_json) return '';
  const doc = normalizePendientesJson(g.pendientes_json);
  const ctx = normalizeHandoffContext(doc.handoffContext);
  return ctx.clinicalStatus || '';
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
function ensureRosterHost() {
  let host = document.getElementById(PANEL_ID);
  if (host?.closest('#profile-modal, .modal-backdrop[aria-hidden="true"]')) {
    document.body.appendChild(host);
  }
  if (!host) {
    host = document.createElement('div');
    host.id = PANEL_ID;
    host.className = 'entrega-roster-panel-host';
    document.body.appendChild(host);
  }
  return host;
}

export function isEntregaRosterOpen() {
  const host = document.getElementById(PANEL_ID);
  return !!(host && host.innerHTML.trim());
}

const TURNO_STARTED_KEY = 'guardia.turnoStartedAt';

/** @param {object} p @param {Map<string, object>} guardiasMap */
function renderRosterRow(p, guardiasMap) {
  const g = guardiasMap.get(p.id);
  const summary = rowContextSummary(g);
  const icons = rowIcons(g);
  const status = rowStatus(g);
  const label = STATUS_LABELS[status] || '—';
  const cls = STATUS_CLASS[status] || 'roster-sbadge--none';
  const hasCtx = !!summary;

  return `
      <div class="roster-row${hasCtx ? ' roster-row--ctx' : ''}" data-patient-id="${p.id}" role="button" tabindex="0">
        <div class="roster-row-bed">${p.bed_label || '—'}</div>
        <div class="roster-row-body">
          <div class="roster-row-name">${p.name || '—'}</div>
          <div class="roster-row-dx">${String(p.diagnosticosText || p.service || '').toUpperCase() || '—'}</div>
          ${summary
            ? `<div class="roster-row-ctx">${summary}</div>`
            : `<div class="roster-row-empty">Sin contexto — toca para completar</div>`}
        </div>
        <div class="roster-row-right">
          <span class="roster-sbadge ${cls}">${label}</span>
          <div class="roster-icon-flags">${icons}</div>
        </div>
      </div>`;
}

/** @param {object[]} censusPatients @param {object[]} critical @param {object[]} stable @param {Map<string, object>} guardiasMap */
function buildRosterPanelHtml(censusPatients, critical, stable, guardiasMap) {
  const renderRow = (p) => renderRosterRow(p, guardiasMap);
  return `
    <div class="roster-panel">
      <div class="roster-panel-header">
        <div class="roster-panel-title">Entrega</div>
        <div class="roster-panel-sub">Sala · ${censusPatients.length} pacientes</div>
        <span class="roster-active-badge">${ACTIVE_SVG} Activa</span>
      </div>
      <div class="roster-list">
        ${critical.length ? `<div class="roster-section">Críticos</div>${critical.map(renderRow).join('')}` : ''}
        ${stable.length ? `<div class="roster-section">Estables</div>${stable.map(renderRow).join('')}` : ''}
      </div>
      <div class="roster-panel-footer modal-actions">
        <button type="button" class="btn-cancel roster-foot-btn" id="roster-btn-cancel">Cancelar</button>
        <button type="button" class="btn-save roster-foot-btn" id="roster-btn-confirm">Confirmar entrega</button>
      </div>
    </div>`;
}

/** @param {HTMLElement} host @param {Map<string, object>} guardiasMap @param {string[]} rosterPatientIds @param {Record<string, unknown>|null|undefined} settings */
function wireRosterRows(host, guardiasMap, rosterPatientIds, settings) {
  host.querySelectorAll('.roster-row').forEach((row) => {
    const patientId = row.dataset.patientId;
    const open = () => {
      const g = guardiasMap.get(patientId);
      const patientIndex = rosterPatientIds.indexOf(String(patientId));
      const openModal =
        typeof window !== 'undefined' ? window.appShell?.openEntregaModal : null;
      if (typeof openModal !== 'function') {
        window.showToast?.('No se pudo abrir la entrega.', 'error');
        return;
      }
      openModal({
        patientId,
        guardiaId: g?.guardia_id ? String(g.guardia_id) : undefined,
        patientIndex: patientIndex >= 0 ? patientIndex : undefined,
        patientTotal: rosterPatientIds.length,
        rosterPatientIds,
        onConfirm: () => {
          void refreshGuardiaCensusFromDb(settings);
          openEntregaRosterPanel(settings);
        },
      });
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        open();
      }
    });
  });
}

/** @param {Map<string, object>} guardiasMap */
function rosterHasSavedEntregas(guardiasMap) {
  let totalEstudios = 0;
  let patientsWithSignos = 0;
  for (const g of guardiasMap.values()) {
    if (!g?.pendientes_json) continue;
    const doc = normalizePendientesJson(g.pendientes_json);
    totalEstudios += listActiveProcedimientos(doc).length;
    if (vitalsStructuredMonitoringEnabled(doc.vitalsPlan)) patientsWithSignos += 1;
  }
  return totalEstudios > 0 || patientsWithSignos > 0;
}

function wireRosterFooter(guardiasMap) {
  document.getElementById('roster-btn-cancel')?.addEventListener('click', () => {
    void (async () => {
      closeEntregaRosterPanel();
      const { endEntregaPhase } = await import('./clinical-entrega.mjs');
      endEntregaPhase();
      window.dispatchEvent(new CustomEvent('guardia:entrega-ended'));
    })();
  });

  document.getElementById('roster-btn-confirm')?.addEventListener('click', () => {
    void (async () => {
      if (!rosterHasSavedEntregas(guardiasMap)) {
        const proceed = window.confirm(
          'No hay entregas guardadas con signos vitales ni estudios.\n\n' +
            'Los internos (MIP) solo ven pacientes entregados al R1 de guardia. Abre cada paciente, configura signos (y procedimientos si aplica) y pulsa Guardar entrega.\n\n' +
            '¿Iniciar turno activo de todos modos?'
        );
        if (!proceed) return;
      }

      closeEntregaRosterPanel();
      const { endEntregaPhase } = await import('./clinical-entrega.mjs');
      endEntregaPhase();
      activateTurnoActivo();
      window.dispatchEvent(new CustomEvent('guardia:turno-activo'));
    })();
  });
}

function rosterScopePatients(guardiasMap) {
  const basePatients = patients.filter((p) => p && p.id && !p.isDemo && !p.archived);
  const scopeContext =
    clinicalSessionContext.scopeContext || getClinicalScopeContextForEvaluate() || {};
  const scoped = filterPatientsForGuardiaCensus(
    basePatients,
    clinicalSessionContext.user,
    scopeContext,
    guardiasMap,
    elevatedPatientFilters
  );
  return sortPatientsByPriorityThenBed(
    scoped.map((p) => ({ ...mapPatientForGuardiaGrid(p), _raw: p })),
    guardiasMap
  );
}

export async function openEntregaRosterPanel(settings) {
  await refreshGuardiaCensusFromDb(settings);
  const host = ensureRosterHost();
  document.documentElement.classList.add('guardia-entrega-roster-open');

  const guardiasMap = clinicalSessionContext.guardiasMap;
  const censusPatients = rosterScopePatients(guardiasMap);
  const critical = censusPatients.filter(
    (p) => patientClinicalPriorityRank(p, guardiasMap.get(p.id)) < 2
  );
  const stable = censusPatients.filter(
    (p) => patientClinicalPriorityRank(p, guardiasMap.get(p.id)) >= 2
  );

  host.innerHTML = buildRosterPanelHtml(censusPatients, critical, stable, guardiasMap);
  const rosterPatientIds = censusPatients.map((p) => String(p.id));
  wireRosterRows(host, guardiasMap, rosterPatientIds, settings);
  wireRosterFooter(guardiasMap);
}

export function closeEntregaRosterPanel() {
  const host = document.getElementById(PANEL_ID);
  if (host) host.innerHTML = '';
  host?.removeAttribute('style');
  document.documentElement.classList.remove('guardia-entrega-roster-open');
}

/** Persist turno-activo state to localStorage. */
export function activateTurnoActivo() {
  try {
    localStorage.setItem('guardia.turnoActive', '1');
    if (!localStorage.getItem(TURNO_STARTED_KEY)) {
      localStorage.setItem(TURNO_STARTED_KEY, new Date().toISOString());
    }
  } catch {
    /* quota */
  }
}

export function deactivateTurnoActivo() {
  try {
    localStorage.removeItem('guardia.turnoActive');
    localStorage.removeItem(TURNO_STARTED_KEY);
  } catch {
    /* quota */
  }
}

/** @returns {Date|null} */
export function getTurnoStartedAt() {
  try {
    const raw = localStorage.getItem(TURNO_STARTED_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function isTurnoActivo() {
  try {
    return !!localStorage.getItem('guardia.turnoActive');
  } catch {
    return false;
  }
}
