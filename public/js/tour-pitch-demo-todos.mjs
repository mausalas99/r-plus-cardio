/**
 * Pendientes del modo presentación (demo-pitch). Se escriben en rpc-todos porque saveTodos omite demo-*.
 */
const PITCH_DEMO_PATIENT_ID = 'demo-pitch';

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
  } catch {
    /* localStorage unavailable */
  }
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
export function buildPitchDemoTodosForPatient(patientId) {
  if (patientId !== PITCH_DEMO_PATIENT_ID) return [];
  return [
    todoEntry('pitch-todo-bh-qs', 'BH y QS control mañana (peritonitis / IRC)', 'alta', false),
    todoEntry(
      'pitch-todo-atb',
      'Ajustar esquema ATB según antibiograma (Pseudomonas / E. coli)',
      'alta',
      false
    ),
    todoEntry(
      'pitch-todo-glu',
      'Repetir glucometría si >180 mg/dL en próximo turno',
      'media',
      false
    ),
    todoEntry(
      'pitch-todo-infecto',
      'Interconsulta Infectología — documentar en nota',
      'media',
      false
    ),
    todoEntry('pitch-todo-io', 'Balance hídrico estricto — registrar I/O en turno', 'baja', false),
    todoEntry('pitch-todo-k-repo', 'Reposición K vo (valorar con QS)', 'media', true),
  ];
}

export function seedPitchDemoTodos() {
  const map = readTodosMap();
  map[PITCH_DEMO_PATIENT_ID] = buildPitchDemoTodosForPatient(PITCH_DEMO_PATIENT_ID);
  delete map['demo-pitch-2'];
  writeTodosMap(map);
}

export function clearPitchDemoTodos() {
  const map = readTodosMap();
  let changed = false;
  for (const id of [PITCH_DEMO_PATIENT_ID, 'demo-pitch-2']) {
    if (map[id]) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) writeTodosMap(map);
}
