/** @param {Array<{ dayKey: string, label: string }>} groups */
export function buildLabBatchCopyListHtml(groups) {
  return groups
    .map(function (group) {
      return (
        '<li style="margin:6px 0;">' +
        '<label style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;">' +
        '<input type="checkbox" class="lab-batch-copy-cb" data-day-key="' + esc(group.dayKey) + '" style="margin-top:3px;flex-shrink:0;" />' +
        '<span>' + esc(group.label) + '</span></label></li>'
      );
    })
    .join('');
}

/** @param {string} listHtml */

import { esc } from '../dom-escape.mjs';
export function buildLabBatchCopyModalHtml(listHtml) {
  return (
    '<div class="lab-conflict-modal" style="max-width:560px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<h3 style="margin:0 0 8px;">Copiar varios días</h3>' +
    '<p style="font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--text-muted);">Marca los días que quieres copiar. El texto usa el mismo formato que el bloque <strong>Estudios</strong> del expediente (laboratorio y cultivos por día).</p>' +
    '<div style="overflow-y:auto;flex:0 1 auto;max-height:28vh;padding-right:4px;">' +
    '<ul style="margin:0;padding-left:0;list-style:none;font-size:13px;">' + listHtml + '</ul></div>' +
    '<p id="lab-batch-copy-count" style="font-size:12px;color:var(--text-muted);margin:10px 0 6px;">Ningún día seleccionado — marca al menos uno para copiar</p>' +
    '<textarea id="lab-batch-copy-preview" readonly rows="8" placeholder="La vista previa aparece al seleccionar uno o más días arriba." style="width:100%;box-sizing:border-box;font-family:ui-monospace,monospace;font-size:12px;line-height:1.4;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);resize:vertical;flex:1;min-height:120px;"></textarea>' +
    '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;">' +
    '<button type="button" id="lab-batch-copy-none" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Quitar todas</button>' +
    '<button type="button" id="lab-batch-copy-all" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Seleccionar todas</button>' +
    '<button type="button" id="lab-batch-copy-cancel" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Cancelar</button>' +
    '<button type="button" id="lab-batch-copy-ok" disabled aria-disabled="true" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:not-allowed;opacity:0.55;">Copiar al portapapeles</button>' +
    '</div></div>'
  );
}

/**
 * @param {HTMLElement} backdrop
 * @param {{ refreshPreview: () => void, onCancel: () => void, onCopy: () => void }} handlers
 */
export function wireLabBatchCopyModal(backdrop, handlers) {
  backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) {
    cb.addEventListener('change', handlers.refreshPreview);
  });
  backdrop.querySelector('#lab-batch-copy-none').onclick = function () {
    backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) { cb.checked = false; });
    handlers.refreshPreview();
  };
  backdrop.querySelector('#lab-batch-copy-all').onclick = function () {
    backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) { cb.checked = true; });
    handlers.refreshPreview();
  };
  backdrop.querySelector('#lab-batch-copy-cancel').onclick = handlers.onCancel;
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) handlers.onCancel();
  });
  backdrop.querySelector('#lab-batch-copy-ok').onclick = handlers.onCopy;
}
