/** Snapshot strip + historial section HTML for Estado Actual panel. */
import {
  renderSnapshotVitalsHtml,
  renderSnapshotGluHtml,
  renderSnapshotGluZoneTitle,
  renderSnapshotIoHtml,
  formatHistorialWhen,
  buildHistorialRowParts,
} from './estado-actual-panel-snapshot-html.mjs';

export { formatSnapshotEgresos } from './estado-actual-panel-snapshot-format.mjs';

/**
 * @param {ReturnType<typeof import('./estado-actual-data.mjs').deriveSnapshot>} snapshot
 * @param {number} balTurno
 * @param {number} balGlobal
 */
export function renderSnapshotSection(snapshot, balTurno, balGlobal) {
  return (
    '<section class="ea-section ea-card ea-snapshot-strip ea-snapshot-strip--primary" id="ea-snapshot">' +
    '<div class="ea-snapshot-strip-body">' +
    '<div class="ea-snapshot-zone ea-snapshot-zone--vitals">' +
    '<h4 class="ea-snapshot-zone-title">Signos vitales</h4>' +
    '<div class="ea-snapshot-vitals">' +
    renderSnapshotVitalsHtml(snapshot) +
    '</div>' +
    '</div>' +
    '<div class="ea-snapshot-zone">' +
    '<h4 class="ea-snapshot-zone-title">' + renderSnapshotGluZoneTitle(snapshot) + '</h4>' +
    '<div class="ea-snapshot-glu">' +
    renderSnapshotGluHtml(snapshot) +
    '</div>' +
    '</div>' +
    '<div class="ea-snapshot-zone">' +
    '<h4 class="ea-snapshot-zone-title">Balance hídrico</h4>' +
    renderSnapshotIoHtml(snapshot, balGlobal) +
    '</div>' +
    '</div>' +
    '</section>'
  );
}

/**
 * @param {Array<{ id?: string, recordedAt?: string }>} historial
 */
export function renderHistorialSection(historial) {
  var sorted = historial.slice().sort(function (a, b) {
    return String(b.recordedAt || '').localeCompare(String(a.recordedAt || ''));
  });
  var recent = sorted.slice(0, 8);
  if (!recent.length) {
    return (
      '<details class="ea-section ea-card ea-historial" id="ea-historial">' +
      '<summary class="ea-historial-summary">Historial reciente</summary>' +
      '<p class="ea-muted ea-historial-empty">Sin mediciones registradas.</p>' +
      '</details>'
    );
  }

  var rows = recent
    .map(function (row) {
      var when = formatHistorialWhen(row.recordedAt);
      var parts = buildHistorialRowParts(row);
      var summary = parts.length ? parts.join(' · ') : 'Registro vacío';
      return (
        '<li class="ea-historial-row">' +
        '<div class="ea-historial-main">' +
        '<span class="ea-historial-when">' +
        when +
        '</span>' +
        '<span class="ea-historial-summary">' +
        summary +
        '</span>' +
        '</div>' +
        '<button type="button" class="ea-btn ea-btn--ghost ea-btn--danger" onclick="eliminarEstadoActualMedicion(\'' +
        String(row.id || '').replace(/'/g, "\\'") +
        '\')">Eliminar</button>' +
        '</li>'
      );
    })
    .join('');

  return (
    '<details class="ea-section ea-card ea-historial" id="ea-historial">' +
    '<summary class="ea-historial-summary">Historial reciente' +
    '<span class="ea-historial-count">' +
    recent.length +
    '</span></summary>' +
    '<ul class="ea-historial-list">' +
    rows +
    '</ul>' +
    '</details>'
  );
}
