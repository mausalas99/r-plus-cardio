/** Pendientes (todo list) — barrel. */
import {
  renderTodoForm,
  refreshTodoUIsForPatient,
  refreshTodoUIsForPatients,
  refreshAllTodoUIs,
} from './todos-refresh.mjs';
import { renderTodoFormIn } from './todos-list-render.mjs';
import {
  addTodo,
  toggleTodo,
  deleteTodo,
  setTodoPriority,
  acknowledgeHandoffTodo,
  updateTodoText,
  archiveLegacyRepoTodos,
} from './todos-mutations.mjs';

export { registerTodosRuntime } from './todos-runtime.mjs';

export {
  renderTodoForm,
  renderTodoFormIn,
  refreshTodoUIsForPatient,
  refreshTodoUIsForPatients,
  refreshAllTodoUIs,
  addTodo,
  toggleTodo,
  deleteTodo,
  setTodoPriority,
  acknowledgeHandoffTodo,
  updateTodoText,
  archiveLegacyRepoTodos,
};

export function todoCompareForSort(a, b) {
  if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
  var prioOrder = { alta: 0, media: 1, baja: 2 };
  var pa = prioOrder[a.priority] != null ? prioOrder[a.priority] : 1;
  var pb = prioOrder[b.priority] != null ? prioOrder[b.priority] : 1;
  if (pa !== pb) return pa - pb;
  if (a.createdAt && b.createdAt) return String(b.createdAt).localeCompare(String(a.createdAt));
  return 0;
}

export const todosWindowHandlers = {
  renderTodoForm,
  addTodo,
  toggleTodo,
  deleteTodo,
  setTodoPriority,
};
