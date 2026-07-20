/**
 * Styled combobox for Manejo tipo/fármaco (replaces unstyled native datalist).
 * Menu is portaled to document.body so it stays opaque and flush to the input
 * (avoids overflow/stacking issues inside Manejo tables).
 */
import { escHtml, escAttr } from '../../dom-escape.mjs';

export const DIURETIC_DEFAULT_TIPOS = [
  'Furosemida',
  'Bumetanida',
  'Torasemida',
  'Espironolactona',
  'Metolazona',
];

var comboSeq = 0;
/** @type {WeakMap<Element, HTMLElement>} */
var menuByCombo = new WeakMap();

/**
 * @param {string[]} options
 * @param {{
 *   value?: string,
 *   placeholder?: string,
 *   attrs?: string,
 *   disabled?: boolean,
 * }} opts
 */
export function buildManejoComboHtml(options, opts) {
  var list = Array.isArray(options) ? options : [];
  var value = opts && opts.value != null ? String(opts.value) : '';
  var placeholder = (opts && opts.placeholder) || '';
  var attrs = (opts && opts.attrs) || '';
  var disabled = !!(opts && opts.disabled);
  var items = list
    .map(function (opt) {
      var v = String(opt || '').trim();
      if (!v) return '';
      return (
        '<li class="manejo-combo__option" role="option" data-manejo-combo-opt="' +
        escAttr(v) +
        '" tabindex="-1">' +
        escHtml(v) +
        '</li>'
      );
    })
    .filter(Boolean)
    .join('');

  return (
    '<div class="manejo-combo" data-manejo-combo="1">' +
    '<input type="text" class="ea-input manejo-combo__input" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" ' +
    attrs +
    ' value="' +
    escAttr(value) +
    '" placeholder="' +
    escAttr(placeholder) +
    '"' +
    (disabled ? ' disabled' : '') +
    '>' +
    '<button type="button" class="manejo-combo__toggle" data-manejo-combo-toggle tabindex="-1" aria-label="Ver opciones"' +
    (disabled ? ' disabled' : '') +
    '>' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6"/></svg></button>' +
    '<ul class="manejo-combo__menu" role="listbox" hidden data-manejo-combo-menu>' +
    items +
    '</ul></div>'
  );
}

/**
 * @param {string[]} catalogOpts
 * @param {'med' | 'diuretic'} kind
 */
export function mergeTipoOptions(catalogOpts, kind) {
  var seen = new Set();
  /** @type {string[]} */
  var out = [];
  function push(v) {
    var t = String(v || '').trim();
    if (!t) return;
    var key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  }
  (catalogOpts || []).forEach(push);
  if (kind === 'diuretic') DIURETIC_DEFAULT_TIPOS.forEach(push);
  return out;
}

/** Close any open Manejo combos (call before host innerHTML replace). */
export function closeAllManejoCombos() {
  document.querySelectorAll('[data-manejo-combo].is-open').forEach(function (combo) {
    closeCombo(combo);
  });
  document.querySelectorAll('body > [data-manejo-combo-menu]').forEach(function (menu) {
    menu.remove();
  });
}

/**
 * Wire combobox open/filter/select once on a Manejo mount host.
 * @param {HTMLElement} mount
 */
