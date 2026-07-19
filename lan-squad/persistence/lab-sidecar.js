'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJsonAtomic } = require('../atomic-json.js');

const HOST_LAB_SET_CAP = 20;

function emptySidecar() {
  return { setsById: {}, orderedIds: [], deletedById: {}, updatedAt: '' };
}

function labSetWithTimestamp(set, clientTimestamp) {
  return { ...set, _clientTimestamp: clientTimestamp };
}

/**
 * O(1) amortized upsert — prepend/pop cap; no Array.sort on write path.
 * Caller enforces clientTimestamp LWW before invoking for existing ids.
 */
function upsertLabSidecar(sc, set, clientTimestamp) {
  const setId = String(set && set.id ? set.id : '');
  if (!setId) return sc;

  const deletedAt = sc.deletedById && sc.deletedById[setId] != null ? Number(sc.deletedById[setId]) : 0;
  if (deletedAt && clientTimestamp <= deletedAt) return sc;

  const sidecar = {
    setsById: { ...(sc.setsById || {}) },
    orderedIds: Array.isArray(sc.orderedIds) ? [...sc.orderedIds] : [],
    deletedById: { ...(sc.deletedById || {}) },
    updatedAt: new Date().toISOString(),
  };
  if (deletedAt) delete sidecar.deletedById[setId];
  const stored = labSetWithTimestamp(set, clientTimestamp);
  const existingIdx = sidecar.orderedIds.indexOf(setId);

  if (existingIdx >= 0) {
    sidecar.setsById[setId] = stored;
    return sidecar;
  }

  sidecar.setsById[setId] = stored;
  sidecar.orderedIds.unshift(setId);
  if (sidecar.orderedIds.length > HOST_LAB_SET_CAP) {
    const popped = sidecar.orderedIds.pop();
    if (popped) delete sidecar.setsById[popped];
  }
  return sidecar;
}

function deleteLabSidecarSet(sc, setId, clientTimestamp) {
  const id = String(setId || '');
  if (!id) return sc;

  const existing = sc.setsById && sc.setsById[id];
  const existingTs = existing ? Number(existing._clientTimestamp || 0) : 0;
  const priorDeleteTs =
    sc.deletedById && sc.deletedById[id] != null ? Number(sc.deletedById[id]) : 0;
  if (clientTimestamp < Math.max(existingTs, priorDeleteTs)) return sc;

  const sidecar = {
    setsById: { ...(sc.setsById || {}) },
    orderedIds: Array.isArray(sc.orderedIds) ? sc.orderedIds.filter((x) => x !== id) : [],
    deletedById: { ...(sc.deletedById || {}), [id]: clientTimestamp },
    updatedAt: new Date().toISOString(),
  };
  delete sidecar.setsById[id];
  return sidecar;
}

function assembleLabHistory(sidecar) {
  if (!sidecar || !Array.isArray(sidecar.orderedIds)) return [];
  return sidecar.orderedIds.map((id) => sidecar.setsById && sidecar.setsById[id]).filter(Boolean);
}

function latestSetAt(sidecar) {
  const first = sidecar && sidecar.orderedIds && sidecar.orderedIds[0];
  const set = first && sidecar.setsById ? sidecar.setsById[first] : null;
  if (!set) return undefined;
  if (set.updatedAt) return String(set.updatedAt);
  if (set.date) return String(set.date);
  return undefined;
}

function labMetaFromSidecar(sidecar, prevVersion = 0) {
  const count = sidecar && Array.isArray(sidecar.orderedIds) ? sidecar.orderedIds.length : 0;
  return {
    labHistoryVersion: Number(prevVersion || 0) + 1,
    labSetCount: count,
    latestSetAt: latestSetAt(sidecar),
  };
}

function sidecarPath(hostStateDir, roomId, patientId) {
  return path.join(hostStateDir, 'labs', String(roomId), `${String(patientId)}.json`);
}

async function readLabSidecar(hostStateDir, roomId, patientId) {
  const raw = await readJson(sidecarPath(hostStateDir, roomId, patientId));
  if (!raw) return null;
  return {
    setsById: raw.setsById && typeof raw.setsById === 'object' ? raw.setsById : {},
    orderedIds: Array.isArray(raw.orderedIds) ? raw.orderedIds : [],
    deletedById: raw.deletedById && typeof raw.deletedById === 'object' ? raw.deletedById : {},
    updatedAt: raw.updatedAt || '',
  };
}

function readLabSidecarSync(hostStateDir, roomId, patientId) {
  const fp = sidecarPath(hostStateDir, roomId, patientId);
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    return {
      setsById: raw.setsById && typeof raw.setsById === 'object' ? raw.setsById : {},
      orderedIds: Array.isArray(raw.orderedIds) ? raw.orderedIds : [],
      deletedById: raw.deletedById && typeof raw.deletedById === 'object' ? raw.deletedById : {},
      updatedAt: raw.updatedAt || '',
    };
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeLabSidecar(hostStateDir, roomId, patientId, sidecar) {
  await writeJsonAtomic(sidecarPath(hostStateDir, roomId, patientId), sidecar);
}

function writeLabSidecarSync(hostStateDir, roomId, patientId, sidecar) {
  const fp = sidecarPath(hostStateDir, roomId, patientId);
  const dir = path.dirname(fp);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sidecar), 'utf8');
  fs.renameSync(tmp, fp);
}

function sidecarFromLabHistory(labHistory) {
  let sc = emptySidecar();
  const sets = Array.isArray(labHistory) ? [...labHistory] : [];
  sets.sort((a, b) => {
    const da = String((a && a.date) || '');
    const db = String((b && b.date) || '');
    if (da !== db) return db.localeCompare(da);
    const ta = Number((a && a._clientTimestamp) || 0);
    const tb = Number((b && b._clientTimestamp) || 0);
    return tb - ta;
  });
  for (const set of sets) {
    if (!set || !set.id) continue;
    const ts = Number(set._clientTimestamp || 0);
    sc = upsertLabSidecar(sc, set, ts);
  }
  return sc;
}

module.exports = {
  HOST_LAB_SET_CAP,
  emptySidecar,
  upsertLabSidecar,
  deleteLabSidecarSet,
  assembleLabHistory,
  latestSetAt,
  labMetaFromSidecar,
  sidecarPath,
  readLabSidecar,
  readLabSidecarSync,
  writeLabSidecar,
  writeLabSidecarSync,
  sidecarFromLabHistory,
};
