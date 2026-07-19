import { normalizeHandoffContext } from './entrega-handoff-context.mjs';
import { normalizePendientesJson } from './entrega-pendientes.mjs';

/** @type {ReadonlyArray<{ id: string, label: string, title: string }>} */
export const ENTREGA_CHIP_MARKERS = [
  { id: 'critico', label: 'CR', title: 'Paciente crítico' },
  { id: 'negativas', label: 'NF', title: 'Negativas firmadas' },
  { id: 'show', label: 'SH', title: 'Show' },
];

/**
 * @param {{ is_critical?: number|boolean, pendientes_json?: string|null|undefined }} [guardia]
 * @returns {string[]}
 */
export function entregaChipMarkerIds(guardia) {
  const critical = !!(guardia?.is_critical === 1 || guardia?.is_critical === true);
  const handoff = normalizeHandoffContext(
    normalizePendientesJson(guardia?.pendientes_json).handoffContext
  );
  const ids = [];
  if (critical) ids.push('critico');
  if (handoff.signedRefusal) ids.push('negativas');
  if (handoff.show) ids.push('show');
  return ids;
}

/**
 * @param {string[]} markerIds
 * @returns {Array<{ id: string, label: string, title: string }>}
 */
export function resolveEntregaChipMarkers(markerIds) {
  const set = new Set(markerIds);
  return ENTREGA_CHIP_MARKERS.filter((m) => set.has(m.id));
}

/** @param {string} s */
function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string[]} markerIds
 * @returns {string}
 */
export function buildEntregaMarkerSymbolsHtml(markerIds) {
  const markers = resolveEntregaChipMarkers(markerIds);
  if (!markers.length) return '';
  const chips = markers
    .map(
      (m) =>
        `<span class="patient-chip-symbol patient-chip-symbol--${m.id}" title="${escAttr(m.title)}">${m.label}</span>`
    )
    .join('');
  return `<div class="patient-chip-symbols" role="group" aria-label="Marcadores de entrega">${chips}</div>`;
}
