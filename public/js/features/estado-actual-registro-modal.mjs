import { closeEstadoActualPasteModal } from './estado-actual-paste-modal.mjs';

/** @type {{ ensureForm(): void, resetForm(): void, showToast(msg: string, type?: string): void }} */
let rt = {
  ensureForm() {},
  resetForm() {},
  showToast() {},
};

var dismissWired = false;

export function registerEstadoActualRegistroModalRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function getBackdrop() {
  return document.getElementById('ea-registro-backdrop');
}

function getPasteBackdrop() {
  return document.getElementById('ea-paste-backdrop');
}

function handleEaModalEscape(ev) {
  if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
  var pasteBd = getPasteBackdrop();
  if (pasteBd && pasteBd.classList.contains('open')) {
    closeEstadoActualPasteModal();
    ev.preventDefault();
    ev.stopPropagation();
    return;
  }
  var reg = getBackdrop();
  if (reg && reg.classList.contains('open')) {
    closeEstadoActualRegistroModal();
    ev.preventDefault();
    ev.stopPropagation();
  }
}

/** Escape y clic fuera (registro + pegar anidado). */
export function wireEaModalDismiss() {
  if (dismissWired) return;
  dismissWired = true;
  document.addEventListener('keydown', handleEaModalEscape, true);
  var reg = getBackdrop();
  var pasteBd = getPasteBackdrop();
  if (reg) {
    reg.addEventListener('click', function (ev) {
      if (!reg.classList.contains('open')) return;
      if (ev.target !== reg) return;
      closeEstadoActualRegistroModal();
    });
  }
  if (pasteBd) {
    pasteBd.addEventListener('click', function (ev) {
      if (!pasteBd.classList.contains('open')) return;
      var panel = pasteBd.querySelector('.ea-paste-modal');
      if (panel && panel.contains(/** @type {Node} */ (ev.target))) return;
      closeEstadoActualPasteModal();
    });
  }
}

/**
 * @param {{ preserveForm?: boolean } | undefined} [opts]
 */
export function openEstadoActualRegistroModal(opts) {
  var backdrop = getBackdrop();
  if (!backdrop) {
    rt.showToast('Formulario de registro no disponible', 'error');
    return;
  }
  rt.ensureForm();
  if (!opts || !opts.preserveForm) rt.resetForm();
  else if (typeof rt.syncGluMode === 'function') rt.syncGluMode();
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('ea-registro-modal-open');
  var first = backdrop.querySelector('[data-ea-vital="tas"], [data-ea-vital="temp"]');
  if (first && 'focus' in first) first.focus();
}

export function closeEstadoActualRegistroModal() {
  closeEstadoActualPasteModal();
  var backdrop = getBackdrop();
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('ea-registro-modal-open');
}

export const windowHandlers = {
  openEstadoActualRegistroModal,
  closeEstadoActualRegistroModal,
};
