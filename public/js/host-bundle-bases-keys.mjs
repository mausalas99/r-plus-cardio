import { agendaEntityKey, todoEntityKey } from './live-sync-room.mjs';

function collectAgendaKeys(envelope, keys) {
  const agenda = Array.isArray(envelope.agenda) ? envelope.agenda : [];
  for (const ev of agenda) {
    if (ev && ev.id) keys.add(agendaEntityKey(ev.id));
  }
}

function collectTodoKeys(envelope, keys) {
  const todos = envelope.todos && typeof envelope.todos === 'object' ? envelope.todos : {};
  for (const pid of Object.keys(todos)) {
    const arr = Array.isArray(todos[pid]) ? todos[pid] : [];
    for (const t of arr) {
      if (t && t.id) keys.add(todoEntityKey(pid, t.id));
    }
  }
}

function collectMiscKeys(envelope, keys) {
  if (envelope.manejo && typeof envelope.manejo === 'object') keys.add('manejo');
  if (envelope.clinicalOps && typeof envelope.clinicalOps === 'object') keys.add('clinicalOps');
}

/** @param {object} envelope */
export function collectKeysFromEnvelope(envelope) {
  const keys = new Set();
  if (!envelope || typeof envelope !== 'object') return keys;
  collectAgendaKeys(envelope, keys);
  collectTodoKeys(envelope, keys);
  collectMiscKeys(envelope, keys);
  return keys;
}
