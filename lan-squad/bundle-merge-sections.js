'use strict';

const { mergeClinicalOpsSnapshotsData } = require('../lib/db/clinical-ops-bundle-merge.cjs');

/**
 * @param {number} serverRevision
 * @param {number} baseRevision
 * @param {string[]} payloadKeyList
 * @param {object} bundle
 */
function revisionSkewFailure(serverRevision, baseRevision, payloadKeyList, bundle) {
  if (!(serverRevision > 0 && baseRevision !== serverRevision && payloadKeyList.length === 0)) {
    return null;
  }
  return {
    ok: false,
    bundle,
    conflicts: [
      {
        key: '*',
        kind: 'bundle',
        localBaseVersion: baseRevision,
        serverVersion: serverRevision,
        local: { baseRevision },
        server: { revision: serverRevision },
      },
    ],
  };
}

/**
 * @param {Set<string>} payloadKeys
 * @param {object} baseEntityVersions
 * @param {object} serverEntityVersions
 * @param {object} base
 * @param {object} bundle
 */
function entityKindForKey(key) {
  if (key.startsWith('a:')) return 'agenda';
  if (key.startsWith('t:')) return 'todo';
  if (key === 'manejo') return 'manejo';
  if (key === 'clinicalOps') return 'clinicalOps';
  return 'entity';
}

function buildEntityConflict(key, baseVer, serverVer, base, bundle) {
  return {
    key,
    kind: entityKindForKey(key),
    patientId: key.startsWith('t:') ? key.split(':')[1] : undefined,
    localBaseVersion: baseVer == null ? 0 : Number(baseVer),
    serverVersion: Number(serverVer),
    local: extractPayloadForKey(base, key),
    server: extractPayloadForKey(bundle, key),
  };
}

function collectEntityConflicts(payloadKeys, baseEntityVersions, serverEntityVersions, base, bundle) {
  const conflicts = [];
  const autoMergedKeys = [];
  for (const key of payloadKeys) {
    const baseVer = baseEntityVersions[key];
    const serverVer = serverEntityVersions[key];
    if (serverVer == null) {
      autoMergedKeys.push(key);
      continue;
    }
    if (baseVer == null || Number(baseVer) !== Number(serverVer)) {
      conflicts.push(buildEntityConflict(key, baseVer, serverVer, base, bundle));
    } else {
      autoMergedKeys.push(key);
    }
  }
  return { conflicts, autoMergedKeys };
}

/**
 * @param {object} bundle
 * @param {object} base
 * @param {Set<string>} conflictKeys
 * @param {string[]} lwwAppliedKeys
 * @param {{ agendaById: Function, mergeEntityLww: Function }} helpers
 */
function mergeAgendaSection(bundle, base, conflictKeys, lwwAppliedKeys, helpers) {
  if (!('agenda' in base)) return;
  const agendaMap = helpers.agendaById(Array.isArray(bundle.agenda) ? bundle.agenda : []);
  const incomingAgenda = Array.isArray(base.agenda) ? base.agenda : [];
  for (const ev of incomingAgenda) {
    if (!ev || !ev.id) continue;
    const key = helpers.agendaEntityKey(ev.id);
    const serverEv = agendaMap.get(ev.id);
    if (conflictKeys.has(key) && serverEv) {
      const { winner, overwritten } = helpers.mergeEntityLww(serverEv, ev);
      agendaMap.set(ev.id, { ...winner });
      if (overwritten) lwwAppliedKeys.push(key);
    } else {
      agendaMap.set(ev.id, { ...ev });
    }
  }
  bundle.agenda = [...agendaMap.values()];
}

/**
 * @param {object} bundle
 * @param {object} base
 * @param {Set<string>} conflictKeys
 * @param {string[]} lwwAppliedKeys
 * @param {{ todosByKey: Function, materializeTodos: Function, todoEntityKey: Function, mergeEntityLww: Function }} helpers
 */
