import { mountRpcDatetimeInput } from './rpc-date-picker.mjs';
import {
  addTodoDuePreset,
  deleteTodoDuePreset,
  formatTodoDuePresetAutoLabel,
  getTodoDuePresets,
  isoToDatetimeLocalValue,
  parseDatetimeLocalToIso,
  parseDuePreset,
  resetTodoDuePresetOverrides,
  resolveTodoDuePresetDef,
  saveTodoDuePresetOverrides,
  syncTodoDuePresetsFromEditRows,
} from './todos-due.mjs';

/** @type {((fields: { dueDate: string|null, reminderAt: string|null, remindEnabled: boolean }) => void)|null} */
var onSaveCallback = null;

var dismissWired = false;
var presetEditOpen = false;

function getBackdrop() {
  return document.getElementById('todo-due-modal-backdrop');
}

function getDatetimeInput() {
  return /** @type {HTMLInputElement|null} */ (document.getElementById('todo-due-modal-datetime'));
}

function getRemindInput() {
  return /** @type {HTMLInputElement|null} */ (document.getElementById('todo-due-modal-remind'));
}

function getPresetsMount() {
  return document.getElementById('todo-due-modal-presets');
}

function getPresetEditPanel() {
  return document.getElementById('todo-due-modal-preset-edit');
}

function getPresetEditRows() {
  return document.getElementById('todo-due-modal-preset-edit-rows');
}

function closeTodoDueModal() {
  var backdrop = getBackdrop();
  if (!backdrop) return;
  setPresetEditOpen(false);
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  onSaveCallback = null;
}

function readModalFields() {
  var datetimeInput = getDatetimeInput();
  var remindInput = getRemindInput();
  var dueDate = datetimeInput ? parseDatetimeLocalToIso(datetimeInput.value) : null;
  var remindEnabled = !!(remindInput && remindInput.checked && dueDate);
  return {
    dueDate: dueDate,
    reminderAt: remindEnabled ? dueDate : null,
    remindEnabled: remindEnabled,
  };
}

function saveTodoDueModal() {
  var fields = readModalFields();
  if (!fields.dueDate) {
    var datetimeInput = getDatetimeInput();
    if (datetimeInput) datetimeInput.focus();
    return;
  }
  if (onSaveCallback) onSaveCallback(fields);
  closeTodoDueModal();
}

function clearTodoDueModal() {
  if (onSaveCallback) {
    onSaveCallback({ dueDate: null, reminderAt: null, remindEnabled: false });
  }
  closeTodoDueModal();
}

function setPresetEditOpen(open) {
  presetEditOpen = !!open;
  var panel = getPresetEditPanel();
  var presets = getPresetsMount();
  var zone = document.getElementById('todo-due-modal-presets-zone');
  var editBtn = document.getElementById('todo-due-edit-presets-btn');
  var resetBtn = document.getElementById('todo-due-reset-presets-btn');
  if (panel) panel.hidden = !presetEditOpen;
  if (presets) presets.hidden = presetEditOpen;
  if (zone) zone.classList.toggle('is-editing', presetEditOpen);
  if (editBtn) editBtn.textContent = presetEditOpen ? 'Listo' : 'Editar';
  if (editBtn) editBtn.setAttribute('aria-expanded', presetEditOpen ? 'true' : 'false');
  if (resetBtn) resetBtn.hidden = !presetEditOpen;
  if (presetEditOpen) renderPresetEditRows();
  else renderModalPresetChips();
}

function applyPresetToModal(presetId) {
  var fields = parseDuePreset(presetId);
  var datetimeInput = getDatetimeInput();
  if (!fields.dueDate || !datetimeInput) return;
  datetimeInput.value = isoToDatetimeLocalValue(fields.dueDate);
  datetimeInput.dispatchEvent(new CustomEvent('rpc-datetime-sync'));
  var remindInput = getRemindInput();
  if (remindInput) remindInput.disabled = false;
  syncModalPresetActiveState(fields.dueDate);
}

function syncModalPresetActiveState(dueDate) {
  var backdrop = getBackdrop();
  if (!backdrop) return;
  backdrop.querySelectorAll('.todo-due-preset-chip[data-preset]').forEach(function (btn) {
    var fields = parseDuePreset(String(btn.dataset.preset || ''));
    var active = !!(dueDate && fields.dueDate && dueDate === fields.dueDate);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderModalPresetChips() {
  var mount = getPresetsMount();
  if (!mount) return;
  mount.textContent = '';
  getTodoDuePresets().forEach(function (preset) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'todo-due-preset-chip';
    btn.dataset.preset = preset.id;
    btn.textContent = preset.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      applyPresetToModal(preset.id);
    });
    mount.appendChild(btn);
  });
}

