/** Pendientes — CRUD + LAN sync. */
import { storage } from '../storage.js';
import { emitLiveSyncTodoDelete, emitLiveSyncTodoUpsert } from './lan-sync.mjs';
import { normalizeTodoPriority } from '../todos-priority.mjs';
import { rescheduleAllTodos } from '../todos-reminder-scheduler.mjs';
import {
  isHandoffTodo,
  buildHandoffAckPatch,
} from '../todos-handoff.mjs';
import { aid, getClinicalUsername } from './todos-runtime.mjs';
import { refreshAllTodoUIs } from './todos-refresh.mjs';

export function addTodo(idPrefix, priorityOverride, dueFields) {
  if (idPrefix === undefined || idPrefix === null) idPrefix = '';
  if (typeof idPrefix !== 'string') idPrefix = '';
  if (!aid()) return;
  var input = document.getElementById(idPrefix + 'todo-input');
  if (!input) return;
  var text = String(input.value || '').trim();
  if (!text) return;
  var chip = document.getElementById(idPrefix + 'todo-priority-chip');
  var priority = normalizeTodoPriority(
    priorityOverride || (chip && chip.dataset.priority) || 'media'
  );
  var nowIso = new Date().toISOString();
  var todos = storage.getTodos(aid());
  var row = {
    id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
    text: text,
    completed: false,
    priority: priority,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  var username = getClinicalUsername();
  if (username) row.createdBy = username;
  if (dueFields && dueFields.dueDate) {
    row.dueDate = dueFields.dueDate;
    if (dueFields.reminderAt) row.reminderAt = dueFields.reminderAt;
  }
  todos.push(row);
  storage.saveTodos(aid(), todos);
  emitLiveSyncTodoUpsert(aid(), row);
  rescheduleAllTodos(aid());
  input.value = '';
  refreshAllTodoUIs();
}

export function toggleTodo(id) {
  if (!aid()) return;
  var todos = storage.getTodos(aid());
  var found = todos.find(function (t) { return t.id === id; });
  if (!found) return;
  var nowIso = new Date().toISOString();
  var username = getClinicalUsername();
  found.completed = !found.completed;
  if (found.completed) {
    found.completedAt = nowIso;
    if (username) found.completedBy = username;
  } else {
    found.completedAt = null;
    found.completedBy = null;
  }
  found.updatedAt = nowIso;
  storage.saveTodos(aid(), todos);
  emitLiveSyncTodoUpsert(aid(), found);
  rescheduleAllTodos(aid());
  refreshAllTodoUIs();
}

export function deleteTodo(id) {
  if (!aid()) return;
  var delAt = new Date().toISOString();
  var todos = storage.getTodos(aid());
  var victim = todos.find(function (t) {
    return t.id === id;
  });
  todos = todos.filter(function (t) {
    return t.id !== id;
  });
  storage.saveTodos(aid(), todos);
  if (victim) emitLiveSyncTodoDelete(aid(), victim);
  else emitLiveSyncTodoDelete(aid(), { id: id, updatedAt: delAt });
  rescheduleAllTodos(aid());
  refreshAllTodoUIs();
}

export function setTodoPriority(id, priority, opts) {
  if (!aid()) return;
  opts = opts || {};
  var valid = normalizeTodoPriority(priority);
  var todos = storage.getTodos(aid());
  var found = todos.find(function (t) { return t.id === id; });
  if (!found) return;
  found.priority = valid;
  found.updatedAt = new Date().toISOString();
  storage.saveTodos(aid(), todos);
  emitLiveSyncTodoUpsert(aid(), found);
  rescheduleAllTodos(aid());
  if (opts.deferResortMs) {
    setTimeout(refreshAllTodoUIs, opts.deferResortMs);
    return;
  }
  refreshAllTodoUIs();
}

export function acknowledgeHandoffTodo(id) {
  if (!aid()) return;
  var todos = storage.getTodos(aid());
  var found = todos.find(function (t) {
    return t.id === id;
  });
  if (!found || !isHandoffTodo(found, getClinicalUsername())) return;
  Object.assign(found, buildHandoffAckPatch(getClinicalUsername()));
  storage.saveTodos(aid(), todos);
  emitLiveSyncTodoUpsert(aid(), found);
  rescheduleAllTodos(aid());
  refreshAllTodoUIs();
}

export function updateTodoText(id, text) {
  if (!aid()) return;
  var trimmed = String(text || '').trim();
  if (!trimmed) return;
  var todos = storage.getTodos(aid());
  var found = todos.find(function (t) { return t.id === id; });
  if (!found || String(found.text || '') === trimmed) return;
  found.text = trimmed;
  found.updatedAt = new Date().toISOString();
  storage.saveTodos(aid(), todos);
  emitLiveSyncTodoUpsert(aid(), found);
  rescheduleAllTodos(aid());
  refreshAllTodoUIs();
}

/**
 * Marca como completados pendientes legacy de reposición electrolítica (Manejo automático).
 * @param {string} patientId
 */
export function archiveLegacyRepoTodos(patientId) {
  if (!patientId) return;
  var todos = storage.getTodos(patientId).map(function (t) {
    if (!t || t.completed) return t;
    var rid = String(t.labRuleId || '');
    var txt = String(t.text || '');
    if (rid.indexOf('manejo:') === 0 || /^Repo /i.test(txt)) {
      return { ...t, completed: true, updatedAt: new Date().toISOString() };
    }
    return t;
  });
  storage.saveTodos(patientId, todos);
}
