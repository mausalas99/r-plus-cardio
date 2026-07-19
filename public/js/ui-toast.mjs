/** Stacked toast notifications (premium UI phase 0). */

import { prefersReducedMotion } from './ui-motion.mjs';

const MAX_TOASTS = 3;
const TOAST_MS = 3500;
const GLYPH = { success: '\u2713', error: '\u2715', warn: '!', info: '\u00b7' };

let nextId = 1;
const dismissTimers = new Map();

function normalizeToastType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'ok') return 'success';
  if (t === 'warning') return 'warn';
  if (t === 'success' || t === 'error' || t === 'warn' || t === 'info') return t;
  return '';
}

function ensureToastStack() {
  let stack = document.getElementById('toast-stack');
  if (stack) return stack;
  const legacy = document.getElementById('toast');
  stack = document.createElement('div');
  stack.id = 'toast-stack';
  stack.className = 'toast-stack';
  stack.setAttribute('role', 'status');
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-atomic', 'false');
  if (legacy && legacy.parentNode) {
    legacy.parentNode.replaceChild(stack, legacy);
  } else {
    document.body.appendChild(stack);
  }
  return stack;
}

function buildToastEl(msg, kind, id) {
  const el = document.createElement('div');
  el.className = 'toast toast--enter' + (kind ? ' ' + kind : '');
  el.dataset.toastId = String(id);
  el.tabIndex = -1;

  const glyph = document.createElement('span');
  glyph.className = 'toast-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = kind ? GLYPH[kind] || '' : '';

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = String(msg || '');

  if (kind) el.appendChild(glyph);
  el.appendChild(text);
  return el;
}

function removeToastEl(el, instant) {
  if (!el || !el.parentNode) return;
  const id = Number(el.dataset.toastId);
  if (dismissTimers.has(id)) {
    clearTimeout(dismissTimers.get(id));
    dismissTimers.delete(id);
  }
  if (instant || prefersReducedMotion()) {
    el.remove();
    return;
  }
  el.classList.remove('show', 'toast--enter');
  el.classList.add('toast--leave');
  function onEnd(ev) {
    if (ev.animationName !== 'toast-out') return;
    el.removeEventListener('animationend', onEnd);
    el.remove();
  }
  el.addEventListener('animationend', onEnd);
  setTimeout(function () {
    if (el.parentNode) el.remove();
  }, 320);
}

function trimToastStack(stack) {
  while (stack.children.length > MAX_TOASTS) {
    removeToastEl(stack.firstElementChild, true);
  }
}

/**
 * @param {string} msg
 * @param {'success'|'error'|'warn'|'info'|'ok'|''} [type]
 */
export function showToast(msg, type) {
  const stack = ensureToastStack();
  const kind = normalizeToastType(type);
  const id = nextId++;
  const el = buildToastEl(msg, kind, id);

  stack.appendChild(el);
  trimToastStack(stack);
  el.classList.add('show');
  if (!prefersReducedMotion()) {
    el.classList.add('toast--enter');
    function onEnterEnd() {
      el.removeEventListener('animationend', onEnterEnd);
      el.classList.remove('toast--enter');
    }
    el.addEventListener('animationend', onEnterEnd);
  }

  const timer = setTimeout(function () {
    removeToastEl(el, false);
  }, TOAST_MS);
  dismissTimers.set(id, timer);

  el.addEventListener('click', function () {
    removeToastEl(el, false);
  });
}
