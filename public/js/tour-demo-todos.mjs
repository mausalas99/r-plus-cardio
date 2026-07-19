/**
 * Pendientes del tour guiado (demo-onboarding). storage.saveTodos omite demo-*;
 * se escribe directo en rpc-todos como en pitch.
 */
import { DEMO_PATIENT_ID } from './tour-demo-patient.mjs';

const TODOS_LS_KEY = 'rpc-todos';

function readTodosMap() {
  try {
    const raw = localStorage.getItem(TODOS_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeTodosMap(map) {
  try {
    localStorage.setItem(TODOS_LS_KEY, JSON.stringify(map || {}));
  } catch (_e) { void _e; }
}

function todoEntry(id, text, priority, completed) {
  const now = new Date().toISOString();
  return {
    id,
    text,
    priority,
    completed: !!completed,
    createdAt: now,
    updatedAt: now,
  };
}

/** @param {string} patientId */
export function buildTourDemoTodosForPatient(patientId) {
  if (patientId !== DEMO_PATIENT_ID) return [];
  return [
    todoEntry('tour-todo-bh', 'BH y QS de control mañana (IRC / anemia)', 'alta', false),
    todoEntry(
      'tour-todo-glu',
      'Repetir glucometría si >180 mg/dL en próximo turno',
      'media',
      false
    ),
    todoEntry(
      'tour-todo-atb',
      'Ajustar ATB según antibiograma cuando esté disponible',
      'alta',
      false
    ),
    todoEntry(
      'tour-todo-infecto',
      'Interconsulta Infectología — documentar en nota',
      'media',
      false
    ),
    todoEntry('tour-todo-io', 'Balance hídrico estricto — registrar I/O en turno', 'baja', false),
    todoEntry('tour-todo-eco', 'Valorar ecografía abdominal según evolución', 'media', false),
  ];
}

export function seedTourDemoTodos(patientId) {
  const pid = patientId || DEMO_PATIENT_ID;
  const todos = buildTourDemoTodosForPatient(pid);
  if (!todos.length) return;
  const map = readTodosMap();
  map[pid] = todos;
  writeTodosMap(map);
}

export function clearTourDemoTodos() {
  const map = readTodosMap();
  let changed = false;
  if (map[DEMO_PATIENT_ID]) {
    delete map[DEMO_PATIENT_ID];
    changed = true;
  }
  if (changed) writeTodosMap(map);
}