export function ensureManejoComboWired(mount) {
  if (!mount || mount.getAttribute('data-manejo-combo-wired') === '1') return;
  mount.setAttribute('data-manejo-combo-wired', '1');

  mount.addEventListener('click', function (ev) {
    var t = /** @type {HTMLElement} */ (ev.target);
    if (!t || !t.closest) return;

    var toggle = t.closest('[data-manejo-combo-toggle]');
    if (toggle) {
      var host = toggle.closest('[data-manejo-combo]');
      if (!host) return;
      ev.preventDefault();
      if (host.classList.contains('is-open')) closeCombo(host);
      else openCombo(host, '');
      return;
    }
  });

  mount.addEventListener('input', function (ev) {
    var input = /** @type {HTMLElement} */ (ev.target);
    if (!input || !input.classList || !input.classList.contains('manejo-combo__input')) return;
    var combo = input.closest('[data-manejo-combo]');
    if (!combo) return;
    openCombo(combo, /** @type {HTMLInputElement} */ (input).value);
  });

  mount.addEventListener('focusin', function (ev) {
    var input = /** @type {HTMLElement} */ (ev.target);
    if (!input || !input.classList || !input.classList.contains('manejo-combo__input')) return;
    var combo = input.closest('[data-manejo-combo]');
    if (combo) openCombo(combo, /** @type {HTMLInputElement} */ (input).value);
  });

  mount.addEventListener('keydown', function (ev) {
    var input = /** @type {HTMLElement} */ (ev.target);
    if (!input || !input.classList || !input.classList.contains('manejo-combo__input')) return;
    var combo = input.closest('[data-manejo-combo]');
    if (!combo) return;
    if (ev.key === 'Escape') {
      closeCombo(combo);
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      openCombo(combo, /** @type {HTMLInputElement} */ (input).value);
      var menu = menuByCombo.get(combo);
      var first = menu && menu.querySelector('.manejo-combo__option:not([hidden])');
      if (first instanceof HTMLElement) first.focus();
    }
  });

  document.addEventListener('click', function (ev) {
    var t = /** @type {Node} */ (ev.target);
    mount.querySelectorAll('[data-manejo-combo].is-open').forEach(function (combo) {
      var menu = menuByCombo.get(combo);
      if (combo.contains(t)) return;
      if (menu && menu.contains(t)) return;
      closeCombo(combo);
    });
  });

  document.addEventListener('click', function (ev) {
    var t = /** @type {HTMLElement} */ (ev.target);
    if (!t || !t.closest) return;
    var opt = t.closest('[data-manejo-combo-opt]');
    if (!opt) return;
    var menu = opt.closest('[data-manejo-combo-menu]');
    if (!menu) return;
    var ownerId = menu.getAttribute('data-manejo-combo-for');
    if (!ownerId) return;
    var combo = mount.querySelector('[data-manejo-combo-id="' + ownerId + '"]');
    if (!combo || !mount.contains(combo)) return;
    var input = combo.querySelector('.manejo-combo__input');
    if (input && !/** @type {HTMLInputElement} */ (input).disabled) {
      /** @type {HTMLInputElement} */ (input).value = opt.getAttribute('data-manejo-combo-opt') || '';
      /** @type {HTMLInputElement} */ (input).dispatchEvent(new Event('change', { bubbles: true }));
      closeCombo(combo);
      /** @type {HTMLInputElement} */ (input).focus();
    }
  });

  window.addEventListener(
    'scroll',
    function () {
      mount.querySelectorAll('[data-manejo-combo].is-open').forEach(function (combo) {
        var menu = menuByCombo.get(combo);
        if (menu) positionComboMenu(combo, menu);
      });
    },
    true
  );

  window.addEventListener('resize', function () {
    mount.querySelectorAll('[data-manejo-combo].is-open').forEach(function (combo) {
      var menu = menuByCombo.get(combo);
      if (menu) positionComboMenu(combo, menu);
    });
  });
}

/** @param {Element | null} combo @param {string} query */
function openCombo(combo, query) {
  if (!combo) return;
  closeOtherCombos(combo);
  var menu = resolveMenu(combo);
  var input = /** @type {HTMLInputElement | null} */ (combo.querySelector('.manejo-combo__input'));
  if (!menu || !input) return;
  var q = String(query || '')
    .trim()
    .toLowerCase();
  var visible = 0;
  menu.querySelectorAll('[data-manejo-combo-opt]').forEach(function (li) {
    var v = String(li.getAttribute('data-manejo-combo-opt') || '').toLowerCase();
    var show = !q || v.indexOf(q) >= 0;
    /** @type {HTMLElement} */ (li).hidden = !show;
    if (show) visible += 1;
  });
  if (visible === 0) {
    closeCombo(combo);
    return;
  }
  if (menu.parentElement !== document.body) {
    document.body.appendChild(menu);
  }
  menu.hidden = false;
  combo.classList.add('is-open');
  input.setAttribute('aria-expanded', 'true');
  positionComboMenu(combo, menu);
}

