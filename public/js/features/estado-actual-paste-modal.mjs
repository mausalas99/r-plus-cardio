import {
  parseEstadoActualPaste,
  formatEstadoActualParsePreview,
} from './estado-actual-parser.mjs';

/** @type {{ showToast(msg: string, type?: string): void, applyParsed?: (parsed: ReturnType<typeof parseEstadoActualPaste>) => void }} */
let rt = {
  showToast() {},
  applyParsed() {},
};

const SAMPLE_TEXT =
  'T°: 38.7 °C\n' +
  'FC: 113 LPM\n' +
  'FR: 19 RPM\n' +
  'TA: 140/60 MMHG\n' +
  'DXT: 198, 174, 101, 252 MG/DL\n' +
  'SAT: 97% AL AIRE AMBIENTE\n' +
  'I: 2,815 CC\n' +
  'E: NO CUANTIFICADA\n' +
  'B: NC\n' +
  'EVAC: NO REPORTADAS';

export function registerEstadoActualPasteModalRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function getTextarea() {
  return /** @type {HTMLTextAreaElement | null} */ (document.getElementById('ea-paste-input'));
}

function getPreviewEl() {
  return document.getElementById('ea-paste-preview');
}

function refreshPreview() {
  var ta = getTextarea();
  var preview = getPreviewEl();
  if (!preview) return;
  var parsed = parseEstadoActualPaste(ta ? ta.value : '');
  preview.textContent = formatEstadoActualParsePreview(parsed);
  preview.classList.toggle('ea-paste-preview--error', !parsed.ok);
}

function ensureRegistroModalOpen() {
  var reg = document.getElementById('ea-registro-backdrop');
  if (reg && reg.classList.contains('open')) return;
  if (typeof window.openEstadoActualRegistroModal === 'function') {
    window.openEstadoActualRegistroModal();
  }
}

/**
 * @param {{ skipRegistro?: boolean, prefillSample?: boolean }} [opts]
 */
export function openEstadoActualPasteModal(opts) {
  opts = opts || {};
  if (!opts.skipRegistro) ensureRegistroModalOpen();
  var backdrop = document.getElementById('ea-paste-backdrop');
  var ta = getTextarea();
  if (!backdrop || !ta) {
    rt.showToast('Pegar monitoreo no disponible', 'error');
    return;
  }
  ta.value = opts.prefillSample ? SAMPLE_TEXT : '';
  refreshPreview();
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  ta.focus();
}

export function closeEstadoActualPasteModal() {
  var backdrop = document.getElementById('ea-paste-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

export function isEstadoActualPasteModalOpen() {
  var backdrop = document.getElementById('ea-paste-backdrop');
  return !!(backdrop && backdrop.classList.contains('open'));
}

export function confirmEstadoActualPaste() {
  var ta = getTextarea();
  var parsed = parseEstadoActualPaste(ta ? ta.value : '');
  if (!parsed.ok) {
    rt.showToast(parsed.error || 'No se pudo interpretar el texto', 'error');
    return;
  }
  closeEstadoActualPasteModal();
  if (typeof rt.applyParsed === 'function') {
    rt.applyParsed(parsed, { fromNestedPaste: true });
    rt.showToast('Datos aplicados — revisa y registra', 'success');
  }
}

export function wireEstadoActualPasteModal() {
  var ta = getTextarea();
  if (ta && !ta.dataset.eaPasteWired) {
    ta.dataset.eaPasteWired = '1';
    ta.addEventListener('input', refreshPreview);
    ta.placeholder = SAMPLE_TEXT;
  }
}

export const windowHandlers = {
  openEstadoActualPasteModal,
  closeEstadoActualPasteModal,
  confirmEstadoActualPaste,
};
