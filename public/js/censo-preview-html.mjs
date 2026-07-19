import {
  buildCensoPreviewBodyHtml,
  buildCensoPreviewDocumentHtml,
} from './censo-preview-html-render.mjs';

/**
 * Vista previa HTML del censo (tabla compacta, alineada al PDF).
 * @param {{ header?: Record<string, string>, rows?: Array<Record<string, unknown>> }} payload
 * @returns {string}
 */
export function renderCensoPreviewHtml(payload) {
  var header = payload.header || {};
  var rows = payload.rows || [];
  return buildCensoPreviewDocumentHtml(header, buildCensoPreviewBodyHtml(rows));
}

function ensureCensoPreviewModal() {
  var existing = document.getElementById('censo-preview-backdrop');
  if (existing) return existing;
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop censo-preview-backdrop';
  backdrop.id = 'censo-preview-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML =
    '<div class="modal censo-preview-modal" role="dialog" aria-modal="true" aria-labelledby="censo-preview-title">' +
    '<div class="censo-preview-modal-head">' +
    '<h3 id="censo-preview-title" class="modal-title">Vista previa del censo</h3>' +
    '<p class="profile-hint censo-preview-hint">Así se verá el PDF. Usa Imprimir para guardar como PDF desde el sistema.</p>' +
    '</div>' +
    '<iframe id="censo-preview-frame" class="censo-preview-frame" title="Vista previa del censo"></iframe>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn-med-secondary" id="censo-preview-close">Cerrar</button>' +
    '<button type="button" class="btn-generate" id="censo-preview-print">Imprimir</button>' +
    '</div></div>';
  document.body.appendChild(backdrop);

  if (!ensureCensoPreviewModal._wired) {
    ensureCensoPreviewModal._wired = true;
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeCensoPreviewModal();
    });
    document.getElementById('censo-preview-close')?.addEventListener('click', closeCensoPreviewModal);
    document.getElementById('censo-preview-print')?.addEventListener('click', function () {
      var frame = document.getElementById('censo-preview-frame');
      try {
        frame?.contentWindow?.print();
      } catch {
        /* noop */
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var el = document.getElementById('censo-preview-backdrop');
      if (el?.classList.contains('open')) closeCensoPreviewModal();
    });
  }

  return backdrop;
}

export function closeCensoPreviewModal() {
  var backdrop = document.getElementById('censo-preview-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('censo-preview-open');
  var frame = document.getElementById('censo-preview-frame');
  if (frame) frame.removeAttribute('srcdoc');
}

/**
 * Vista previa dentro de la app (sin ventanas emergentes).
 * @param {{ header?: Record<string, string>, rows?: Array<Record<string, unknown>> }} payload
 * @returns {boolean}
 */
export function openCensoPreviewInApp(payload) {
  var html = renderCensoPreviewHtml(payload);
  var backdrop = ensureCensoPreviewModal();
  var frame = document.getElementById('censo-preview-frame');
  if (!frame) return false;
  frame.srcdoc = html;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('censo-preview-open');
  return true;
}

/**
 * @deprecated Usar openCensoPreviewInApp.
 * @param {{ header?: Record<string, string>, rows?: Array<Record<string, unknown>> }} payload
 */
export function openCensoPreviewWindow(payload) {
  return openCensoPreviewInApp(payload);
}
