/** Pendientes — priority chip UI helpers. */
import {
  nextTodoPriority,
  normalizeTodoPriority,
  todoPriorityLabel,
} from '../todos-priority.mjs';

export function pulseTodoPrioChip(chip) {
  if (!chip) return;
  chip.classList.remove('todo-prio-chip--pulse');
  void chip.offsetWidth;
  chip.classList.add('todo-prio-chip--pulse');
  chip.addEventListener(
    'animationend',
    function onEnd(ev) {
      if (ev.animationName !== 'todo-prio-pulse') return;
      chip.removeEventListener('animationend', onEnd);
      chip.classList.remove('todo-prio-chip--pulse');
    }
  );
}

export function applyTodoPrioChip(chip, prio, pulse) {
  var valid = normalizeTodoPriority(prio);
  chip.classList.remove('prio-alta', 'prio-media', 'prio-baja');
  chip.classList.add('prio-' + valid);
  chip.dataset.priority = valid;
  var label = chip.querySelector('.todo-prio-label');
  if (label) label.textContent = todoPriorityLabel(valid);
  chip.setAttribute('aria-label', 'Prioridad ' + todoPriorityLabel(valid) + '. Clic para cambiar.');
  chip.title = 'Clic: cambiar prioridad (' + todoPriorityLabel(valid) + ')';
  if (pulse) pulseTodoPrioChip(chip);
  return valid;
}

export function createTodoPrioChip(prio, onCycle) {
  var chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'todo-prio-chip';
  var dot = document.createElement('span');
  dot.className = 'todo-prio-dot';
  dot.setAttribute('aria-hidden', 'true');
  var label = document.createElement('span');
  label.className = 'todo-prio-label';
  chip.appendChild(dot);
  chip.appendChild(label);
  applyTodoPrioChip(chip, prio, false);
  chip.addEventListener('click', function () {
    var next = nextTodoPriority(chip.dataset.priority || 'media');
    applyTodoPrioChip(chip, next, true);
    if (onCycle) onCycle(next);
  });
  return chip;
}

export function syncTodoRowPriorityVisual(row, prio) {
  if (!row) return;
  var valid = normalizeTodoPriority(prio);
  row.classList.remove('prio-alta', 'prio-media', 'prio-baja');
  row.classList.add('prio-' + valid);
}
