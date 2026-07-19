import { normalizeTodoPriority } from './todos-priority.mjs';

var PRIO_ORDER = { alta: 0, media: 1, baja: 2 };

var MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimeLocal(date) {
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isTomorrowLocal(date, now) {
  var tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameLocalDay(date, tomorrow);
}

function setLocalTime(ref, hours, minutes) {
  var due = new Date(ref);
  due.setHours(hours, minutes, 0, 0);
  return due;
}

function dueTimestamp(todo) {
  if (!todo || !todo.dueDate) return null;
  var due = toDate(todo.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return due.getTime();
}

function priorityRank(todo) {
  var priority = normalizeTodoPriority(todo && todo.priority);
  return PRIO_ORDER[priority] != null ? PRIO_ORDER[priority] : PRIO_ORDER.media;
}

function compareCreatedAtDesc(a, b) {
  if (a.createdAt && b.createdAt) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  }
  return 0;
}

export function isTodoOverdue(todo, now) {
  if (!todo || todo.completed) return false;
  var dueMs = dueTimestamp(todo);
  if (dueMs == null) return false;
  var ref = now == null ? new Date() : toDate(now);
  return dueMs < ref.getTime();
}

export function todoCompareForDueSort(a, b, now) {
  if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;

  var ref = now == null ? new Date() : toDate(now);
  var aOverdue = isTodoOverdue(a, ref);
  var bOverdue = isTodoOverdue(b, ref);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  var aDue = dueTimestamp(a);
  var bDue = dueTimestamp(b);
  if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
  if (aDue != null && bDue == null) return -1;
  if (aDue == null && bDue != null) return 1;

  var pa = priorityRank(a);
  var pb = priorityRank(b);
  if (pa !== pb) return pa - pb;

  return compareCreatedAtDesc(a, b);
}

export function computeReminderAt(todo) {
  if (!todo) return null;
  if (todo.reminderAt) return String(todo.reminderAt);
  if (todo.dueDate) return String(todo.dueDate);
  return null;
}

export function isoToDatetimeLocalValue(isoStr) {
  var d = toDate(String(isoStr || '').trim());
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.getFullYear() +
    '-' +
    pad2(d.getMonth() + 1) +
    '-' +
    pad2(d.getDate()) +
    'T' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes())
  );
}

export function parseDatetimeLocalToIso(value) {
  var raw = String(value || '').trim();
  if (!raw) return null;
  var d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatTodoDueLabel(iso, now) {
  if (!iso) return '';
  var date = toDate(iso);
  if (Number.isNaN(date.getTime())) return '';
  var ref = now == null ? new Date() : toDate(now);
  var time = formatTimeLocal(date);
  if (isSameLocalDay(date, ref)) return 'Hoy ' + time;
  if (isTomorrowLocal(date, ref)) return 'Mañana ' + time;
  return date.getDate() + ' ' + MONTHS_ES[date.getMonth()] + ' ' + time;
}

const TODO_DUE_PRESETS_STORAGE_KEY = 'rpc-todo-due-presets-v1';

export const TODO_DUE_PRESET_DEFAULTS = [
  { id: 'hoy-18', kind: 'dayTime', dayOffset: 0, hour: 18, minute: 0 },
  { id: 'manana-8', kind: 'dayTime', dayOffset: 1, hour: 8, minute: 0 },
  { id: 'en-3h', kind: 'offsetHours', hours: 3 },
  { id: 'en-24h', kind: 'offsetHours', hours: 24 },
];

function clampHour(value) {
  var n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(23, Math.max(0, n));
}

function clampMinute(value) {
  var n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(59, Math.max(0, n));
}

function clampOffsetHours(value) {
  var n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(168, n);
}

function readPresetOverridesMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    var raw = localStorage.getItem(TODO_DUE_PRESETS_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePresetOverridesMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TODO_DUE_PRESETS_STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_e) { void _e; }
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('rpc-todo-due-presets-changed'));
  }
}

export function formatTodoDuePresetAutoLabel(preset) {
  if (!preset) return '';
  if (preset.kind === 'dayTime') {
    var prefix = preset.dayOffset === 1 ? 'Mañana' : 'Hoy';
    return prefix + ' ' + pad2(preset.hour) + ':' + pad2(preset.minute);
  }
  if (preset.kind === 'offsetHours') {
    return 'En ' + preset.hours + ' h';
  }
  return String(preset.id || '');
}

