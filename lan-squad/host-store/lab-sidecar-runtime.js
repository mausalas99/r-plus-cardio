'use strict';

const { entryPatientId } = require('../persistence/sharded-host-persistence.js');
const {
  emptySidecar,
  assembleLabHistory,
  readLabSidecarSync,
  labMetaFromSidecar,
  sidecarFromLabHistory,
} = require('../persistence/lab-sidecar.js');

function createLabSidecarRuntime(ctx) {
  function labSidecarKey(roomId, patientId) {
    return `${String(roomId)}:${String(patientId)}`;
  }

  function markDirtyLab(roomId, patientId) {
    ctx.dirtyLabSidecars.add(labSidecarKey(roomId, patientId));
  }

  function getLabSidecar(roomId, patientId) {
    const key = labSidecarKey(roomId, patientId);
    if (ctx.labSidecarCache.has(key)) return ctx.labSidecarCache.get(key);
    const sc = readLabSidecarSync(ctx.stateDir, roomId, patientId) || emptySidecar();
    ctx.labSidecarCache.set(key, sc);
    return sc;
  }

  function setLabSidecar(roomId, patientId, sidecar) {
    const key = labSidecarKey(roomId, patientId);
    ctx.labSidecarCache.set(key, sidecar);
    markDirtyLab(roomId, patientId);
    return sidecar;
  }

  function stripEntryLabsToSidecar(roomId, entry) {
    const patientId = entryPatientId(entry);
    if (!patientId) return false;
    const labHistory = Array.isArray(entry.labHistory) ? entry.labHistory : [];
    if (!labHistory.length) return false;
    const sidecar = sidecarFromLabHistory(labHistory);
    setLabSidecar(roomId, patientId, sidecar);
    entry.labMeta = labMetaFromSidecar(
      sidecar,
      entry.labMeta && entry.labMeta.labHistoryVersion
    );
    delete entry.labHistory;
    return true;
  }

  function stripRoomBundleLabsToSidecars(roomId, bundle) {
    if (!bundle || !Array.isArray(bundle.entries)) return false;
    let changed = false;
    for (const entry of bundle.entries) {
      if (stripEntryLabsToSidecar(roomId, entry)) changed = true;
    }
    return changed;
  }

  function assembleBundleLabsForApi(bundle, roomId) {
    if (!bundle || typeof bundle !== 'object') return bundle;
    const rid = String(roomId || '');
    const out = {
      ...bundle,
      entries: (bundle.entries || []).map((entry) => {
        if (!entry) return entry;
        const patientId = entryPatientId(entry);
        const cloned = { ...entry };
        if (patientId) {
          const sidecar = getLabSidecar(rid, patientId);
          if (cloned.labMeta || (sidecar.orderedIds && sidecar.orderedIds.length)) {
            cloned.labHistory = assembleLabHistory(sidecar);
          } else if (!Array.isArray(cloned.labHistory)) {
            cloned.labHistory = [];
          }
        }
        return cloned;
      }),
    };
    return out;
  }

  return {
    getLabSidecar,
    setLabSidecar,
    stripRoomBundleLabsToSidecars,
    assembleBundleLabsForApi,
  };
}

module.exports = { createLabSidecarRuntime };