function isCustomPresetRowId(id) {
  return String(id || '').indexOf('custom-') === 0;
}

function presetModeValue(preset) {
  if (preset.kind === 'dayTime') return preset.dayOffset === 1 ? 'tomorrow' : 'today';
  return 'offset';
}

function readRowValueSnapshot(row) {
  var timeInput = row.querySelector('.todo-due-preset-time-input');
  var hoursInput = row.querySelector('.todo-due-preset-hours-input');
  var hour = 18;
  var minute = 0;
  var hours = 6;
  if (timeInput instanceof HTMLInputElement) {
    var parts = String(timeInput.value || '').split(':');
    hour = Number(parts[0]);
    minute = Number(parts[1]);
  }
  if (hoursInput instanceof HTMLInputElement) hours = Number(hoursInput.value);
  return { hour: hour, minute: minute, hours: hours };
}

function appendPresetHoursInput(valueWrap, values) {
  var hoursWrap = document.createElement('label');
  hoursWrap.className = 'todo-due-preset-hours-wrap';
  var hoursInput = document.createElement('input');
  hoursInput.type = 'number';
  hoursInput.min = '1';
  hoursInput.max = '168';
  hoursInput.step = '1';
  hoursInput.className = 'todo-due-preset-hours-input';
  hoursInput.value = String(values.hours != null ? values.hours : 6);
  hoursInput.setAttribute('aria-label', 'Horas de desplazamiento');
  var hoursSuffix = document.createElement('span');
  hoursSuffix.className = 'todo-due-preset-hours-suffix';
  hoursSuffix.textContent = 'h';
  hoursWrap.appendChild(hoursInput);
  hoursWrap.appendChild(hoursSuffix);
  valueWrap.appendChild(hoursWrap);
}

function appendPresetTimeInput(valueWrap, values, dayOffset) {
  var timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'todo-due-preset-time-input';
  var hour = values.hour != null ? values.hour : 18;
  var minute = values.minute != null ? values.minute : 0;
  timeInput.value =
    String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  timeInput.setAttribute('aria-label', dayOffset === 1 ? 'Hora mañana' : 'Hora hoy');
  valueWrap.appendChild(timeInput);
}

function rebuildRowValueInput(row, mode, values) {
  var valueWrap = row.querySelector('.todo-due-preset-value');
  if (!valueWrap) return;
  valueWrap
    .querySelectorAll('.todo-due-preset-time-input, .todo-due-preset-hours-wrap')
    .forEach(function (node) {
      node.remove();
    });
  if (mode === 'offset') appendPresetHoursInput(valueWrap, values);
  else appendPresetTimeInput(valueWrap, values, mode === 'tomorrow' ? 1 : 0);
}

