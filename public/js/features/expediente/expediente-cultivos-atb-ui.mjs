// Cultivos antibiogram hover panels + cell HTML
import { labHistory } from '../../app-state.mjs';
import {
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
} from '../../labs.js';
import { esc } from './expediente-runtime.mjs';

export function buildCultivoAntibiogramCellHtmlForPatient(r, patientId) {
  if (!patientId) return '<pre class="cultivos-atb-fallback">—</pre>';
  var sets = labHistory[patientId] || [];
  var set = sets.find(function (s) {
    return String(s.id) === String(r.labSetId);
  });
  var sens =
    set && set.sourceText ? extractSensCrudasForGermFromSource(set.sourceText, r.organismo) : null;
  var copyBtn =
    set && r.labSetId != null && String(r.labSetId) !== ''
      ? '<button type="button" class="cultivos-copy-full-btn" onclick=\'copyCultivoCondensado(' +
        JSON.stringify(String(r.labSetId)) +
        ',' +
        JSON.stringify(String(r.organismo || '')) +
        ')\'>Copiar informe completo</button>'
      : '';
  if (sens && sens.length) {
    return (
      '<div class="cultivos-atb-wrap">' +
      '<div class="cultivos-atb-chips" role="list">' +
      buildAtbRisSummaryHtml(sens) +
      '</div>' +
      copyBtn +
      '</div>'
    );
  }
  return (
    '<div class="cultivos-atb-wrap">' +
    '<pre class="cultivos-atb-fallback">' +
    esc(r.resistencias || r.risSummary || '—') +
    '</pre>' +
    copyBtn +
    '</div>'
  );
}

var _atbRisScrollResizeWired = false;
var _atbRisScrollRootsWired = new WeakSet();
var _atbRisDelegatedHoverRoots = new WeakSet();
var ATB_RIS_HIDE_DELAY_MS = 140;

function ensureAtbRisScrollRepositionOn(el) {
  if (!el || _atbRisScrollRootsWired.has(el)) return;
  _atbRisScrollRootsWired.add(el);
  el.addEventListener('scroll', repositionOpenAtbRisPanel, { passive: true });
}

function cancelHideAtbPanel(panel) {
  if (!panel || !panel._atbHideTid) return;
  clearTimeout(panel._atbHideTid);
  panel._atbHideTid = null;
}

function scheduleHideAtbPanel(panel) {
  if (!panel) return;
  cancelHideAtbPanel(panel);
  panel._atbHideTid = setTimeout(function () {
    panel._atbHideTid = null;
    hideAtbRisHoverPanel(panel);
  }, ATB_RIS_HIDE_DELAY_MS);
}

function panelAtbRisForWrap(wrap) {
  return wrap.querySelector('.atb-ris-hover-panel') || wrap._atbRisPanelEl || null;
}

function hideAtbRisHoverPanel(panel) {
  if (!panel) return;
  cancelHideAtbPanel(panel);
  panel.classList.remove('is-open');
  panel.style.left = '';
  panel.style.top = '';
  panel.style.visibility = '';
  var wrap = panel._atbRisOwnerWrap;
  if (wrap) {
    wrap._atbRisPanelEl = null;
  }
  panel._atbRisOwnerWrap = null;
  if (wrap && wrap.isConnected) {
    wrap.appendChild(panel);
  } else if (panel.parentNode === document.body) {
    panel.remove();
  }
}

function closeAtbRisPanelsExcept(exceptWrap) {
  document.querySelectorAll('.atb-ris-hover-panel.is-open').forEach(function (panel) {
    var w = panel._atbRisOwnerWrap || panel.closest('.cult-atb-ris-chip-wrap');
    if (w !== exceptWrap) hideAtbRisHoverPanel(panel);
  });
}

function repositionOpenAtbRisPanel() {
  var panel = document.querySelector('.atb-ris-hover-panel.is-open');
  if (!panel) return;
  var wrap = panel._atbRisOwnerWrap || panel.closest('.cult-atb-ris-chip-wrap');
  if (wrap) positionAtbRisHoverPanel(wrap);
}

function positionAtbRisHoverPanel(wrap) {
  var panel = panelAtbRisForWrap(wrap);
  var chip = wrap.querySelector('.atb-chip');
  if (!panel || !chip) return;
  closeAtbRisPanelsExcept(wrap);
  cancelHideAtbPanel(panel);
  panel._atbRisOwnerWrap = wrap;
  wrap._atbRisPanelEl = panel;
  if (panel.parentNode !== document.body) {
    document.body.appendChild(panel);
  }
  panel.classList.add('is-open');
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px';
  panel.style.top = '0';
  void panel.offsetWidth;
  var chipRect = chip.getBoundingClientRect();
  var pr = panel.getBoundingClientRect();
  var pw = pr.width;
  var ph = pr.height;
  var margin = 8;
  var gap = 1;
  var vh = window.innerHeight;
  var vw = window.innerWidth;
  var top = chipRect.bottom + gap;
  if (top + ph > vh - margin) {
    var aboveTop = chipRect.top - gap - ph;
    if (aboveTop >= margin) top = aboveTop;
    else top = Math.max(margin, vh - margin - ph);
  }
  var left = chipRect.left;
  if (left + pw > vw - margin) left = vw - margin - pw;
  if (left < margin) left = margin;
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  panel.style.visibility = '';
  panel.style.zIndex = '';
}

