import {
  listActiveProcedimientos,
  normalizePendientesJson,
} from '../../../lib/entrega/entrega-pendientes.mjs';
import { vitalsStructuredMonitoringEnabled } from '../../../lib/entrega/entrega-vitals-plan.mjs';
import {
  normalizeHandoffContext,
  handoffContextSummary,
} from '../../../lib/entrega/entrega-handoff-context.mjs';

const WARN_SVG = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;
const LUNG_SVG = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 4.5 7 13 7 13s7-8.5 7-13a7 7 0 00-7-7z"/></svg>`;
const ACTIVE_SVG = `<svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`;

export const ROSTER_STATUS_LABELS = {
  critical: 'Crítico',
  unstable: 'Inestable',
  stable: 'Estable',
  postop: 'Postoperatorio',
  '': '—',
};

export const ROSTER_STATUS_CLASS = {
  critical: 'roster-sbadge--critical',
  unstable: 'roster-sbadge--unstable',
  stable: 'roster-sbadge--stable',
  postop: 'roster-sbadge--stable',
  '': 'roster-sbadge--none',
};

/** @param {object} g */
export function entregaRosterRowContextSummary(g) {
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
export function entregaRosterRowIcons(g) {
  if (!g?.pendientes_json) return '';
  const doc = normalizePendientesJson(g.pendientes_json);
  const ctx = normalizeHandoffContext(doc.handoffContext);
  const flags = [];
  if (ctx.vasopressor.active) flags.push(`<span class="roster-icon-flag">${WARN_SVG} Vaso</span>`);
  if (ctx.ventilation.active) flags.push(`<span class="roster-icon-flag">${LUNG_SVG} Vent</span>`);
  return flags.join('');
}

/** @param {object} g */
export function entregaRosterRowStatus(g) {
  if (!g?.pendientes_json) return '';
  const doc = normalizePendientesJson(g.pendientes_json);
  const ctx = normalizeHandoffContext(doc.handoffContext);
  return ctx.clinicalStatus || '';
}

/**
 * @param {object} p
 * @param {Map<string, object>} guardiasMap
 */
export function renderEntregaRosterRowHtml(p, guardiasMap) {
  const g = guardiasMap.get(p.id);
  const summary = entregaRosterRowContextSummary(g);
  const icons = entregaRosterRowIcons(g);
  const status = entregaRosterRowStatus(g);
  const label = ROSTER_STATUS_LABELS[status] || '—';
  const cls = ROSTER_STATUS_CLASS[status] || 'roster-sbadge--none';
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

/** @param {number} count */
export function buildEntregaRosterPanelHtml(censusPatients, critical, stable) {
  return `
    <div class="roster-panel">
      <div class="roster-panel-header">
        <div class="roster-panel-title">Entrega</div>
        <div class="roster-panel-sub">Sala · ${censusPatients.length} pacientes</div>
        <span class="roster-active-badge">${ACTIVE_SVG} Activa</span>
      </div>
      <div class="roster-list">
        ${critical.length ? `<div class="roster-section">Críticos</div>${critical.join('')}` : ''}
        ${stable.length ? `<div class="roster-section">Estables</div>${stable.join('')}` : ''}
      </div>
      <div class="roster-panel-footer modal-actions">
        <button type="button" class="btn-cancel roster-foot-btn" id="roster-btn-cancel">Cancelar</button>
        <button type="button" class="btn-save roster-foot-btn" id="roster-btn-confirm">Confirmar entrega</button>
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} host
 * @param {string[]} rosterPatientIds
 * @param {Map<string, object>} guardiasMap
 * @param {() => void} onRowConfirm
 */
export function wireEntregaRosterRows(host, rosterPatientIds, guardiasMap, onRowConfirm) {
  host.querySelectorAll('.roster-row').forEach((row) => {
    const patientId = row.dataset.patientId;
    const open = () => {
      const g = guardiasMap.get(patientId);
      const patientIndex = rosterPatientIds.indexOf(String(patientId));
      const openModal = typeof window !== 'undefined' ? window.appShell?.openEntregaModal : null;
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
        onConfirm: onRowConfirm,
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