function mergeTodosSection(bundle, base, conflictKeys, lwwAppliedKeys, helpers) {
  if (!('todos' in base) || !base.todos || typeof base.todos !== 'object') return;
  const todoMap = helpers.todosByKey(bundle.todos);
  for (const pid of Object.keys(base.todos)) {
    const arr = Array.isArray(base.todos[pid]) ? base.todos[pid] : [];
    for (const t of arr) {
      if (!t || !t.id) continue;
      const key = helpers.todoEntityKey(pid, t.id);
      const existing = todoMap.get(key);
      if (conflictKeys.has(key) && existing?.item) {
        const { winner, overwritten } = helpers.mergeEntityLww(existing.item, t);
        todoMap.set(key, { patientId: pid, item: { ...winner } });
        if (overwritten) lwwAppliedKeys.push(key);
      } else {
        todoMap.set(key, { patientId: pid, item: { ...t } });
      }
    }
  }
  bundle.todos = helpers.materializeTodos(todoMap);
}

/**
 * @param {object} bundle
 * @param {object} base
 * @param {(serverEntry: object, incomingEntry: object) => object} mergePartialEntry
 */
function mergeEntriesSection(bundle, base, mergePartialEntry) {
  if (!('entries' in base)) return;
  const incomingEntries = Array.isArray(base.entries) ? base.entries : [];
  if (base.entriesPartial === true) {
    const serverById = new Map((bundle.entries || []).map((e) => [e && e.id, e]));
    const result = [...(bundle.entries || [])];
    const serverIdSet = new Set(serverById.keys());
    for (const incoming of incomingEntries) {
      if (!incoming || !incoming.id) continue;
      if (serverIdSet.has(incoming.id)) {
        const idx = result.findIndex((e) => e && e.id === incoming.id);
        if (idx >= 0) result[idx] = mergePartialEntry(result[idx], incoming);
      } else {
        result.push(incoming);
      }
    }
    bundle.entries = result;
  } else {
    bundle.entries = incomingEntries;
  }
}

/** @param {object} bundle @param {object} base */
function mergeManejoSection(bundle, base) {
  if (!('manejo' in base)) return;
  bundle.manejo =
    base.manejo && typeof base.manejo === 'object'
      ? base.manejo
      : base.manejo === null
        ? null
        : bundle.manejo;
}

/** @param {object} bundle @param {object} base */
function mergeClinicalOpsSection(bundle, base) {
  if (!('clinicalOps' in base)) return;
  const incomingOps = base.clinicalOps && typeof base.clinicalOps === 'object' ? base.clinicalOps : null;
  const serverOps = bundle.clinicalOps && typeof bundle.clinicalOps === 'object' ? bundle.clinicalOps : null;
  if (incomingOps) {
    bundle.clinicalOps = serverOps ? mergeClinicalOpsSnapshotsData(serverOps, incomingOps) : incomingOps;
  }
}

function extractPayloadForKey(payload, key) {
  if (key === 'manejo') return payload.manejo || null;
  if (key === 'clinicalOps') return payload.clinicalOps || null;
  if (key.startsWith('a:')) {
    const id = key.slice(2);
    const list = Array.isArray(payload.agenda) ? payload.agenda : [];
    return list.find((e) => e && e.id === id) || null;
  }
  if (key.startsWith('t:')) {
    const parts = key.split(':');
    const pid = parts[1];
    const tid = parts[2];
    const arr =
      payload.todos && payload.todos[pid] && Array.isArray(payload.todos[pid]) ? payload.todos[pid] : [];
    return arr.find((t) => t && t.id === tid) || null;
  }
  return null;
}

module.exports = {
  revisionSkewFailure,
  collectEntityConflicts,
  mergeAgendaSection,
  mergeTodosSection,
  mergeEntriesSection,
  mergeManejoSection,
  mergeClinicalOpsSection,
  extractPayloadForKey,
};