function normalizePresetOverride(def, override) {
  var merged = Object.assign({}, def, override || {});
  if (merged.kind === 'dayTime') {
    merged.dayOffset = merged.dayOffset === 1 ? 1 : 0;
    merged.hour = clampHour(merged.hour);
    merged.minute = clampMinute(merged.minute);
  } else if (merged.kind === 'offsetHours') {
    merged.hours = clampOffsetHours(merged.hours);
  }
  var customLabel =
    override && typeof override.label === 'string' ? String(override.label).trim() : '';
  merged.label = customLabel || formatTodoDuePresetAutoLabel(merged);
  return merged;
}

export function mergeTodoDuePreset(def, override) {
  return normalizePresetOverride(def, override);
}

function isTodoDuePresetDeleted(override) {
  return !!(override && override.deleted);
}

function isCustomPresetId(id) {
  return String(id || '').indexOf('custom-') === 0;
}

function isCustomPresetEntry(override) {
  return !!(override && override.custom);
}

function buildCustomPresetDef(id, override) {
  var kind = override && override.kind === 'dayTime' ? 'dayTime' : 'offsetHours';
  var def = { id: id, kind: kind };
  if (kind === 'dayTime') {
    def.dayOffset = override && override.dayOffset === 1 ? 1 : 0;
    def.hour = clampHour(override && override.hour);
    def.minute = clampMinute(override && override.minute);
  } else {
    def.hours = clampOffsetHours(override && override.hours);
  }
  return def;
}

function normalizeCustomPresetEntry(id, patch) {
  var kind = patch && patch.kind === 'dayTime' ? 'dayTime' : 'offsetHours';
  var entry = { custom: true, kind: kind };
  if (kind === 'dayTime') {
    entry.dayOffset = patch && patch.dayOffset === 1 ? 1 : 0;
    entry.hour = clampHour(patch && patch.hour);
    entry.minute = clampMinute(patch && patch.minute);
  } else {
    entry.hours = clampOffsetHours(patch && patch.hours);
  }
  var label = patch && typeof patch.label === 'string' ? String(patch.label).trim() : '';
  var auto = formatTodoDuePresetAutoLabel(normalizePresetOverride(buildCustomPresetDef(id, entry), entry));
  if (label && label !== auto) entry.label = label;
  return entry;
}

export function resolveTodoDuePresetDef(presetId, overridesMap) {
  var id = String(presetId || '');
  if (!id) return null;
  var builtin = TODO_DUE_PRESET_DEFAULTS.find(function (row) {
    return row.id === id;
  });
  if (builtin) return builtin;
  var overrides = overridesMap == null ? readPresetOverridesMap() : overridesMap;
  var stored = overrides[id];
  if (!isCustomPresetId(id) || !isCustomPresetEntry(stored)) return null;
  return buildCustomPresetDef(id, stored);
}

export function getTodoDuePresets(overridesMap) {
  var overrides = overridesMap == null ? readPresetOverridesMap() : overridesMap;
  var presets = TODO_DUE_PRESET_DEFAULTS.filter(function (def) {
    return !isTodoDuePresetDeleted(overrides[def.id]);
  }).map(function (def) {
    return mergeTodoDuePreset(def, overrides[def.id]);
  });
  Object.keys(overrides)
    .filter(function (id) {
      return isCustomPresetId(id) && isCustomPresetEntry(overrides[id]);
    })
    .sort()
    .forEach(function (id) {
      var def = buildCustomPresetDef(id, overrides[id]);
      presets.push(mergeTodoDuePreset(def, overrides[id]));
    });
  return presets;
}

/** @deprecated use getTodoDuePresets() */
export function getTodoDuePresetsLegacyList() {
  return getTodoDuePresets().map(function (preset) {
    return { id: preset.id, label: preset.label };
  });
}

function applyDeletedPresetOverride(next, id) {
  if (isCustomPresetId(id)) delete next[id];
  else next[id] = { deleted: true };
}

function applyCustomPresetOverride(next, id, patch) {
  next[id] = normalizeCustomPresetEntry(id, Object.assign({}, next[id] || {}, patch));
}

function builtinPresetDiffersFromDefault(def, current) {
  if (def.kind === 'dayTime') {
    return (
      current.dayOffset !== def.dayOffset ||
      clampHour(current.hour) !== def.hour ||
      clampMinute(current.minute) !== def.minute ||
      !!current.label
    );
  }
  if (def.kind === 'offsetHours') {
    return clampOffsetHours(current.hours) !== def.hours || !!current.label;
  }
  return false;
}