function wireAtbRisPanelHoverListeners(panel) {
  if (panel._atbRisPanelHoverListeners) return;
  panel._atbRisPanelHoverListeners = true;
  panel.addEventListener('mouseenter', function () {
    cancelHideAtbPanel(panel);
  });
  panel.addEventListener('mouseleave', function (ev) {
    var w = panel._atbRisOwnerWrap || panel.closest('.cult-atb-ris-chip-wrap');
    var toEl = ev.relatedTarget;
    if (toEl && w && (w.contains(toEl) || panel.contains(toEl))) return;
    scheduleHideAtbPanel(panel);
  });
}

function wireAtbRisHoverPanels(rootEl) {
  if (!rootEl) return;
  if (!_atbRisScrollResizeWired) {
    _atbRisScrollResizeWired = true;
    window.addEventListener('scroll', repositionOpenAtbRisPanel, true);
    window.addEventListener('resize', repositionOpenAtbRisPanel);
  }
  ensureAtbRisScrollRepositionOn(rootEl);
  var tableWrap = rootEl.querySelector && rootEl.querySelector('.cultivos-table-wrap');
  if (tableWrap) ensureAtbRisScrollRepositionOn(tableWrap);
  var cultTab = document.getElementById('itab-content-cult');
  if (cultTab) ensureAtbRisScrollRepositionOn(cultTab);
  if (!_atbRisDelegatedHoverRoots.has(rootEl)) {
    _atbRisDelegatedHoverRoots.add(rootEl);
    rootEl.addEventListener('mouseover', function (ev) {
      var t = ev.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || !t.closest) return;
      var wrap = t.classList.contains('cult-atb-ris-chip-wrap')
        ? t
        : t.closest('.cult-atb-ris-chip-wrap');
      if (!wrap || !rootEl.contains(wrap)) return;
      var p = panelAtbRisForWrap(wrap);
      if (p) cancelHideAtbPanel(p);
      positionAtbRisHoverPanel(wrap);
    });
    rootEl.addEventListener('mouseout', function (ev) {
      var t = ev.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || !t.closest) return;
      var wrap = t.classList.contains('cult-atb-ris-chip-wrap')
        ? t
        : t.closest('.cult-atb-ris-chip-wrap');
      if (!wrap || !rootEl.contains(wrap)) return;
      var p = panelAtbRisForWrap(wrap);
      if (!p) return;
      var toEl = ev.relatedTarget;
      if (toEl && (wrap.contains(toEl) || p.contains(toEl))) return;
      scheduleHideAtbPanel(p);
    });
    rootEl.addEventListener('focusin', function (ev) {
      var t = ev.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || !t.closest) return;
      var wrap = t.classList.contains('cult-atb-ris-chip-wrap')
        ? t
        : t.closest('.cult-atb-ris-chip-wrap');
      if (!wrap || !rootEl.contains(wrap)) return;
      var p = panelAtbRisForWrap(wrap);
      if (p) cancelHideAtbPanel(p);
      positionAtbRisHoverPanel(wrap);
    });
    rootEl.addEventListener('focusout', function (ev) {
      var t = ev.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || !t.closest) return;
      var wrap = t.classList.contains('cult-atb-ris-chip-wrap')
        ? t
        : t.closest('.cult-atb-ris-chip-wrap');
      if (!wrap || !rootEl.contains(wrap)) return;
      var p = panelAtbRisForWrap(wrap);
      if (!p) return;
      var rel = ev.relatedTarget;
      if (rel && (wrap.contains(rel) || p.contains(rel))) return;
      hideAtbRisHoverPanel(p);
    });
  }
  rootEl.querySelectorAll('.atb-ris-hover-panel').forEach(wireAtbRisPanelHoverListeners);
}

/** Paneles portados a body al abrir; quitar antes de sustituir innerHTML del contenedor. */
function removeAtbRisPanelsFromBody() {
  document.querySelectorAll('body > .atb-ris-hover-panel').forEach(function (p) {
    hideAtbRisHoverPanel(p);
  });
}

export { wireAtbRisHoverPanels, removeAtbRisPanelsFromBody };
