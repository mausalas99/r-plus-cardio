/**
 * Cierre unificado de ventanas modales: Escape y clic en el fondo (backdrop).
 * Las capas se evalúan en orden inverso al registro (la última registrada gana).
 */

/** @param {HTMLElement|null|undefined} el */
export function isRpcOverlayVisible(el) {
  if (!el || !el.isConnected) return false;
  var cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  var op = parseFloat(cs.opacity);
  if (!Number.isNaN(op) && op <= 0) return false;
  return true;
}

/** @param {HTMLElement|null|undefined} el */
export function getOverlayZIndex(el) {
  if (!el || !isRpcOverlayVisible(el)) return -1;
  var z = parseInt(window.getComputedStyle(el).zIndex, 10);
  return Number.isNaN(z) ? 0 : z;
}

/** @param {HTMLElement} backdrop @param {string|undefined} panelSelector */
export function getDismissPanel(backdrop, panelSelector) {
  if (panelSelector) {
    var custom = backdrop.querySelector(panelSelector);
    if (custom) return custom;
  }
  return (
    backdrop.querySelector('[role="dialog"]') ||
    backdrop.querySelector('.modal') ||
    null
  );
}

/** @param {HTMLElement} backdrop @param {string|undefined} panelSelector @param {EventTarget|null} target */
export function isBackdropOutsideClick(backdrop, panelSelector, target) {
  if (target == null || typeof target !== 'object') return false;
  if (typeof backdrop.contains !== 'function' || !backdrop.contains(target)) return false;
  if (target === backdrop) return true;
  var panel = getDismissPanel(backdrop, panelSelector);
  if (!panel) return target === backdrop;
  return !panel.contains(target);
}

export function bindBackdropDismiss(backdropEl, requestClose, panelSelector) {
  if (!backdropEl || backdropEl.dataset.rpcBackdropDismiss === '2') return;
  backdropEl.dataset.rpcBackdropDismiss = '2';
  var selector = panelSelector || '.modal, [role="dialog"]';
  backdropEl.addEventListener('click', function (ev) {
    var panel = backdropEl.querySelector(selector);
    if (panel && panel.contains(ev.target)) return;
    requestClose();
  });
}

export function createModalDismissRegistry() {
  /** @type {Array<{ isOpen: () => boolean, close: () => void, confirmClose?: () => boolean, backdropEl?: () => (HTMLElement|null), panelSelector?: string }>} */
  var layers = [];
  var globalWired = false;

  function register(layer) {
    layers.push(layer);
  }

  function tryCloseLayer(layer, ev) {
    if (!layer.isOpen()) return false;
    if (layer.confirmClose && layer.confirmClose() === false) return true;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    layer.close();
    return true;
  }

  function closeTopmost(ev) {
    for (var i = layers.length - 1; i >= 0; i--) {
      if (tryCloseLayer(layers[i], ev)) return true;
    }
    return false;
  }

  function onKeydown(ev) {
    if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
    closeTopmost(ev);
  }

  function init() {
    if (globalWired) return;
    globalWired = true;
    document.addEventListener('keydown', onKeydown, true);
    layers.forEach(function (layer) {
      if (!layer.backdropEl) return;
      var el = layer.backdropEl();
      if (!el) return;
      bindBackdropDismiss(el, function () {
        tryCloseLayer(layer, null);
      }, layer.panelSelector);
    });
  }

  return { register, init, closeTopmost, bindBackdropDismiss };
}
