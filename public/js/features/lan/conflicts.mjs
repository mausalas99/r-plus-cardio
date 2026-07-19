/**
 * LAN sync conflict resolution (LWW, drafts, bundle/clinicalOps accept).
 */
import { activeLiveSyncRoomId } from './runtime.mjs';
import { patients, saveState } from '../../app-state.mjs';
import { getHostBundleBases, setHostBundleBases } from '../../host-bundle-bases.mjs';
import {
  applyClinicalOpsLanSnapshot,
  isClinicalOpsLanAvailable,
  refreshClinicalOpsSnapshotCache,
} from '../../clinical-ops-lan.mjs';
import { applyRoomSyncPhaseAfterReconcile } from './room.mjs';
import { renderLanPanel } from './panel.mjs';
import {
  deleteDraftConflict,
  listDraftConflicts,
  clearAllDraftConflicts,
  countDraftConflicts,
} from '../../draft-conflict-store.mjs';
import { conflictSnapshotsMatchForAutoResolve } from '../../lan-conflict-silent-match.mjs';
import { notifyLwwOverwrite } from '../../lan-lww-toast.mjs';
import { perfMark, perfMeasure } from '../../perf-markers.mjs';

/** @type {{
 *   applyLiveSyncApplied?: (msg: object) => void,
 *   getLiveSyncEntityBase?: (entityType: string, entityId: string, patientId?: string) => object|null,
 *   rememberLiveSyncEntity?: (entityType: string, entityId: string, patientId: string|null, version: number, data: object) => void,
 *   syncHostBundleEntityFromApplied?: (msg: object) => void,
 *   emitLiveSyncTodoDelete?: (patientId: string, ref: object) => void,
 *   emitLiveSyncTodoUpsert?: (patientId: string, todo: object) => void,
 *   showToast?: (msg: string, type?: string) => void,
 * }} */
let conflictDeps = {};

export function configureLanConflicts(deps) {
  if (deps && typeof deps === 'object') Object.assign(conflictDeps, deps);
}

function isRoomBundleConflictDraft(draft) {
  return !!(draft && (draft.scope || draft.localBundle || draft.entityType === 'roomBundle'));
}

async function clearConflictDraft(draftId) {
  if (!draftId) return;
  try {
    await deleteDraftConflict(draftId);
  } catch { /* ignored */ }
  void renderLanPanel();
}

function shouldDiscardDraft(d, payload, roomId) {
  if (!d || !d.id || isRoomBundleConflictDraft(d)) return false;
  if (d.entityType !== payload.entityType || String(d.entityId) !== String(payload.entityId)) return false;
  if (roomId != null && d.roomId != null && String(d.roomId) !== String(roomId)) return false;
  return true;
}

async function discardDraftsForConflictEntity(payload) {
  if (!payload || !payload.entityType || !payload.entityId) return;
  var drafts = [];
  try {
    drafts = await listDraftConflicts();
  } catch {
    return;
  }
  var roomId = payload.roomId || null;
  for (var i = 0; i < drafts.length; i += 1) {
    var d = drafts[i];
    if (!shouldDiscardDraft(d, payload, roomId)) continue;
    try {
      await deleteDraftConflict(d.id);
    } catch { /* ignored */ }
  }
}

/**
 * Align revision + clinicalOps from host without merging full census (fast, non-blocking).
 * @returns {boolean}
 */
export function acceptServerBundleConflict(opts) {
  opts = opts || {};
  var rid = String(opts.roomId || '').trim();
  var bundle = opts.serverBundle;
  if (!rid || !bundle || typeof bundle !== 'object') return false;
  setHostBundleBases(rid, bundle);
  if (bundle.clinicalOps && isClinicalOpsLanAvailable()) {
    void applyClinicalOpsLanSnapshot(bundle.clinicalOps).then(function (result) {
      if (result.ok) {
        void refreshClinicalOpsSnapshotCache();
        if (result.changed) {
          document.dispatchEvent(new CustomEvent('rpc-clinical-ops-synced'));
        }
      }
    });
  }
  applyRoomSyncPhaseAfterReconcile(rid);
  return true;
}

/** @returns {Promise<boolean>} */
export function acceptServerClinicalOpsConflict(roomId, snapshot, revision) {
  var rid = String(roomId || '').trim();
  if (!rid) return Promise.resolve(false);
  if (revision != null) {
    var bases = getHostBundleBases(rid) || { entityVersions: {} };
    setHostBundleBases(rid, {
      revision: Number(revision),
      entityVersions: bases.entityVersions || {},
    });
  }
  if (snapshot && isClinicalOpsLanAvailable()) {
    return applyClinicalOpsLanSnapshot(snapshot).then(function (result) {
      if (result.ok) {
        void refreshClinicalOpsSnapshotCache();
        if (result.changed) {
          document.dispatchEvent(new CustomEvent('rpc-clinical-ops-synced'));
        }
      }
      applyRoomSyncPhaseAfterReconcile(rid);
      return !!result.ok;
    });
  }
  applyRoomSyncPhaseAfterReconcile(rid);
  return Promise.resolve(revision != null);
}

