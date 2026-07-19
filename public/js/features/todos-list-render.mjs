/** Pendientes — list/row DOM render. */
import { storage } from '../storage.js';
import {
  formatTodoDueLabel,
  isTodoOverdue,
  todoCompareForDueSort,
} from '../todos-due.mjs';
import {
  TODO_FILTER_ALL,
  TODO_FILTER_HANDOFF,
  isHandoffTodo,
  filterTodosByView,
  countHandoffTodos,
  formatTodoCreatorLabel,
} from '../todos-handoff.mjs';
import { aid, getClinicalUsername, getListFilter, setListFilter } from './todos-runtime.mjs';
import {
  createTodoPrioChip,
  syncTodoRowPriorityVisual,
} from './todos-priority-ui.mjs';
import { createTodoDueAddSection } from './todos-due-composer.mjs';
import {
  addTodo,
  toggleTodo,
  deleteTodo,
  setTodoPriority,
  acknowledgeHandoffTodo,
  updateTodoText,
} from './todos-mutations.mjs';

function getTodoFormDraftState(container, idPrefix) {
  if (!container) return null;
  var active = document.activeElement;
  if (!active || !container.contains(active)) return null;

  if (active.id === idPrefix + 'todo-input') {
    return { kind: 'new' };
  }

  if (active.classList && active.classList.contains('todo-text-input')) {
    var row = active.closest('.todo-row');
    var todoId = row && row.dataset ? row.dataset.todoId : '';
    if (todoId) return { kind: 'edit', todoId: todoId };
  }

  return null;
}

function clearTodoListSection(container) {
  Array.from(container.children).forEach(function (child) {
    if (child.classList.contains('todo-composer')) return;
    container.removeChild(child);
  });
}

function findPreservedTodoRow(container, todoId) {
  if (!todoId) return null;
  var rows = container.querySelectorAll('.todo-row[data-todo-id]');
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i].dataset.todoId === todoId) return rows[i];
  }
  return null;
}

function appendTodoHandoffMeta(cell, todo) {
  if (!isHandoffTodo(todo, getClinicalUsername())) return;
  var meta = document.createElement('div');
  meta.className = 'todo-handoff-meta';
  var creator = document.createElement('span');
  creator.className = 'todo-handoff-creator';
  creator.textContent = 'De ' + formatTodoCreatorLabel(todo.createdBy);
  meta.appendChild(creator);
  cell.appendChild(meta);
}

function appendTodoMainCell(row, todo, txtInput) {
  var cell = document.createElement('div');
  cell.className = 'todo-cell-main';
  cell.appendChild(txtInput);
  appendTodoHandoffMeta(cell, todo);
  if (todo.dueDate) {
    var dueLabel = document.createElement('span');
    dueLabel.className = 'todo-due-label';
    dueLabel.textContent = formatTodoDueLabel(todo.dueDate);
    if (todo.reminderAt) {
      dueLabel.appendChild(document.createTextNode(' '));
      var bell = document.createElement('span');
      bell.className = 'todo-remind-bell';
      bell.setAttribute('aria-hidden', 'true');
      bell.textContent = '\uD83D\uDD14';
      dueLabel.appendChild(bell);
    }
    cell.appendChild(dueLabel);
  }
  row.appendChild(cell);
}

function buildTodoRow(t) {
  var prio = t.priority === 'alta' || t.priority === 'baja' ? t.priority : 'media';
  var row = document.createElement('div');
  row.className = 'todo-row prio-' + prio + (t.completed ? ' completed' : '');
  if (isTodoOverdue(t)) row.classList.add('todo-row--overdue');
  if (isHandoffTodo(t, getClinicalUsername())) row.classList.add('todo-row--handoff');
  row.dataset.todoId = t.id;

  var prioChip = createTodoPrioChip(prio, function (next) {
    syncTodoRowPriorityVisual(row, next);
    setTodoPriority(t.id, next, { deferResortMs: 180 });
  });
  row.appendChild(prioChip);

  var chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.className = 'todo-check';
  chk.setAttribute('aria-label', 'Completado');
  chk.checked = !!t.completed;
  chk.addEventListener('change', function () { toggleTodo(t.id); });
  row.appendChild(chk);

  var txtInput = document.createElement('input');
  txtInput.type = 'text';
  txtInput.className = 'todo-text-input';
  txtInput.value = t.text;
  txtInput.placeholder = 'Descripción del pendiente';
  txtInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      txtInput.blur();
    }
  });
  txtInput.addEventListener('blur', function () {
    var v = String(txtInput.value || '').trim();
    if (!v) {
      txtInput.value = t.text;
      return;
    }
    if (v !== String(t.text || '')) updateTodoText(t.id, v);
  });
  appendTodoMainCell(row, t, txtInput);

  var actions = document.createElement('div');
  actions.className = 'todo-row-actions';
  if (isHandoffTodo(t, getClinicalUsername())) {
    var ack = document.createElement('button');
    ack.type = 'button';
    ack.className = 'todo-handoff-ack';
    ack.textContent = 'Recibido';
    ack.title = 'Marcar como recibido del turno anterior';
    ack.addEventListener('click', function () { acknowledgeHandoffTodo(t.id); });
    actions.appendChild(ack);
  }
  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'todo-del';
  del.textContent = '×';
  del.title = 'Eliminar';
  del.addEventListener('click', function () { deleteTodo(t.id); });
  actions.appendChild(del);
  row.appendChild(actions);

  return row;
}