/** @param {Element} combo */
function closeOtherCombos(combo) {
  document.querySelectorAll('[data-manejo-combo].is-open').forEach(function (other) {
    if (other !== combo) closeCombo(other);
  });
}

/** @param {Element} combo @returns {HTMLElement | null} */
function resolveMenu(combo) {
  var cached = menuByCombo.get(combo);
  if (cached) return cached;
  var menu = /** @type {HTMLElement | null} */ (combo.querySelector('[data-manejo-combo-menu]'));
  if (!menu) return null;
  var id = combo.getAttribute('data-manejo-combo-id');
  if (!id) {
    comboSeq += 1;
    id = 'mc' + comboSeq;
    combo.setAttribute('data-manejo-combo-id', id);
  }
  menu.setAttribute('data-manejo-combo-for', id);
  menuByCombo.set(combo, menu);
  return menu;
}

/**
 * Flush under (or above) the input; solid inline paint for Electron.
 * @param {Element} combo
 * @param {HTMLElement} menu
 */
function positionComboMenu(combo, menu) {
  var anchor =
    /** @type {HTMLElement | null} */ (combo.querySelector('.manejo-combo__input')) ||
    /** @type {HTMLElement} */ (combo);
  var rect = anchor.getBoundingClientRect();
  var maxH = 192;
  var gap = 2;
  var spaceBelow = window.innerHeight - rect.bottom - gap;
  var openUp = spaceBelow < 120 && rect.top > spaceBelow;
  var heightBudget = Math.min(maxH, Math.max(80, openUp ? rect.top - gap : spaceBelow));

  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  menu.style.left = Math.round(rect.left) + 'px';
  menu.style.width = Math.max(8, Math.round(rect.width)) + 'px';
  menu.style.right = 'auto';
  menu.style.maxHeight = heightBudget + 'px';
  menu.style.margin = '0';
  menu.style.opacity = '1';
  menu.style.backgroundColor = document.documentElement.classList.contains('dark')
    ? '#161922'
    : '#f5f4f0';
  menu.style.backgroundImage = 'none';
  menu.style.color = document.documentElement.classList.contains('dark') ? '#e6eaf0' : '#1a1c22';
  menu.style.border = document.documentElement.classList.contains('dark')
    ? '1px solid rgba(148, 163, 184, 0.35)'
    : '1px solid rgba(26, 28, 34, 0.16)';
  menu.style.borderRadius = '8px';
  menu.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.55)';
  menu.style.padding = '4px';
  menu.style.listStyle = 'none';
  menu.style.overflowY = 'auto';
  menu.style.boxSizing = 'border-box';

  if (openUp) {
    menu.style.top = 'auto';
    menu.style.bottom = Math.round(window.innerHeight - rect.top + gap) + 'px';
  } else {
    menu.style.bottom = 'auto';
    menu.style.top = Math.round(rect.bottom + gap) + 'px';
  }
}

/** @param {Element | null} combo */
function closeCombo(combo) {
  if (!combo) return;
  var menu = menuByCombo.get(combo) || combo.querySelector('[data-manejo-combo-menu]');
  var input = /** @type {HTMLInputElement | null} */ (combo.querySelector('.manejo-combo__input'));
  if (menu) {
    /** @type {HTMLElement} */ (menu).hidden = true;
    [
      'position',
      'left',
      'right',
      'top',
      'bottom',
      'width',
      'maxHeight',
      'zIndex',
      'margin',
      'opacity',
      'backgroundColor',
      'backgroundImage',
      'color',
      'border',
      'borderRadius',
      'boxShadow',
      'padding',
      'listStyle',
      'overflowY',
      'boxSizing',
    ].forEach(function (prop) {
      /** @type {HTMLElement} */ (menu).style[prop] = '';
    });
    if (menu.parentElement === document.body) {
      combo.appendChild(menu);
    }
  }
  combo.classList.remove('is-open');
  if (input) input.setAttribute('aria-expanded', 'false');
}
