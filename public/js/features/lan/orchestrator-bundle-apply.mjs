/** LAN bundle merge apply + delta replay (IM-11). */
import { storage } from '../../storage.js';
import { isPitchPatientIsolationActive } from '../../tour-pitch-demo-seed.mjs';
import { activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import { mergeLabHistorySets } from '../../lan-patient-merge.mjs';
import { bumpLabHistoryRevision } from '../../lab-history-cache.mjs';
import {
  buildLiveSyncPatientIdMap,
  remapTodosPatientIds,
  remapAgendaPatientIds,
} from '../../livesync-patient-ids.mjs';
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import {
  applyClinicalOpsLanSnapshot,
  isClinicalOpsLanAvailable,
  refreshClinicalOpsSnapshotCache,
} from '../../clinical-ops-lan.mjs';
import {
  migrateLocalPatientsClinicalSala,
  fetchClinicalScopeContextFromDb,
  refreshClinicalPatientListForScope,
  applyClinicalScopeFromLanOpsSnapshot,
  finalizeMobileLanPatientCensus,
  pruneMobilePatientsOutsideTeamScope,
} from '../../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror } from '../../clinical-privileges.mjs';
import {
  applyDeltaPathValues,
  createDeltaEchoTracker,
  deltaLabelForPath,
  withRemoteDeltaApply,
} from '../../lan-delta-client.mjs';
import { notifyLwwOverwrite } from '../../lan-lww-toast.mjs';
import { perfMark, perfMeasure } from '../../perf-markers.mjs';
import { patients, labHistory, saveState } from '../../app-state.mjs';
import {
  rememberLiveSyncEntity,
  syncHostBundleEntityFromApplied,
  stampTodosWithEntityVersions,
  rememberTodosFromMap,
} from './entity-versions.mjs';
import { removePatientLocally } from './patient-delete.mjs';
import { applyLanPatientEntries, lanJsonEqual } from './patient-entries.mjs';
import {
  getLanRuntime,
  renderPatientListLanSilent,
  profiledRefreshTodoUIsAfterReconcile,
} from './orchestrator-runtime.mjs';

const deltaEchoTracker = createDeltaEchoTracker(getLanClientId());

function runtime() {
  return getLanRuntime();
}

function applyLiveSyncPatientDeletes(deletes, idMap) {
  if (!deletes || !deletes.length) return false;
  var changed = false;
  for (var i = 0; i < deletes.length; i += 1) {
    var d = deletes[i];
    if (!d || !d.deleted) continue;
    var remoteId = String(d.id || '').trim();
    if (!remoteId) continue;
    var localId = idMap && idMap[remoteId] ? idMap[remoteId] : remoteId;
    var existing = patients.find(function (p) {
      return p && String(p.id) === String(localId);
    });
    // Registro reuse: a new local chart must not be removed by an older remote delete id.
    if (existing && String(existing.id) !== remoteId) continue;
    if (localId && removePatientLocally(localId)) changed = true;
  }
  return changed;
}

async function applyLiveSyncMerged(merged) {
  if (!merged) return;
  if (isPitchPatientIsolationActive()) return;
  perfMark('lan-sync-bundle-apply-start');
  try {
    var clinicalOpsApplied = await applyMergedClinicalOps(merged);
    await applyMergedBundleEffects(merged, clinicalOpsApplied);
  } finally {
    perfMark('lan-sync-bundle-apply-end');
    perfMeasure('lan-sync-bundle-apply', 'lan-sync-bundle-apply-start', 'lan-sync-bundle-apply-end');
  }
}

async function applyMergedClinicalOps(merged) {
  var clinicalOps = merged && merged.clinicalOps;
  if (!clinicalOps) return false;
  if (isClinicalOpsLanAvailable()) {
    var opsResult = await applyClinicalOpsLanSnapshot(merged.clinicalOps);
    if (opsResult.ok) {
      await refreshClinicalOpsSnapshotCache();
      await fetchClinicalScopeContextFromDb();
      return true;
    }
    if (opsResult.code !== 'DB_LOCKED' && !opsResult.deferred) {
      runtime().showToast(
        'No se pudieron sincronizar equipos ni usuarios LAN. Reintenta desde ⇄ o reinicia R+.',
        'warn'
      );
    }
    return false;
  }
  return applyClinicalScopeFromLanOpsSnapshot(clinicalOps);
}

function collectTodoSavePids(todosMap, todoTouchedPatientIds, idMap) {
  var saveTodoPids = Object.create(null);
  Object.keys(todosMap).forEach(function (pid) {
    saveTodoPids[pid] = true;
  });
  (todoTouchedPatientIds || []).forEach(function (pid) {
    var mapped = idMap[pid] || pid;
    if (mapped) saveTodoPids[mapped] = true;
  });
  return saveTodoPids;
}

function persistMergedTodos(todosMap, saveTodoPids) {
  var todosChanged = false;
  var changedTodoPids = [];
  Object.keys(saveTodoPids).forEach(function (pid) {
    var todoList = todosMap[pid] || [];
    if (!lanJsonEqual(storage.getTodos(pid), todoList)) {
      storage.saveTodos(pid, todoList);
      todosChanged = true;
      changedTodoPids.push(pid);
    }
  });
  return { todosChanged: todosChanged, changedTodoPids: changedTodoPids };
}

function refreshPatientRemovedUi(patientRemoved) {
  if (!patientRemoved || shouldEnforceTeamPatientMirror()) return;
  renderPatientListLanSilent();
  if (runtime().getActiveId()) {
    runtime().selectPatient(runtime().getActiveId());
    return;
  }
  var pv = document.getElementById('patient-view');
  var es = document.getElementById('empty-state');
  if (pv) pv.style.display = 'none';
  if (es) es.style.display = 'flex';
  runtime().syncWorkContextChrome();
}

function refreshTodoPidsAfterMerge(merged, idMap, changedTodoPids) {
  if (!(merged.todoTouchedPatientIds || []).length) return changedTodoPids;
  return merged.todoTouchedPatientIds
    .map(function (pid) {
      return String(idMap[pid] || pid || '').trim();
    })
    .filter(function (pid) {
      return !!pid;
    });
}

async function finalizeMergedPatientScope(clinicalOpsApplied, patientsChanged, patientRemoved) {
  if (shouldEnforceTeamPatientMirror() && (clinicalOpsApplied || patientsChanged || patientRemoved)) {
    await finalizeMobileLanPatientCensus();
    return;
  }
  if (patientsChanged || patientRemoved || clinicalOpsApplied) {
    void refreshClinicalPatientListForScope({ allowLanPull: false });
  }
}

function refreshMergedPatientsUi(patientsChanged) {
  if (!patientsChanged || !runtime().getActiveId()) return;
  try {
    runtime().renderNoteForm();
  } catch (_e) { void _e; }
  try {
    runtime().renderLabHistoryPanel();
  } catch (_e) { void _e; }
}

function stampMergedTodosMap(todosMap) {
  if (!activeLiveSyncRoomId) return todosMap;
  var entityVersions = getHostBundleBases(activeLiveSyncRoomId).entityVersions;
  var stamped = stampTodosWithEntityVersions(todosMap, entityVersions);
  rememberTodosFromMap(stamped);
  return stamped;
}

async function applyMergedBundleEffects(merged, clinicalOpsApplied) {
  var entries = merged.entries || [];
  var idMap = buildLiveSyncPatientIdMap(entries, patients, merged.todos || {});
  var patientRemoved = applyLiveSyncPatientDeletes(merged.patientDeletes || [], idMap);
  storage.saveScheduledProcedures(remapAgendaPatientIds(merged.agenda || [], idMap));
  var todosMap = stampMergedTodosMap(remapTodosPatientIds(merged.todos || {}, idMap));
  var saveTodoPids = collectTodoSavePids(todosMap, merged.todoTouchedPatientIds, idMap);
  var todoPersist = persistMergedTodos(todosMap, saveTodoPids);
  if (shouldEnforceTeamPatientMirror() && clinicalOpsApplied) {
    pruneMobilePatientsOutsideTeamScope();
  }
  var patientSync = entries.length ? applyLanPatientEntries(entries, { skipTodos: true }) : null;
  var patientsChanged = !!(patientSync && (patientSync.added || patientSync.updated));
  refreshPatientRemovedUi(patientRemoved);
  if (runtime().getActiveAppTab() === 'agenda' || runtime().isMobileWeb()) {
    runtime().renderProcedureAgendaPanel();
  }
  if (todoPersist.todosChanged) {
    profiledRefreshTodoUIsAfterReconcile(
      refreshTodoPidsAfterMerge(merged, idMap, todoPersist.changedTodoPids)
    );
  }
  refreshMergedPatientsUi(patientsChanged);
  if (patientsChanged) migrateLocalPatientsClinicalSala();
  await finalizeMergedPatientScope(clinicalOpsApplied, patientsChanged, patientRemoved);
}

/** Re-apply host bundle patient rows after clinical-ops directorio catch-up. */
async function reapplyLanPatientEntries(entries) {
  if (!entries || !entries.length) return { added: 0, updated: 0 };
  if (isClinicalOpsLanAvailable()) {
    await fetchClinicalScopeContextFromDb();
  }
  return applyLanPatientEntries(entries, { skipTodos: true });
}

async function applyLiveSyncDeltaApplied(msg) {
  if (!msg || isPitchPatientIsolationActive()) return;
  if (msg.roomId && activeLiveSyncRoomId && msg.roomId !== activeLiveSyncRoomId) return;
  const ownEcho = deltaEchoTracker.isOwnEcho(msg);
  const partial = Array.isArray(msg.rejectedPaths) && msg.rejectedPaths.length > 0;
  if (ownEcho && !partial) {
    syncHostBundleEntityFromApplied(msg);
    return;
  }

  await withRemoteDeltaApply(async function () {
    if (msg.entityType === 'historiaClinica' && msg.entityId) {
      const row = patients.find(function (p) {
        return p && String(p.id) === String(msg.entityId);
      });
      if (row) {
        if (!row.historiaClinica) row.historiaClinica = { version: 0, data: {} };
        row.historiaClinica.data = applyDeltaPathValues(
          Object.assign({}, row.historiaClinica.data || {}),
          msg.pathValues || {}
        );
        row.historiaClinica.version = Number(msg.version || row.historiaClinica.version || 0);
        saveState({ immediate: true });
      }
    }
  });

  if (partial) {
    const labels = (msg.rejectedPaths || []).map(function (path) {
      return deltaLabelForPath(msg.entityType, path);
    });
    runtime().showToast('Tu cambio en "' + labels.join(', ') + '" fue reemplazado por una edición más reciente en la sala.', 'warn');
  }
  syncHostBundleEntityFromApplied(msg);
}

function shouldSkipLabUpsertEcho(entry) {
  if (String(entry.originClientId || '') !== String(getLanClientId())) return false;
  var setId = String(entry.setId || entry.set.id);
  var existing = (labHistory[entry.patientId] || []).find(function (s) {
    return s && String(s.id) === setId;
  });
  return !!(existing && Number(existing._clientTimestamp || 0) >= Number(entry.clientTimestamp || 0));
}

async function applyLabUpsertDelta(entry) {
  if (!entry || isPitchPatientIsolationActive()) return;
  if (entry.roomId && activeLiveSyncRoomId && entry.roomId !== activeLiveSyncRoomId) return;
  var pid = String(entry.patientId || '').trim();
  var set = entry.set;
  if (!pid || !set || !set.id) return;
  if (shouldSkipLabUpsertEcho(entry)) return;
  await withRemoteDeltaApply(async function () {
    var merged = mergeLabHistorySets(labHistory[pid] || [], [set]);
    if (lanJsonEqual(labHistory[pid], merged)) return;
    labHistory[pid] = merged;
    bumpLabHistoryRevision(pid);
    saveState({ immediate: true });
    if (runtime().getActiveId() === pid) {
      try {
        runtime().renderLabHistoryPanel();
      } catch (_e) { void _e; }
    }
  });
}

function shouldSkipLabDeleteEcho(entry) {
  if (String(entry.originClientId || '') !== String(getLanClientId())) return false;
  var setId = String(entry.setId || '');
  if (!setId) return false;
  return !(labHistory[entry.patientId] || []).some(function (s) {
    return s && String(s.id) === setId;
  });
}

async function applyLabDeleteDelta(entry) {
  if (!entry || isPitchPatientIsolationActive()) return;
  if (entry.roomId && activeLiveSyncRoomId && entry.roomId !== activeLiveSyncRoomId) return;
  var pid = String(entry.patientId || '').trim();
  var setId = String(entry.setId || '').trim();
  if (!pid || !setId) return;
  if (shouldSkipLabDeleteEcho(entry)) return;
  await withRemoteDeltaApply(async function () {
    var list = labHistory[pid];
    if (!list || !list.length) return;
    var next = list.filter(function (s) {
      return s && String(s.id) !== setId;
    });
    if (next.length === list.length) return;
    if (next.length) labHistory[pid] = next;
    else delete labHistory[pid];
    bumpLabHistoryRevision(pid);
    saveState({ immediate: true });
    if (runtime().getActiveId() === pid) {
      try {
        runtime().renderLabHistoryPanel();
      } catch (_e) { void _e; }
    }
  });
}

/**
 * Apply a batch of delta-log entries from GET /deltas (Flow B catch-up).
 * @param {string} roomId
 * @param {object[]} deltas
 */
async function applyLiveSyncDeltas(roomId, deltas) {
  if (!Array.isArray(deltas) || !deltas.length) return;
  var rid = String(roomId || '').trim();
  var sorted = deltas.slice().sort(function (a, b) {
    return Number(a.deltaSeq || a.seq || 0) - Number(b.deltaSeq || b.seq || 0);
  });
  for (var i = 0; i < sorted.length; i++) {
    var entry = sorted[i];
    if (entry && entry.type === 'command') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lan-command-applied', { detail: entry }));
      }
      continue;
    }
    if (entry && entry.type === 'lab_upsert') {
      await applyLabUpsertDelta(Object.assign({ roomId: rid }, entry));
      continue;
    }
    if (entry && entry.type === 'lab_delete') {
      await applyLabDeleteDelta(Object.assign({ roomId: rid }, entry));
      continue;
    }
    await applyLiveSyncDeltaApplied(Object.assign({ roomId: rid }, entry));
  }
}