async function applyConflictUseServer(payload) {
  var server = payload && payload.serverSnapshot;
  if (server && server.data) {
    if (payload.entityType === 'historiaClinica' && payload.patientId) {
      var hcRow = patients.find(function (p) {
        return p && String(p.id) === String(payload.patientId);
      });
      if (hcRow) {
        var mod = await import('../../historia-clinica-lan-sync.mjs');
        mod.applyServerHistoriaClinicaToPatient(hcRow, server.version, server.data);
      }
    } else if (typeof conflictDeps.applyLiveSyncApplied === 'function') {
      conflictDeps.applyLiveSyncApplied({
        roomId: payload.roomId || activeLiveSyncRoomId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        patientId: payload.patientId,
        version: server.version,
        data: server.data,
      });
    }
  }
  if (payload.draftId) {
    await clearConflictDraft(payload.draftId);
  }
}

function clearHistoriaPendingAfterConflict(payload) {
  if (!payload || payload.entityType !== 'historiaClinica' || !payload.patientId) return;
  var row = patients.find(function (p) {
    return p && String(p.id) === String(payload.patientId);
  });
  if (!row || !row.historiaClinica) return;
  delete row.historiaClinica.pendingLanSync;
  delete row.historiaClinica.lanSyncPending;
  saveState();
}

function mergeConflictSnapshotData(snap) {
  if (!snap) return {};
  var base = snap.baseData && typeof snap.baseData === 'object' ? snap.baseData : {};
  var patch = snap.data && typeof snap.data === 'object' ? snap.data : {};
  return Object.assign({}, base, patch);
}

function conflictDataForViewer(payload) {
  var local = mergeConflictSnapshotData(payload && payload.localSnapshot);
  var server =
    payload && payload.serverSnapshot && payload.serverSnapshot.data
      ? Object.assign({}, payload.serverSnapshot.data)
      : {};
  if (
    payload &&
    payload.entityType === 'todo' &&
    (!server.text || server.completed == null) &&
    typeof conflictDeps.getLiveSyncEntityBase === 'function'
  ) {
    var cached = conflictDeps.getLiveSyncEntityBase(
      'todo',
      payload.entityId,
      payload.patientId
    );
    if (cached) server = Object.assign({}, cached, server);
  }
  return { localData: local, serverData: server };
}

function shouldAutoResolveTodoConflict(payload) {
  if (!payload || payload.entityType !== 'todo') return false;
  if (payload.localSnapshot && payload.localSnapshot.op === 'delete') return true;
  var local = mergeConflictSnapshotData(payload.localSnapshot);
  var server = payload.serverSnapshot && payload.serverSnapshot.data;
  return !!(local.completed || (server && server.completed));
}

function tryAutoResolveTodoConflict(payload) {
  var server = payload.serverSnapshot;
  if (!server || server.version == null || !payload.patientId) return false;
  var local = mergeConflictSnapshotData(payload.localSnapshot);
  var merged = Object.assign({}, server.data || {}, local, {
    id: payload.entityId,
    version: server.version,
  });
  if (payload.localSnapshot && payload.localSnapshot.op === 'delete') {
    if (typeof conflictDeps.rememberLiveSyncEntity === 'function') {
      conflictDeps.rememberLiveSyncEntity(
        'todo',
        payload.entityId,
        payload.patientId,
        server.version,
        Object.assign({}, server.data || {}, { id: payload.entityId })
      );
    }
    if (typeof conflictDeps.emitLiveSyncTodoDelete === 'function') {
      conflictDeps.emitLiveSyncTodoDelete(payload.patientId, {
        id: payload.entityId,
        version: server.version,
      });
    }
    return true;
  }
  if (local.completed) {
    merged.completed = true;
    if (typeof conflictDeps.emitLiveSyncTodoUpsert === 'function') {
      conflictDeps.emitLiveSyncTodoUpsert(payload.patientId, merged);
    }
    return true;
  }
  return false;
}