function applyBuiltinPresetOverride(next, id, patch) {
  var def = TODO_DUE_PRESET_DEFAULTS.find(function (row) {
    return row.id === id;
  });
  if (!def) return;
  var current = Object.assign({}, next[id] || {}, patch);
  delete current.deleted;
  var auto = formatTodoDuePresetAutoLabel(normalizePresetOverride(def, current));
  if (current.label === auto) delete current.label;
  if (builtinPresetDiffersFromDefault(def, current)) next[id] = current;
  else delete next[id];
}

function applyOnePresetOverride(next, id, patch) {
  if (!patch || typeof patch !== 'object') return;
  if (patch.deleted) {
    applyDeletedPresetOverride(next, id);
    return;
  }
  if (isCustomPresetId(id) || isCustomPresetEntry(patch) || isCustomPresetEntry(next[id])) {
    applyCustomPresetOverride(next, id, patch);
    return;
  }
  applyBuiltinPresetOverride(next, id, patch);
}

export function saveTodoDuePresetOverrides(patchById) {
  var next = readPresetOverridesMap();
  Object.keys(patchById || {}).forEach(function (id) {
    applyOnePresetOverride(next, id, patchById[id]);
  });
  writePresetOverridesMap(next);
}

export function syncTodoDuePresetsFromEditRows(patchById, options) {
  /** @type {Record<string, Record<string, unknown>>} */
  var patch = Object.assign({}, patchById || {});
  var opts = options && typeof options === 'object' ? options : {};
  /** @type {string[]} */
  var visibleIds = [];
  if (Array.isArray(opts.visibleRowIds)) {
    opts.visibleRowIds.forEach(function (id) {
      var key = String(id || '');
      if (key && visibleIds.indexOf(key) === -1) visibleIds.push(key);
    });
  }
  Object.keys(patch).forEach(function (id) {
    if (patch[id] && !patch[id].deleted && visibleIds.indexOf(id) === -1) visibleIds.push(id);
  });
  TODO_DUE_PRESET_DEFAULTS.forEach(function (def) {
    if (visibleIds.indexOf(def.id) === -1) patch[def.id] = { deleted: true };
  });
  var overrides = readPresetOverridesMap();
  Object.keys(overrides).forEach(function (id) {
    if (isCustomPresetId(id) && isCustomPresetEntry(overrides[id]) && visibleIds.indexOf(id) === -1) {
      patch[id] = { deleted: true };
    }
  });
  saveTodoDuePresetOverrides(patch);
}

export function deleteTodoDuePreset(presetId) {
  var id = String(presetId || '').trim();
  if (!id) return;
  if (isCustomPresetId(id)) {
    var next = readPresetOverridesMap();
    delete next[id];
    writePresetOverridesMap(next);
    return;
  }
  saveTodoDuePresetOverrides({ [id]: { deleted: true } });
}

export function addTodoDuePreset(options) {
  var opts = options && typeof options === 'object' ? options : {};
  var id =
    'custom-' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);
  var kind = opts.kind === 'dayTime' ? 'dayTime' : 'offsetHours';
  var patch = { custom: true, kind: kind };
  if (kind === 'dayTime') {
    patch.dayOffset = opts.dayOffset === 1 ? 1 : 0;
    patch.hour = opts.hour != null ? opts.hour : 18;
    patch.minute = opts.minute != null ? opts.minute : 0;
  } else {
    patch.hours = opts.hours != null ? opts.hours : 6;
  }
  if (typeof opts.label === 'string' && opts.label.trim()) patch.label = opts.label.trim();
  var next = readPresetOverridesMap();
  next[id] = normalizeCustomPresetEntry(id, patch);
  writePresetOverridesMap(next);
  return mergeTodoDuePreset(buildCustomPresetDef(id, next[id]), next[id]);
}

export function resetTodoDuePresetOverrides() {
  writePresetOverridesMap({});
}

export function dueDateFromPresetDef(preset, now) {
  if (!preset) return null;
  var ref = now == null ? new Date() : toDate(now);
  if (preset.kind === 'dayTime') {
    var base = new Date(ref);
    if (preset.dayOffset === 1) base.setDate(base.getDate() + 1);
    return setLocalTime(base, preset.hour, preset.minute);
  }
  if (preset.kind === 'offsetHours') {
    return new Date(ref.getTime() + preset.hours * 60 * 60 * 1000);
  }
  return null;
}

export function parseDuePreset(presetId, now) {
  var preset = getTodoDuePresets().find(function (row) {
    return row.id === String(presetId || '');
  });
  var due = dueDateFromPresetDef(preset, now);
  if (!due) return { dueDate: null, reminderAt: null };
  var iso = due.toISOString();
  return { dueDate: iso, reminderAt: iso };
}