function buildPresetModeSelect(preset, row) {
  var select = document.createElement('select');
  select.className = 'todo-due-preset-mode-select';
  select.setAttribute('aria-label', 'Tipo de atajo');
  [
    { value: 'offset', label: 'En' },
    { value: 'today', label: 'Hoy' },
    { value: 'tomorrow', label: 'Mañana' },
  ].forEach(function (opt) {
    var option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
  select.value = presetModeValue(preset);
  select.addEventListener('change', function () {
    rebuildRowValueInput(row, select.value, readRowValueSnapshot(row));
  });
  return select;
}

function readVisiblePresetRowIds() {
  var rows = getPresetEditRows();
  if (!rows) return [];
  /** @type {string[]} */
  var ids = [];
  rows.querySelectorAll('.todo-due-preset-edit-row').forEach(function (row) {
    var id = String(row.dataset.presetId || '');
    if (id) ids.push(id);
  });
  return ids;
}

function readPresetRowLabel(row) {
  var labelInput = row.querySelector('.todo-due-preset-label-input');
  return labelInput instanceof HTMLInputElement ? String(labelInput.value || '').trim() : '';
}

function readPresetRowMode(row, def) {
  var modeSelect = row.querySelector('.todo-due-preset-mode-select');
  return modeSelect instanceof HTMLSelectElement ? modeSelect.value : presetModeValue(def);
}

function buildDayTimePatchFromRow(row, def, dayOffset) {
  var timeInput = row.querySelector('.todo-due-preset-time-input');
  var fallback = String(def.hour).padStart(2, '0') + ':' + String(def.minute).padStart(2, '0');
  var parts = String(timeInput instanceof HTMLInputElement ? timeInput.value : fallback).split(':');
  return {
    kind: 'dayTime',
    dayOffset: dayOffset,
    hour: Number(parts[0]),
    minute: Number(parts[1]),
  };
}

function patchFromPresetEditRow(row, id, def) {
  var patch = { label: readPresetRowLabel(row) };
  if (isCustomPresetRowId(id)) patch.custom = true;
  var mode = readPresetRowMode(row, def);
  var modeSelect = row.querySelector('.todo-due-preset-mode-select');
  if (mode === 'today' || (def.kind === 'dayTime' && def.dayOffset === 0 && !modeSelect)) {
    return Object.assign(patch, buildDayTimePatchFromRow(row, def, 0));
  }
  if (mode === 'tomorrow' || (def.kind === 'dayTime' && def.dayOffset === 1 && !modeSelect)) {
    return Object.assign(patch, buildDayTimePatchFromRow(row, def, 1));
  }
  var hoursInput = row.querySelector('.todo-due-preset-hours-input');
  patch.kind = 'offsetHours';
  patch.hours = hoursInput instanceof HTMLInputElement ? Number(hoursInput.value) : Number(def.hours || 6);
  return patch;
}

function readPresetEditRowsIntoPatch() {
  /** @type {Record<string, Record<string, unknown>>} */
  var patchById = {};
  var rows = getPresetEditRows();
  if (!rows) return patchById;
  rows.querySelectorAll('.todo-due-preset-edit-row').forEach(function (row) {
    var id = String(row.dataset.presetId || '');
    if (!id) return;
    var def = resolveTodoDuePresetDef(id);
    if (!def) return;
    patchById[id] = patchFromPresetEditRow(row, id, def);
  });
  return patchById;
}

function removePresetShortcut(presetId) {
  deleteTodoDuePreset(presetId);
  renderPresetEditRows();
  renderModalPresetChips();
  syncModalPresetActiveState(readModalFields().dueDate);
}

function focusPresetRowLabel(presetId) {
  var container = getPresetEditRows();
  if (!container) return;
  var row = container.querySelector('.todo-due-preset-edit-row[data-preset-id="' + presetId + '"]');
  var labelInput = row && row.querySelector('.todo-due-preset-label-input');
  if (labelInput instanceof HTMLInputElement) {
    labelInput.focus();
    labelInput.select();
  }
}

function addPresetShortcut(options) {
  var patch = readPresetEditRowsIntoPatch();
  if (Object.keys(patch).length) saveTodoDuePresetOverrides(patch);
  var preset = addTodoDuePreset(options || { hours: 6 });
  renderPresetEditRows();
  renderModalPresetChips();
  focusPresetRowLabel(preset.id);
}

function renderPresetEditRows() {
  var container = getPresetEditRows();
  if (!container) return;
  container.textContent = '';
  var presets = getTodoDuePresets();
  if (!presets.length) {
    var empty = document.createElement('p');
    empty.className = 'todo-due-preset-edit-empty';
    empty.textContent = 'Sin atajos. Agrega uno o usa Restablecer para los predeterminados.';
    container.appendChild(empty);
    return;
  }
  presets.forEach(function (preset) {
    var row = document.createElement('div');
    var isCustom = isCustomPresetRowId(preset.id);
    row.className = 'todo-due-preset-edit-row' + (isCustom ? ' todo-due-preset-edit-row--custom' : '');
    row.dataset.presetId = preset.id;
    row.dataset.presetKind = preset.kind;

    var labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'todo-due-preset-label-input';
    labelInput.placeholder = formatTodoDuePresetAutoLabel(preset);
    labelInput.value = preset.label || formatTodoDuePresetAutoLabel(preset);
    labelInput.setAttribute('aria-label', 'Nombre del atajo');
    row.appendChild(labelInput);

    var valueWrap = document.createElement('div');
    valueWrap.className =
      'todo-due-preset-value todo-due-preset-value--' +
      (preset.kind === 'offsetHours' ? 'hours' : 'time') +
      (isCustom ? ' todo-due-preset-value--custom' : '');

    row.appendChild(valueWrap);
    if (isCustom) {
      valueWrap.appendChild(buildPresetModeSelect(preset, row));
      rebuildRowValueInput(row, presetModeValue(preset), {
        hour: preset.hour,
        minute: preset.minute,
        hours: preset.hours,
      });
    } else if (preset.kind === 'dayTime') {
      appendPresetTimeInput(valueWrap, preset, preset.dayOffset);
    } else {
      appendPresetHoursInput(valueWrap, preset);
    }

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'todo-due-preset-delete';
    delBtn.setAttribute('aria-label', 'Eliminar atajo');
    delBtn.title = 'Eliminar atajo';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function () {
      removePresetShortcut(preset.id);
    });
    row.appendChild(delBtn);

    container.appendChild(row);
  });
}

function savePresetEditRows() {
  syncTodoDuePresetsFromEditRows(readPresetEditRowsIntoPatch(), {
    visibleRowIds: readVisiblePresetRowIds(),
  });
  renderModalPresetChips();
  var fields = readModalFields();
  syncModalPresetActiveState(fields.dueDate);
}

function wireTodoDueModal() {
  if (dismissWired) return;
  dismissWired = true;

  var backdrop = getBackdrop();
  if (!backdrop) return;

  backdrop.addEventListener('click', function (ev) {
    if (!backdrop.classList.contains('open')) return;
    if (ev.target !== backdrop) return;
    closeTodoDueModal();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
    var bd = getBackdrop();
    if (!bd || !bd.classList.contains('open')) return;
    if (presetEditOpen) {
      savePresetEditRows();
      setPresetEditOpen(false);
      ev.preventDefault();
      return;
    }
    closeTodoDueModal();
    ev.preventDefault();
  });

  var cancelBtn = document.getElementById('todo-due-modal-cancel');
  var clearBtn = document.getElementById('todo-due-modal-clear');
  var saveBtn = document.getElementById('todo-due-modal-save');
  if (cancelBtn) cancelBtn.addEventListener('click', closeTodoDueModal);
  if (clearBtn) clearBtn.addEventListener('click', clearTodoDueModal);
  if (saveBtn) saveBtn.addEventListener('click', saveTodoDueModal);

  var editBtn = document.getElementById('todo-due-edit-presets-btn');
  if (editBtn) {
    editBtn.addEventListener('click', function () {
      if (presetEditOpen) {
        savePresetEditRows();
        setPresetEditOpen(false);
        return;
      }
      setPresetEditOpen(true);
    });
  }

  var resetBtn = document.getElementById('todo-due-reset-presets-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      resetTodoDuePresetOverrides();
      renderPresetEditRows();
      renderModalPresetChips();
      syncModalPresetActiveState(readModalFields().dueDate);
    });
  }

  var addOffsetBtn = document.getElementById('todo-due-add-preset-offset-btn');
  var addTimeBtn = document.getElementById('todo-due-add-preset-time-btn');
  if (addOffsetBtn) {
    addOffsetBtn.addEventListener('click', function () {
      addPresetShortcut({ kind: 'offsetHours', hours: 6 });
    });
  }
  if (addTimeBtn) {
    addTimeBtn.addEventListener('click', function () {
      addPresetShortcut({ kind: 'dayTime', dayOffset: 0, hour: 18, minute: 0 });
    });
  }
}

