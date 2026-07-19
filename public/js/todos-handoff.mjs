/**
 * Pendientes handoff filter — surface tasks created by teammates during shift change.
 */

export const TODO_FILTER_ALL = 'all';
export const TODO_FILTER_HANDOFF = 'handoff';

export function normalizeTodoUsername(username) {
  var s = String(username == null ? '' : username).trim();
  return s || null;
}

export function usernamesMatch(a, b) {
  var left = normalizeTodoUsername(a);
  var right = normalizeTodoUsername(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

/** Unacknowledged pendiente from another team member (incoming handoff). */
export function isHandoffTodo(todo, currentUsername) {
  if (!todo || todo.completed) return false;
  if (todo.handoffAcknowledgedAt) return false;
  var creator = normalizeTodoUsername(todo.createdBy);
  if (!creator) return false;
  return !usernamesMatch(creator, currentUsername);
}

export function filterTodosByView(todos, filter, currentUsername) {
  var list = Array.isArray(todos) ? todos.slice() : [];
  if (filter !== TODO_FILTER_HANDOFF) return list;
  return list.filter(function (t) {
    return isHandoffTodo(t, currentUsername);
  });
}

export function countHandoffTodos(todos, currentUsername) {
  return filterTodosByView(todos, TODO_FILTER_HANDOFF, currentUsername).length;
}

export function formatTodoCreatorLabel(createdBy) {
  var u = normalizeTodoUsername(createdBy);
  if (!u) return '';
  return u.charAt(0) === '@' ? u : '@' + u.replace(/^@+/, '');
}

export function buildHandoffAckPatch(username) {
  var nowIso = new Date().toISOString();
  var patch = {
    handoffAcknowledgedAt: nowIso,
    updatedAt: nowIso,
  };
  var u = normalizeTodoUsername(username);
  if (u) patch.handoffAcknowledgedBy = u;
  return patch;
}
