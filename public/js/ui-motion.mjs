// Vanilla helpers for field shake and async button label swaps.

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function shakeField(el) {
  if (!el || !(el instanceof HTMLElement)) return;
  if (prefersReducedMotion()) {
    try { el.focus({ preventScroll: true }); } catch (_e) { void _e; }
    return;
  }
  el.classList.remove('field-shake');
  void el.offsetWidth;
  el.classList.add('field-shake');
  function onEnd(ev) {
    if (ev.animationName !== 'field-shake') return;
    el.removeEventListener('animationend', onEnd);
    el.classList.remove('field-shake');
  }
  el.addEventListener('animationend', onEnd);
  try { el.focus({ preventScroll: true }); } catch (_e) { void _e; }
}

export function shakeFields(els) {
  (els || []).forEach(function (el) {
    shakeField(el);
  });
}

/** Maps patient-modal validation messages to input ids. */
export function resolvePatientFieldIds(errorMessage, isFromLab) {
  var msg = String(errorMessage || '').toLowerCase();
  var ids = [];
  if (msg.indexOf('nombre') >= 0) {
    ids.push(isFromLab ? 'm-nombre' : 'm-nombre-manual');
  }
  if (msg.indexOf('edad') >= 0) {
    ids.push(isFromLab ? 'm-edad-num' : 'm-edad-num-manual');
  }
  if (msg.indexOf('servicio') >= 0 || msg.indexOf('área') >= 0 || msg.indexOf('area') >= 0) {
    ids.push('m-servicio');
    if (!isFromLab && (msg.indexOf('área') >= 0 || msg.indexOf('area') >= 0 || msg.indexOf('departamento') >= 0)) {
      ids.push('m-area');
    }
  }
  if (msg.indexOf('cuarto') >= 0 || msg.indexOf('cama') >= 0) {
    ids.push('m-cuarto', 'm-cama');
  }
  var seen = new Set();
  return ids.filter(function (id) {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function shakePatientFieldsForError(errorMessage, isFromLab) {
  resolvePatientFieldIds(errorMessage, isFromLab).forEach(function (id) {
    shakeField(document.getElementById(id));
  });
}

function collectButtonLabelText(btn) {
  var parts = [];
  btn.childNodes.forEach(function (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      var t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
  });
  return parts.join(' ');
}

function captureButtonLabel(btn, label) {
  var text = label.textContent.replace(/\s+/g, ' ').trim();
  if (text) return text;
  text = collectButtonLabelText(btn);
  if (text) return text;
  return String(btn.getAttribute('aria-label') || btn.title || '').trim();
}

function ensureButtonSpinner(btn) {
  var spin = btn.querySelector(':scope > .btn-spinner');
  if (spin) return spin;
  spin = document.createElement('span');
  spin.className = 'btn-spinner';
  spin.setAttribute('aria-hidden', 'true');
  btn.insertBefore(spin, btn.firstChild);
  return spin;
}

function removeButtonSpinner(btn) {
  var spin = btn.querySelector(':scope > .btn-spinner');
  if (spin) spin.remove();
}

function ensureButtonLabel(btn) {
  var existing = btn.querySelector(':scope > .btn-label');
  if (existing) return existing;
  var label = document.createElement('span');
  label.className = 'btn-label';
  var moved = false;
  Array.from(btn.childNodes).forEach(function (n) {
    if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
      label.appendChild(n);
      moved = true;
    }
  });
  if (!moved) {
    var text = collectButtonLabelText(btn);
    if (text) label.textContent = text;
  }
  btn.appendChild(label);
  return label;
}

function resetLabelMotion(label) {
  if (!label) return;
  if (label._uiMotionSwapHandler) {
    label.removeEventListener('transitionend', label._uiMotionSwapHandler);
    label._uiMotionSwapHandler = null;
  }
  label.classList.remove('ui-text-leaving', 'ui-text-entering');
}

function swapLabelText(label, nextText, options) {
  options = options || {};
  if (!label) return;
  nextText = String(nextText || '');
  resetLabelMotion(label);
  if (!options.force && label.textContent.replace(/\s+/g, ' ').trim() === nextText) return;
  if (prefersReducedMotion() || options.instant) {
    label.textContent = nextText;
    return;
  }
  label.classList.add('ui-text-leaving');
  var swapId = (label._uiMotionSwapId || 0) + 1;
  label._uiMotionSwapId = swapId;
  function onDone(ev) {
    if (ev.propertyName !== 'opacity') return;
    if (label._uiMotionSwapId !== swapId) return;
    label.removeEventListener('transitionend', onDone);
    label._uiMotionSwapHandler = null;
    label.textContent = nextText;
    label.classList.remove('ui-text-leaving');
    label.classList.add('ui-text-entering');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (label._uiMotionSwapId !== swapId) return;
        label.classList.remove('ui-text-entering');
      });
    });
  }
  label._uiMotionSwapHandler = onDone;
  label.addEventListener('transitionend', onDone);
}

