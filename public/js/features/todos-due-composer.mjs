/** Pendientes — due-date composer for new todo row. */
import {
  formatTodoDueLabel,
  getTodoDuePresets,
  parseDuePreset,
} from '../todos-due.mjs';
import { openTodoDueModal } from '../todo-due-modal.mjs';

function syncDueAddSelection(state, toggleEl, selectionEl, presetBtns) {
  state.reminderAt = state.remindEnabled && state.dueDate ? state.dueDate : null;
  if (toggleEl) {
    toggleEl.textContent = 'Fecha límite';
    toggleEl.setAttribute(
      'aria-label',
      state.dueDate
        ? 'Cambiar fecha límite: ' + formatTodoDueLabel(state.dueDate)
        : 'Elegir fecha límite'
    );
  }
  if (selectionEl) {
    var label = state.dueDate ? formatTodoDueLabel(state.dueDate) : '';
    if (state.dueDate && state.remindEnabled) label += ' 🔔';
    selectionEl.textContent = label;
    selectionEl.hidden = !state.dueDate;
  }
  (presetBtns || []).forEach(function (btn) {
    var presetId = String(btn.dataset.preset || '');
    var fields = parseDuePreset(presetId);
    var active = !!(state.dueDate && fields.dueDate && state.dueDate === fields.dueDate);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyDuePresetToAddState(state, presetId, toggleEl, selectionEl, presetBtns) {
  var fields = parseDuePreset(presetId);
  state.dueDate = fields.dueDate;
  state.reminderAt = null;
  state.remindEnabled = false;
  syncDueAddSelection(state, toggleEl, selectionEl, presetBtns);
}

function wirePresetButton(btn, preset, ctx) {
  btn.type = 'button';
  btn.className = 'todo-due-preset-chip';
  btn.dataset.preset = preset.id;
  btn.textContent = preset.label;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', function () {
    if (ctx.state.dueDate) {
      var current = parseDuePreset(preset.id);
      if (current.dueDate && ctx.state.dueDate === current.dueDate) {
        ctx.state.dueDate = null;
        ctx.state.reminderAt = null;
        ctx.state.remindEnabled = false;
        syncDueAddSelection(ctx.state, ctx.toggle, ctx.selection, ctx.presetBtns);
        return;
      }
    }
    applyDuePresetToAddState(
      ctx.state,
      preset.id,
      ctx.toggle,
      ctx.selection,
      ctx.presetBtns
    );
  });
}

function rebuildPresetButtons(ctx) {
  ctx.presetsWrap.textContent = '';
  ctx.presetBtns.length = 0;
  getTodoDuePresets().forEach(function (preset) {
    var btn = document.createElement('button');
    wirePresetButton(btn, preset, ctx);
    ctx.presetsWrap.appendChild(btn);
    ctx.presetBtns.push(btn);
  });
  syncDueAddSelection(ctx.state, ctx.toggle, ctx.selection, ctx.presetBtns);
}

function ensureDuePresetsComposerListener(rebuild) {
  if (typeof document === 'undefined' || document._todoDuePresetsComposerWired) return;
  document._todoDuePresetsComposerWired = true;
  document.addEventListener('rpc-todo-due-presets-changed', rebuild);
}

export function createTodoDueAddSection(_idPrefix) {
  var state = { dueDate: null, reminderAt: null, remindEnabled: false };
  var section = document.createElement('div');
  section.className = 'todo-due-section';

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'todo-due-toggle';
  toggle.textContent = 'Fecha límite';
  toggle.setAttribute('aria-haspopup', 'dialog');

  var selection = document.createElement('span');
  selection.className = 'todo-due-selection';
  selection.hidden = true;

  var primary = document.createElement('div');
  primary.className = 'todo-due-section-primary';

  var presetsWrap = document.createElement('div');
  presetsWrap.className = 'todo-due-presets';
  presetsWrap.setAttribute('role', 'group');
  presetsWrap.setAttribute('aria-label', 'Fechas rápidas');

  var presetBtns = [];
  var ctx = { state: state, toggle: toggle, selection: selection, presetBtns: presetBtns, presetsWrap: presetsWrap };
  rebuildPresetButtons(ctx);
  ensureDuePresetsComposerListener(function () {
    rebuildPresetButtons(ctx);
  });

  toggle.addEventListener('click', function () {
    openTodoDueModal({
      dueDate: state.dueDate,
      remindEnabled: state.remindEnabled,
      onSave: function (fields) {
        state.dueDate = fields.dueDate;
        state.reminderAt = fields.reminderAt;
        state.remindEnabled = !!fields.remindEnabled;
        syncDueAddSelection(state, toggle, selection, presetBtns);
      },
    });
  });

  primary.appendChild(toggle);
  primary.appendChild(selection);
  section.appendChild(primary);
  section.appendChild(presetsWrap);

  return {
    element: section,
    getFields: function () {
      return { dueDate: state.dueDate, reminderAt: state.reminderAt };
    },
    reset: function () {
      state.dueDate = null;
      state.reminderAt = null;
      state.remindEnabled = false;
      syncDueAddSelection(state, toggle, selection, presetBtns);
    },
  };
}
