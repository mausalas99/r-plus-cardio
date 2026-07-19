/** Mapea IDs de paciente del peer LAN al ID local (mismo registro, distinto id). */

export function findPatientIdByRegistro(patients, registro) {
  const r = String(registro || '').trim();
  if (!r || !Array.isArray(patients)) return '';
  const row = patients.find((p) => p && String(p.registro || '').trim() === r);
  return row && row.id ? String(row.id) : '';
}

export function resolveLiveSyncLocalPatientId(remotePatientId, registro, patients) {
  const byReg = findPatientIdByRegistro(patients, registro);
  if (byReg) return byReg;
  const rid = String(remotePatientId || '').trim();
  if (!rid) return '';
  const byId = Array.isArray(patients) ? patients.find((p) => p && p.id === rid) : null;
  return byId && byId.id ? String(byId.id) : rid;
}

function mapBundleEntriesToPatientIds(list, map, regByRemote, patients) {
  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    if (!entry || !entry.patient) continue;
    const remoteId = String(entry.patient.id || '').trim();
    if (!remoteId) continue;
    const reg = String(entry.patient.registro || '').trim();
    if (reg) regByRemote[remoteId] = reg;
    map[remoteId] = resolveLiveSyncLocalPatientId(remoteId, reg, patients);
  }
}

function reconcileLocalPatientIdsByRegistro(patients, map, regByRemote) {
  for (let p = 0; p < (patients || []).length; p += 1) {
    const row = patients[p];
    if (!row || !row.id) continue;
    const localId = String(row.id);
    map[localId] = localId;
    const reg = String(row.registro || '').trim();
    if (!reg) continue;
    for (const remoteId of Object.keys(regByRemote)) {
      if (regByRemote[remoteId] === reg) map[remoteId] = localId;
    }
  }
}

function mapTodoKeysToPatientIds(todos, map, regByRemote, patients) {
  for (const remotePid of Object.keys(todos)) {
    if (map[remotePid]) continue;
    map[remotePid] = resolveLiveSyncLocalPatientId(
      remotePid,
      regByRemote[remotePid] || '',
      patients
    );
  }
}

export function buildLiveSyncPatientIdMap(entries, patients, todosMap) {
  const map = {};
  const regByRemote = {};
  const list = Array.isArray(entries) ? entries : [];
  mapBundleEntriesToPatientIds(list, map, regByRemote, patients);
  reconcileLocalPatientIdsByRegistro(patients, map, regByRemote);
  const todos = todosMap && typeof todosMap === 'object' ? todosMap : {};
  mapTodoKeysToPatientIds(todos, map, regByRemote, patients);
  return map;
}

export function mergeTodoListsById(existing, incoming) {
  const byId = {};
  (Array.isArray(existing) ? existing : []).forEach((t) => {
    if (t && t.id) byId[t.id] = t;
  });
  (Array.isArray(incoming) ? incoming : []).forEach((t) => {
    if (!t || !t.id) return;
    const cur = byId[t.id];
    const at = String(t.updatedAt || t.createdAt || '');
    const curAt = cur ? String(cur.updatedAt || cur.createdAt || '') : '';
    if (!cur || at >= curAt) byId[t.id] = t;
  });
  return Object.keys(byId).map((k) => byId[k]);
}

export function remapTodosPatientIds(todosMap, idMap) {
  const out = {};
  if (!todosMap || typeof todosMap !== 'object') return out;
  for (const remotePid of Object.keys(todosMap)) {
    const localPid = idMap[remotePid] || remotePid;
    const arr = Array.isArray(todosMap[remotePid]) ? todosMap[remotePid] : [];
    if (!arr.length) continue;
    out[localPid] = out[localPid] ? mergeTodoListsById(out[localPid], arr) : arr.slice();
  }
  return out;
}

/**
 * Alinea entry.todos con el mapa fusionado de LiveSync (borrados no reaparecen por unión).
 * @param {object[]} entries
 * @param {Record<string, object[]>} todosMap
 * @param {string[]} [todoTouchedPatientIds] pacientes con cambio de pendientes (p. ej. delete)
 */
export function attachTodosMapToPatientEntries(entries, todosMap, todoTouchedPatientIds) {
  if (!Array.isArray(entries)) return [];
  const map = todosMap && typeof todosMap === 'object' ? todosMap : {};
  const touched = new Set(
    Array.isArray(todoTouchedPatientIds) ? todoTouchedPatientIds.map((id) => String(id)) : []
  );
  for (const entry of entries) {
    const id = entry?.patient?.id ? String(entry.patient.id) : '';
    if (!id) continue;
    if (Object.prototype.hasOwnProperty.call(map, id)) {
      const list = map[id];
      entry.todos = Array.isArray(list) ? list.map((t) => ({ ...t })) : [];
    } else if (touched.has(id)) {
      entry.todos = [];
    }
  }
  return entries;
}

export function remapAgendaPatientIds(agenda, idMap) {
  if (!Array.isArray(agenda)) return [];
  return agenda.map((ev) => {
    if (!ev || !ev.patientId) return ev;
    const pid = String(ev.patientId);
    const local = idMap[pid] || pid;
    if (local === pid) return ev;
    return { ...ev, patientId: local };
  });
}
