/**
 * Typed LiveSync mutation emitters (agenda, todo, patient delete).
 */
import { activeLiveSyncRoomId } from './runtime.mjs';
import { createMutationBuilder } from '../../versioned-mutation.mjs';
import {
  buildLiveSyncMutationFromDesired,
  getLiveSyncEntityBase,
  rememberLiveSyncEntity,
  sendLiveSyncMutation,
} from './entity-versions.mjs';

export function emitLiveSyncAgendaUpsert(eventObj) {
  if (!eventObj || !eventObj.id) return;
  var mutation = buildLiveSyncMutationFromDesired('agenda', eventObj.id, eventObj, {
    roomId: activeLiveSyncRoomId,
    op: 'upsert',
  });
  sendLiveSyncMutation(mutation);
}

export function emitLiveSyncAgendaDelete(id, updatedAt) {
  var eid = String(id || '').trim();
  if (!eid) return;
  var base = getLiveSyncEntityBase('agenda', eid, null) || { id: eid, version: 0, updatedAt: updatedAt };
  var mutation = createMutationBuilder('agenda', eid)
    .captureBase(base)
    .build({ roomId: activeLiveSyncRoomId, op: 'delete' });
  sendLiveSyncMutation(mutation);
}

export function emitLiveSyncTodoUpsert(patientId, todo) {
  if (!todo) return;
  if (String(patientId || '').indexOf('demo-') === 0) return;
  var mutation = buildLiveSyncMutationFromDesired('todo', todo.id, todo, {
    roomId: activeLiveSyncRoomId,
    patientId: patientId,
    op: 'upsert',
  });
  sendLiveSyncMutation(mutation);
}

function buildTodoDeleteBase(todo, eid, patientId, updatedAt, cached) {
  var base = cached
    ? Object.assign({}, cached)
    : Object.assign({}, todo || { id: eid, updatedAt: updatedAt }, { id: eid, patientId: patientId });
  if (todo && todo.version != null && (cached == null || cached.version == null)) {
    base.version = Number(todo.version);
  }
  if (base.version == null) base.version = Number(todo && todo.version != null ? todo.version : 0);
  return base;
}

export function emitLiveSyncTodoDelete(patientId, todoRef, updatedAt) {
  var todo = todoRef && typeof todoRef === 'object' ? todoRef : null;
  var eid = todo ? String(todo.id || '').trim() : String(todoRef || '').trim();
  if (!eid) return;
  var cached = getLiveSyncEntityBase('todo', eid, patientId);
  var base = buildTodoDeleteBase(todo, eid, patientId, updatedAt, cached);
  var mutation = createMutationBuilder('todo', eid)
    .captureBase(base)
    .build({ roomId: activeLiveSyncRoomId, patientId: patientId, op: 'delete' });
  var tombVer = Number(base.version || 0) + 1;
  rememberLiveSyncEntity('todo', eid, patientId, tombVer, {
    id: eid,
    patientId: patientId,
    _deleted: true,
    updatedAt: String((todo && todo.updatedAt) || updatedAt || new Date().toISOString()),
  });
  sendLiveSyncMutation(mutation);
}

export function emitLiveSyncPatientDelete(patient) {
  if (!patient) return;
  if (String(patient.id || '').indexOf('demo-') === 0) return;
  var mutation = buildLiveSyncMutationFromDesired(
    'patient',
    patient.id,
    { id: patient.id, registro: patient.registro || '' },
    { roomId: activeLiveSyncRoomId, op: 'delete' }
  );
  sendLiveSyncMutation(mutation);
}
