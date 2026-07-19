/** Prioridad de pendientes — ciclo alta → media → baja */

export var TODO_PRIORITY_CYCLE = ['alta', 'media', 'baja'];

export function normalizeTodoPriority(priority) {
  return priority === 'alta' || priority === 'baja' ? priority : 'media';
}

export function nextTodoPriority(priority) {
  var current = normalizeTodoPriority(priority);
  var idx = TODO_PRIORITY_CYCLE.indexOf(current);
  return TODO_PRIORITY_CYCLE[(idx + 1) % TODO_PRIORITY_CYCLE.length];
}

export function todoPriorityLabel(priority) {
  if (priority === 'alta') return 'Alta';
  if (priority === 'baja') return 'Baja';
  return 'Media';
}
