import { pickDiffKeys, summarizeConflictFieldValue, formatFieldLabel } from '../lan-conflict-silent-match.mjs';

import { escHtml } from '../dom-escape.mjs';
function formatConflictValue(value, fieldKey) {
  return summarizeConflictFieldValue(fieldKey, value);
}

export function buildConflictDiffParts({ conflictingKeys, localData, serverData }) {
  const conflictSet = new Set(conflictingKeys || []);
  const keys = pickDiffKeys(conflictingKeys, localData, serverData);
  if (!keys.length) {
    return {
      keyCount: 0,
      summaryHtml:
        '<p class="clinical-conflict-summary-empty">No hay detalle por sección (común al eliminar o por desfase de versión). Elige abajo si conservas la sala o tu borrador.</p>',
      detailHtml: '',
    };
  }
  const labels = keys.map((key) => formatFieldLabel(key));
  const conflictOnly = keys.filter((key) => conflictSet.has(key) || conflictSet.has('*'));
  const summaryLead =
    conflictOnly.length === keys.length
      ? keys.length === 1
        ? 'Chocó <strong>1 sección</strong>:'
        : 'Chocaron <strong>' + keys.length + ' secciones</strong>:'
      : 'Hay <strong>' + keys.length + ' diferencia' + (keys.length === 1 ? '' : 's') + '</strong> respecto a la sala:';
  const summaryHtml =
    '<div class="clinical-conflict-summary"><p class="clinical-conflict-summary-lead">' + summaryLead + '</p>' +
    '<ul class="clinical-conflict-affected">' + labels.map((label) => '<li>' + escHtml(label) + '</li>').join('') + '</ul></div>';
  const cards = keys.map((key) => {
    const isConflict = conflictSet.has(key) || conflictSet.has('*');
    const localVal = formatConflictValue(localData?.[key], key);
    const serverVal = formatConflictValue(serverData?.[key], key);
    const serverMissing = serverData?.[key] === undefined || serverData?.[key] === null;
    const samePreview = localVal === serverVal && localVal !== '—';
    return (
      '<article class="clinical-conflict-field-card' + (isConflict ? ' clinical-conflict-field-card--hot' : '') + '">' +
      '<h4 class="clinical-conflict-field-title">' + escHtml(formatFieldLabel(key)) + '</h4>' +
      (samePreview
        ? '<p class="clinical-conflict-field-same">En este resumen se ve igual en tu borrador y en la sala; aun así el registro del host no coincide del todo (versión, metadatos u otro campo que aquí no mostramos).</p>'
        : '<div class="clinical-conflict-compare"><div class="clinical-conflict-side clinical-conflict-side--local"><span class="clinical-conflict-side-label">Tu intento</span><p>' +
          escHtml(localVal) + '</p></div><div class="clinical-conflict-side clinical-conflict-side--server' +
          (serverMissing ? ' clinical-conflict-side--missing' : '') + '"><span class="clinical-conflict-side-label">En la sala</span><p>' +
          escHtml(serverVal) + '</p></div></div>') +
      '</article>'
    );
  }).join('');
  return { keyCount: keys.length, summaryHtml, detailHtml: '<div class="clinical-conflict-diff-cards">' + cards + '</div>' };
}

export function buildConflictDiffHtml(opts) {
  const parts = buildConflictDiffParts(opts);
  return parts.summaryHtml + parts.detailHtml;
}