function ensureDatetimeMounted() {
  var datetimeInput = getDatetimeInput();
  if (!datetimeInput) return;
  mountRpcDatetimeInput(datetimeInput);
}

/**
 * @param {{
 *   dueDate?: string|null,
 *   remindEnabled?: boolean,
 *   onSave: (fields: { dueDate: string|null, reminderAt: string|null, remindEnabled: boolean }) => void,
 * }} opts
 */
export function openTodoDueModal(opts) {
  wireTodoDueModal();
  var backdrop = getBackdrop();
  var datetimeInput = getDatetimeInput();
  var remindInput = getRemindInput();
  if (!backdrop || !datetimeInput || !remindInput) return;

  ensureDatetimeMounted();
  onSaveCallback = opts && opts.onSave ? opts.onSave : null;
  setPresetEditOpen(false);

  var dueDate = opts && opts.dueDate ? String(opts.dueDate) : '';
  datetimeInput.value = dueDate ? isoToDatetimeLocalValue(dueDate) : isoToDatetimeLocalValue(new Date().toISOString());
  datetimeInput.dispatchEvent(new CustomEvent('rpc-datetime-sync'));
  remindInput.checked = !!(opts && opts.remindEnabled && dueDate);
  remindInput.disabled = false;

  renderModalPresetChips();
  syncModalPresetActiveState(dueDate);

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');

  var dateTrigger = backdrop.querySelector('.rpc-date-field__trigger');
  if (dateTrigger instanceof HTMLElement) dateTrigger.focus();
  else datetimeInput.focus();
}

export function closeTodoDueModalPublic() {
  closeTodoDueModal();
}
