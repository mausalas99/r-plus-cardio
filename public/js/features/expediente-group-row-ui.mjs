/**
 * Renders the grouped expediente nav row (#exp-group-row) from the pure model.
 * Wide windows only — CSS hides it <1100px and shows the classic two-level
 * bars instead, which stay fully synced by the existing code paths.
 * Selection goes through the existing window globals (switchConsolidatedTab /
 * switchInnerTab) so behavior is identical to the classic bars.
 */
import { buildGroupRowModel } from '../expediente-group-row.mjs';

var lastPointerType = 'mouse';
var touchExpandedGroup = null;
var resyncWired = false;

export function usesGroupedExpedienteRow() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('rpc-mobile-web')) {
    return true;
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(min-width: 1100px)').matches;
  }
  return false;
}

function rowEl() {
  return document.getElementById('exp-group-row');
}

export function renderExpedienteGroupRow(activeGranular, settings) {
  var row = rowEl();
  if (!row) return;
  if (!row._pointerWired) {
    row._pointerWired = true;
    row.addEventListener('pointerdown', function (ev) {
      lastPointerType = ev.pointerType || 'mouse';
    });
    row.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var names = Array.prototype.slice.call(row.querySelectorAll('.exp-group-name'));
      var idx = names.indexOf(document.activeElement);
      if (idx === -1) return;
      ev.preventDefault();
      var next = names[(idx + (ev.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length];
      if (next) next.focus();
    });
  }
  var model = buildGroupRowModel(activeGranular || 'todo', settings || {});
  row.textContent = '';
  model.forEach(function (group) {
    var pill = document.createElement('div');
    pill.className = 'exp-group-pill' + (group.active ? ' is-active' : '') + (group.leaf ? ' exp-group-pill--leaf' : '');
    if (!group.active && touchExpandedGroup === group.id) pill.classList.add('is-touch-expanded');
    pill.dataset.group = group.id;
    if (group.active && !group.leaf) pill.setAttribute('aria-label', group.label);

    var name = document.createElement('button');
    name.type = 'button';
    name.className = 'exp-group-name';
    name.setAttribute('aria-expanded', group.leaf ? 'false' : (group.active || touchExpandedGroup === group.id ? 'true' : 'false'));
    name.setAttribute('aria-current', group.active ? 'true' : 'false');
    name.textContent = group.label;
    name.addEventListener('click', function () {
      // Touch: first tap expands the pill, second tap (or a section tap) selects.
      if (lastPointerType === 'touch' && !group.active && touchExpandedGroup !== group.id) {
        touchExpandedGroup = group.id;
        renderExpedienteGroupRow(activeGranular, settings);
        return;
      }
      touchExpandedGroup = null;
      if (typeof window.switchConsolidatedTab === 'function') window.switchConsolidatedTab(group.id);
    });
    pill.appendChild(name);

    var sections = document.createElement('div');
    sections.className = 'exp-group-sections';
    var inner = document.createElement('div');
    inner.className = 'exp-group-sections-inner';
    group.sections.forEach(function (section) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exp-group-section' + (section.active ? ' is-active' : '');
      btn.dataset.section = section.id;
      btn.setAttribute('aria-pressed', section.active ? 'true' : 'false');
      btn.textContent = section.label;
      btn.addEventListener('click', function () {
        touchExpandedGroup = null;
        if (typeof window.switchInnerTab === 'function') window.switchInnerTab(section.id);
      });
      inner.appendChild(btn);
    });
    sections.appendChild(inner);
    pill.appendChild(sections);
    row.appendChild(pill);
  });
}

/** Re-sync classic bars/indicator when crossing the grouped-row breakpoint. */
export function wireGroupRowBreakpointResync(syncFn) {
  if (resyncWired || typeof window.matchMedia !== 'function') return;
  resyncWired = true;
  var mq = window.matchMedia('(min-width: 1100px)');
  var handler = function () {
    if (typeof syncFn === 'function') syncFn();
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler);
  else if (typeof mq.addListener === 'function') mq.addListener(handler);
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('rpc-mobile-web')) {
    handler();
  }
}