function applyLiveSyncAgendaApplied(entityId, version, entityData) {
  var agenda = storage.getScheduledProcedures();
  if (entityData._deleted) {
    agenda = agenda.filter(function (ev) {
      return ev && ev.id !== entityId;
    });
  } else {
    var agendaFound = false;
    agenda = agenda.map(function (ev) {
      if (ev && ev.id === entityId) {
        agendaFound = true;
        return Object.assign({}, ev, entityData, { id: entityId, version: version });
      }
      return ev;
    });
    if (!agendaFound) {
      agenda.push(Object.assign({}, entityData, { id: entityId, version: version }));
    }
  }
  storage.saveScheduledProcedures(agenda);
  if (runtime().getActiveAppTab() === 'agenda' || runtime().isMobileWeb()) {
    runtime().renderProcedureAgendaPanel();
  }
}

function applyLiveSyncTodoApplied(entityId, patientId, version, entityData) {
  var pid = String(patientId);
  if (pid.indexOf('demo-') === 0) return;
  var todos = storage.getTodos(pid);
  if (entityData._deleted) {
    todos = todos.filter(function (t) {
      return t && t.id !== entityId;
    });
  } else {
    var todoFound = false;
    todos = todos.map(function (t) {
      if (t && t.id === entityId) {
        todoFound = true;
        return Object.assign({}, t, entityData, { id: entityId, version: version });
      }
      return t;
    });
    if (!todoFound) {
      todos.push(Object.assign({}, entityData, { id: entityId, version: version }));
    }
  }
  storage.saveTodos(pid, todos);
  perfMark('lan-sync-todos-refresh-start');
  try {
    if (typeof runtime().refreshTodoUIsForPatient === 'function') {
      runtime().refreshTodoUIsForPatient(pid);
    } else {
      runtime().refreshAllTodoUIs();
    }
  } finally {
    perfMark('lan-sync-todos-refresh-end');
    perfMeasure('lan-sync-todos-refresh', 'lan-sync-todos-refresh-start', 'lan-sync-todos-refresh-end');
  }
}