function appendTodoFilterBar(container) {
  var existingToolbar = container.querySelector('.todo-toolbar');
  if (existingToolbar) existingToolbar.remove();

  var toolbar = document.createElement('div');
  toolbar.className = 'todo-toolbar';

  var bar = document.createElement('div');
  bar.className = 'todo-filter-bar todo-segmented';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Filtrar pendientes');

  var listFilter = getListFilter();
  var allTodos = storage.getTodos(aid());
  var handoffCount = countHandoffTodos(allTodos, getClinicalUsername());
  var filters = [
    { id: TODO_FILTER_ALL, label: 'Todos' },
    {
      id: TODO_FILTER_HANDOFF,
      label: handoffCount ? 'Entrega (' + handoffCount + ')' : 'Entrega',
    },
  ];

  filters.forEach(function (f) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'todo-filter-chip' + (listFilter === f.id ? ' is-active' : '');
    btn.dataset.filter = f.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', listFilter === f.id ? 'true' : 'false');
    btn.textContent = f.label;
    btn.addEventListener('click', function () {
      setListFilter(f.id);
      renderTodoListSection(container, null);
    });
    bar.appendChild(btn);
  });

  toolbar.appendChild(bar);
  container.appendChild(toolbar);
}

function appendTodoAddRow(container, idPrefix) {
  var composer = document.createElement('div');
  composer.className = 'todo-composer';

  var addRow = document.createElement('div');
  addRow.className = 'todo-add-row';
  var input = document.createElement('input');
  input.type = 'text';
  input.id = idPrefix + 'todo-input';
  input.placeholder = 'Nuevo pendiente...';
  var addPrio = 'media';
  var prioChip = createTodoPrioChip(addPrio, function (next) {
    addPrio = next;
  });
  prioChip.id = idPrefix + 'todo-priority-chip';
  var dueControls = createTodoDueAddSection(idPrefix);
  var addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'todo-add-btn';
  addBtn.textContent = 'Agregar';
  function submitAdd() {
    addTodo(idPrefix, addPrio, dueControls.getFields());
    dueControls.reset();
  }
  addBtn.addEventListener('click', submitAdd);
  input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') submitAdd();
  });
  var chkSpacer = document.createElement('span');
  chkSpacer.className = 'todo-check-spacer';
  chkSpacer.setAttribute('aria-hidden', 'true');
  addRow.appendChild(prioChip);
  addRow.appendChild(chkSpacer);
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  composer.appendChild(addRow);
  composer.appendChild(dueControls.element);
  container.appendChild(composer);
}

export function renderTodoListSection(container, preserveTodoId) {
  var preservedRow = preserveTodoId ? findPreservedTodoRow(container, preserveTodoId) : null;
  clearTodoListSection(container);
  appendTodoFilterBar(container);

  var listFilter = getListFilter();
  var todos = filterTodosByView(storage.getTodos(aid()), listFilter, getClinicalUsername())
    .slice()
    .sort(todoCompareForDueSort);
  if (preservedRow) {
    var stillExists = todos.some(function (t) {
      return t.id === preserveTodoId;
    });
    if (!stillExists) preservedRow = null;
  }

  if (!todos.length && !preservedRow) {
    var none = document.createElement('div');
    none.className = 'todo-empty';
    none.setAttribute('role', 'status');
    if (listFilter === TODO_FILTER_HANDOFF) {
      none.innerHTML =
        '<span class="empty-state-title">Sin pendientes del turno anterior para este paciente</span>' +
        '<span class="empty-state-lead">Los que quedaron abiertos al cerrar el turno previo aparecerán aquí.</span>';
    } else {
      none.innerHTML =
        '<span class="empty-state-title">Sin pendientes</span>' +
        '<span class="empty-state-lead">Usa el campo de arriba para agregar uno.</span>';
    }
    container.appendChild(none);
    return;
  }

  var list = document.createElement('div');
  list.className = 'todo-list';
  todos.forEach(function (t) {
    if (preservedRow && t.id === preserveTodoId) {
      list.appendChild(preservedRow);
      return;
    }
    list.appendChild(buildTodoRow(t));
  });
  container.appendChild(list);
}

export function renderTodoFormIn(container, idPrefix) {
  if (!container) return;
  idPrefix = idPrefix == null ? '' : String(idPrefix);

  if (!aid()) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var empty = document.createElement('div');
    empty.className = 'todo-empty';
    empty.setAttribute('role', 'status');
    empty.innerHTML =
      '<span class="empty-state-title">Elige un paciente para ver pendientes</span>' +
      '<span class="empty-state-lead">Selecciona uno en la lista de la izquierda.</span>';
    container.appendChild(empty);
    return;
  }

  container.classList.add('todo-shell');

  var draft = getTodoFormDraftState(container, idPrefix);
  var hasAddRow = !!container.querySelector('.todo-composer, .todo-add-row');
  if (draft && hasAddRow) {
    if (draft.kind === 'new') {
      renderTodoListSection(container, null);
      return;
    }
    if (draft.kind === 'edit') {
      renderTodoListSection(container, draft.todoId);
      return;
    }
  }

  while (container.firstChild) container.removeChild(container.firstChild);
  appendTodoAddRow(container, idPrefix);
  renderTodoListSection(container, null);
}