/**
 * Close a modal: state + callback first, then canvas-style exit motion (non-blocking).
 * @param {HTMLElement|null|undefined} backdropEl
 * @param {() => void} [done]
 */
export function closeModalAnimated(backdropEl, done) {
  if (!backdropEl || !(backdropEl instanceof HTMLElement)) {
    if (typeof done === 'function') done();
    return;
  }
  backdropEl.setAttribute('aria-hidden', 'true');
  if (typeof done === 'function') done();

  if (!backdropEl.classList.contains('open')) {
    backdropEl.classList.remove('closing');
    return;
  }
  backdropEl.classList.remove('open');

  if (prefersReducedMotion()) {
    backdropEl.classList.remove('closing');
    return;
  }

  backdropEl.classList.add('closing');
  var settled = false;
  function settle() {
    if (settled) return;
    settled = true;
    backdropEl.removeEventListener('animationend', onEnd);
    backdropEl.classList.remove('closing');
  }
  function onEnd(ev) {
    if (ev.target !== backdropEl) return;
    if (ev.animationName !== 'fade-out') return;
    settle();
  }
  backdropEl.addEventListener('animationend', onEnd);
  setTimeout(settle, 220);
}

var OVERLAY_OUT_CLASS = 'overlay-anim-out';

function overlayMotionEls(backdropEl, opts) {
  var els = [backdropEl];
  if (opts && opts.panelEl instanceof HTMLElement) els.push(opts.panelEl);
  return els;
}

/** Cancela un cierre animado pendiente; llamar antes de re-mostrar el overlay. */
export function cancelOverlayClose(backdropEl, opts) {
  if (!backdropEl || !(backdropEl instanceof HTMLElement)) return;
  backdropEl._uiOverlayCloseId = (backdropEl._uiOverlayCloseId || 0) + 1;
  overlayMotionEls(backdropEl, opts).forEach(function (el) {
    el.classList.remove(OVERLAY_OUT_CLASS);
  });
  backdropEl.removeAttribute('aria-hidden');
}

/**
 * Cierre con motion para overlays de display/hidden directo (Tendencias, ⌘K).
 * aria-hidden inmediato; fade-out + modal-out (CSS .overlay-anim-out); hideFn al
 * terminar — ahí van display:none y la limpieza de DOM/charts, para que el
 * contenido no se vea vaciarse durante la salida.
 * @param {HTMLElement|null|undefined} backdropEl
 * @param {() => void} hideFn
 * @param {{ panelEl?: HTMLElement }} [opts] panel hermano (no hijo) del backdrop
 */
export function closeOverlayAnimated(backdropEl, hideFn, opts) {
  var hide = typeof hideFn === 'function' ? hideFn : function () {};
  if (!backdropEl || !(backdropEl instanceof HTMLElement)) {
    hide();
    return;
  }
  if (backdropEl.classList.contains(OVERLAY_OUT_CLASS)) return; // ya cerrando
  backdropEl.setAttribute('aria-hidden', 'true');
  var els = overlayMotionEls(backdropEl, opts);
  var notVisible = backdropEl.hidden || backdropEl.style.display === 'none';
  if (notVisible || prefersReducedMotion()) {
    els.forEach(function (el) {
      el.classList.remove(OVERLAY_OUT_CLASS);
    });
    hide();
    return;
  }
  var closeId = (backdropEl._uiOverlayCloseId || 0) + 1;
  backdropEl._uiOverlayCloseId = closeId;
  els.forEach(function (el) {
    el.classList.add(OVERLAY_OUT_CLASS);
  });
  var settled = false;
  function settle() {
    if (settled) return;
    settled = true;
    backdropEl.removeEventListener('animationend', onEnd);
    if (backdropEl._uiOverlayCloseId !== closeId) return; // reabierto durante el cierre
    els.forEach(function (el) {
      el.classList.remove(OVERLAY_OUT_CLASS);
    });
    hide();
  }
  function onEnd(ev) {
    if (ev.target !== backdropEl) return;
    if (ev.animationName !== 'fade-out') return;
    settle();
  }
  backdropEl.addEventListener('animationend', onEnd);
  setTimeout(settle, 220);
}

export function setAsyncButtonLoading(btn, loading, opts) {
  if (!btn) return;
  opts = opts || {};
  var loadingText = opts.loadingText || 'Procesando…';
  var label = ensureButtonLabel(btn);
  if (loading) {
    if (!btn.dataset.uiMotionDefaultLabel) {
      btn.dataset.uiMotionDefaultLabel = captureButtonLabel(btn, label);
    }
    btn.classList.add('loading');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    if (!prefersReducedMotion()) ensureButtonSpinner(btn);
    swapLabelText(label, loadingText);
    return;
  }
  btn.classList.remove('loading');
  btn.removeAttribute('aria-busy');
  removeButtonSpinner(btn);
  if (!btn.dataset.rpcOffline) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  }
  var restore = btn.dataset.uiMotionDefaultLabel || captureButtonLabel(btn, label);
  swapLabelText(label, restore, { instant: true, force: true });
  delete btn.dataset.uiMotionDefaultLabel;
}