export async function appendLanConflictDraftsSection(root) {
  if (!root) return;
  var draftCount = 0;
  try {
    draftCount = await countDraftConflicts();
  } catch {
    draftCount = 0;
  }
  if (!draftCount) return;

  var prev = root.querySelector('#lan-conflict-drafts-card');
  if (prev) prev.remove();

  var card = document.createElement('div');
  card.id = 'lan-conflict-drafts-card';
  card.className = 'lan-connect-card';

  var title = document.createElement('div');
  title.className = 'lan-connect-card-title';
  title.textContent = 'Conflictos antiguos';
  card.appendChild(title);

  var hint = document.createElement('p');
  hint.className = 'lan-connect-card-hint';
  hint.textContent =
    draftCount +
    ' borrador(es) de conflictos anteriores. La sala ya resuelve cambios concurrentes automáticamente.';
  card.appendChild(hint);

  var bulkRow = document.createElement('div');
  bulkRow.className = 'lan-connect-actions-row';
  bulkRow.style.marginTop = '4px';
  var bulkBtn = document.createElement('button');
  bulkBtn.type = 'button';
  bulkBtn.className = 'btn-lan-primary';
  bulkBtn.style.flex = '1';
  bulkBtn.textContent = 'Descartar todos';
  bulkBtn.onclick = function () {
    if (
      typeof confirm === 'function' &&
      !confirm('¿Descartar los ' + draftCount + ' borrador(es) de conflicto antiguos?')
    ) {
      return;
    }
    bulkBtn.disabled = true;
    bulkBtn.textContent = 'Descartando…';
    void clearAllDraftConflicts()
      .then(function (cleared) {
        var toast = conflictDeps.showToast;
        if (typeof toast === 'function') {
          toast(
            cleared
              ? 'Se descartaron ' + cleared + ' conflictos antiguos.'
              : 'No había borradores que descartar.',
            cleared ? 'success' : 'info'
          );
        }
      })
      .catch(function () {
        if (typeof conflictDeps.showToast === 'function') {
          conflictDeps.showToast('No se pudieron descartar los borradores.', 'error');
        }
      })
      .finally(function () {
        bulkBtn.disabled = false;
        bulkBtn.textContent = 'Descartar todos';
        void renderLanPanel();
      });
  };
  bulkRow.appendChild(bulkBtn);
  card.appendChild(bulkRow);
  root.appendChild(card);
}

async function applyLwwConflictLocally(payload) {
  if (!payload) return;
  perfMark('lan-sync-lww-apply-start');
  try {
    if (shouldAutoResolveTodoConflict(payload) && tryAutoResolveTodoConflict(payload)) {
      await discardDraftsForConflictEntity(payload);
      clearHistoriaPendingAfterConflict(payload);
      var localDelete = payload.localSnapshot && payload.localSnapshot.op === 'delete';
      if (!localDelete && typeof conflictDeps.showToast === 'function') {
        conflictDeps.showToast('Pendiente alineado con la sala', 'info');
      }
      return;
    }
    var viewerData = conflictDataForViewer(payload);
    var silentMatch = conflictSnapshotsMatchForAutoResolve({
      conflictingKeys: payload.conflictingKeys,
      localData: viewerData.localData,
      serverData: viewerData.serverData,
    });
    await applyConflictUseServer(payload);
    await discardDraftsForConflictEntity(payload);
    clearHistoriaPendingAfterConflict(payload);
    var server = payload.serverSnapshot;
    if (server && server.version != null && typeof conflictDeps.syncHostBundleEntityFromApplied === 'function') {
      conflictDeps.syncHostBundleEntityFromApplied({
        roomId: payload.roomId || activeLiveSyncRoomId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        patientId: payload.patientId,
        version: server.version,
        data: server.data,
      });
    }
    if (!silentMatch && payload.lwwApplied) {
      notifyLwwOverwrite(
        { showToast: conflictDeps.showToast },
        {
          entityType: payload.entityType,
          entityId: payload.entityId,
          overwrittenKeys: payload.overwrittenKeys || payload.conflictingKeys || [],
        }
      );
    }
  } finally {
    perfMark('lan-sync-lww-apply-end');
    perfMeasure('lan-sync-lww-apply', 'lan-sync-lww-apply-start', 'lan-sync-lww-apply-end');
  }
}

export async function handleSyncConflict(payload, _options) {
  await applyLwwConflictLocally(payload);
  void renderLanPanel();
}

export function wsConflictDetailToPayload(detail) {
  var baseData =
    typeof conflictDeps.getLiveSyncEntityBase === 'function'
      ? conflictDeps.getLiveSyncEntityBase(detail.entityType, detail.entityId, detail.patientId) ||
        undefined
      : undefined;
  return {
    transport: 'ws',
    entityType: detail.entityType,
    entityId: detail.entityId,
    roomId: detail.roomId,
    patientId: detail.patientId,
    lwwApplied: detail.lwwApplied === true,
    overwrittenKeys: detail.overwrittenKeys || detail.conflictingKeys || [],
    conflictingKeys: detail.conflictingKeys || [],
    localSnapshot: {
      expectedVersion:
        detail.client && detail.client.version != null
          ? detail.client.version
          : detail.expectedVersion,
      data: detail.client && detail.client.data,
      baseData: baseData,
      op: detail.client && detail.client.op,
    },
    serverSnapshot: {
      version: detail.server && detail.server.version,
      data: detail.server && detail.server.data,
    },
  };
}