function applyLiveSyncPatientApplied(entityId, version, entityData) {
  var row = patients.find(function (p) {
    return p && p.id === entityId;
  });
  if (!row || entityData._deleted) return;
  var before = JSON.stringify(row);
  Object.assign(row, entityData, { version: version });
  saveState({ immediate: true });
  if (JSON.stringify(row) !== before) renderPatientListLanSilent();
  if (runtime().getActiveId() !== entityId) return;
  try {
    runtime().renderNoteForm();
  } catch (_e) { void _e; }
  try {
    runtime().renderLabHistoryPanel();
  } catch (_e) { void _e; }
}

function notifyLiveSyncAppliedOutcome(msg) {
  if (msg.lwwApplied) {
    notifyLwwOverwrite(runtime(), {
      entityType: msg.entityType,
      entityId: msg.entityId,
      overwrittenKeys: msg.overwrittenKeys || [],
    });
    return;
  }
  if (msg.autoMerged) {
    runtime().showToast('Cambios fusionados automáticamente con el servidor.', 'success');
  }
}

const LIVE_SYNC_APPLIED_HANDLERS = {
  agenda: function (entityId, _patientId, version, entityData) {
    applyLiveSyncAgendaApplied(entityId, version, entityData);
  },
  todo: function (entityId, patientId, version, entityData) {
    applyLiveSyncTodoApplied(entityId, patientId, version, entityData);
  },
  patient: function (entityId, _patientId, version, entityData) {
    applyLiveSyncPatientApplied(entityId, version, entityData);
  },
};

function applyLiveSyncApplied(msg) {
  if (!msg || isPitchPatientIsolationActive()) return;
  if (msg.roomId && activeLiveSyncRoomId && msg.roomId !== activeLiveSyncRoomId) return;
  var entityType = msg.entityType;
  var entityId = String(msg.entityId || '').trim();
  var patientId = msg.patientId;
  var version = Number(msg.version || 1);
  var entityData = msg.data || {};
  if (!entityType || !entityId) return;

  rememberLiveSyncEntity(entityType, entityId, patientId, version, entityData);
  var handler = LIVE_SYNC_APPLIED_HANDLERS[entityType];
  if (handler) handler(entityId, patientId, version, entityData);

  syncHostBundleEntityFromApplied(msg);
  notifyLiveSyncAppliedOutcome(msg);
}

export {
  applyLiveSyncMerged,
  reapplyLanPatientEntries,
  applyLiveSyncDeltaApplied,
  applyLiveSyncDeltas,
  applyLiveSyncApplied,
};
