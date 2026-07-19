import { abbreviatePatientName } from '../../../lib/interno/interno-board.mjs';
import { normalizePendientesJson } from '../../../lib/entrega/entrega-pendientes.mjs';
import { buildEntregaMarkerSymbolsHtml, entregaChipMarkerIds } from '../../../lib/entrega/entrega-chip-markers.mjs';
import { calcVitalsBannerForSpec } from '../../../lib/interno/vitals-banner.mjs';

function escapeChipAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** @param {{ last_vitals_check?: string, vitals_frequency?: string, pendientes_json?: string|null }} meta */
export function vitalsBannerForGuardia(meta) {
  const doc = normalizePendientesJson(meta?.pendientes_json);
  return calcVitalsBannerForSpec(
    meta?.last_vitals_check,
    doc.vitalsPlan?.frequency ?? meta?.vitals_frequency
  );
}

function resolveChipVitalsSpec(meta) {
  if (meta?.pendientes_json) {
    return normalizePendientesJson(meta.pendientes_json).vitalsPlan?.frequency ?? meta?.vitals_frequency ?? null;
  }
  return meta?.vitals_frequency ?? null;
}

function patientChipBadgesHtml(p, meta, critical) {
  const dnr = p.negativa_maniobras_firmada ? '<span class="dnr-badge">DNR</span>' : '';
  const markerIds = Array.isArray(p.entregaMarkers) ? p.entregaMarkers : entregaChipMarkerIds(meta);
  const markerSymbols = buildEntregaMarkerSymbolsHtml(markerIds);
  const criticalHint = critical
    ? '<span class="patient-chip-critical-hint" title="Paciente crítico" aria-hidden="true"></span>'
    : '';
  return markerSymbols + dnr + criticalHint;
}

function patientChipNameHtml(p) {
  const nameRaw = String(p.name || '').trim();
  const nameDisplay = nameRaw ? abbreviatePatientName(nameRaw) : '—';
  const nameTitle = nameRaw ? escapeChipAttr(nameRaw) : '';
  return {
    display: nameDisplay,
    titleAttr: nameTitle ? ` title="${nameTitle}"` : '',
  };
}

function patientChipPendingLabel(pending) {
  if (pending <= 0) return '';
  return `<span class="patient-chip-tasks">${pending} pend.${pending === 1 ? '' : 's'}</span>`;
}

/**
 * @param {{ id: string, bed_label?: string, name?: string, negativa_maniobras_firmada?: number, dxText?: string, pendingCount?: number, labsSnippet?: string, isCritical?: boolean, guardiaMeta?: object, entregaMarkers?: string[] }} p
 * @param {object|undefined} g
 */
export function buildPatientChipInnerHtml(p, g) {
  const meta = p.guardiaMeta || g;
  const critical = !!(p.isCritical || meta?.is_critical);
  const vitals = vitalsBannerForGuardia(meta);
  const bed = p.bed_label ? p.bed_label : '—';
  const name = patientChipNameHtml(p);
  const dx = String(p.dxText || 'Sin diagnóstico registrado');
  const pending = Number(p.pendingCount || 0);
  const labs = String(p.labsSnippet || '—');
  const vitalsTitle = escapeChipAttr(vitals.str);
  return {
    critical,
    innerHtml:
      '<div class="patient-chip-head">' +
      '<span class="patient-chip-bed">Cama ' +
      bed +
      '</span>' +
      '<div class="patient-chip-badges">' +
      patientChipBadgesHtml(p, meta, critical) +
      '</div></div>' +
      '<p class="patient-chip-name"' +
      name.titleAttr +
      '>' +
      name.display +
      '</p>' +
      '<p class="patient-chip-dx">' +
      dx +
      '</p>' +
      '<div class="patient-chip-vitals vitals-banner ' +
      vitals.cls +
      '" title="' +
      vitalsTitle +
      '">' +
      '<span class="patient-chip-vitals__text">' +
      vitals.str +
      '</span></div>' +
      '<div class="patient-chip-footer">' +
      patientChipPendingLabel(pending) +
      '<span class="patient-chip-labs" title="' +
      escapeChipAttr(labs) +
      '">' +
      labs +
      '</span></div>',
    vitalsSpec: resolveChipVitalsSpec(meta),
    vitalsLast: String(meta?.last_vitals_check ?? ''),
  };
}
