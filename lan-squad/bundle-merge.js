'use strict';
const {
  todoEntityKey,
  agendaEntityKey,
  collectKeysFromBundlePayload,
} = require('./entity-keys.js');
const { compareUpdatedAt, recordTimestamp } = require('./lww-utils.js');
const { appendAudit } = require('./audit-log.js');
const {
  revisionSkewFailure,
  collectEntityConflicts,
  mergeAgendaSection,
  mergeTodosSection,
  mergeEntriesSection,
  mergeManejoSection,
  mergeClinicalOpsSection,
} = require('./bundle-merge-sections.js');

function emptyBundle(nowIso) {
  return {
    revision: 0,
    entityVersions: {},
    agenda: [],
    todos: {},
    entries: [],
    manejo: null,
    clinicalOps: null,
    uploadedByClientId: '',
    committedAt: nowIso,
    audit_log: [],
  };
}

function agendaById(agenda) {
  const map = new Map();
  for (const ev of agenda) {
    if (ev && ev.id) map.set(ev.id, ev);
  }
  return map;
}

function todosByKey(todos) {
  const map = new Map();
  if (!todos || typeof todos !== 'object') return map;
  for (const pid of Object.keys(todos)) {
    const arr = Array.isArray(todos[pid]) ? todos[pid] : [];
    for (const t of arr) {
      if (t && t.id) map.set(todoEntityKey(pid, t.id), { patientId: pid, item: t });
    }
  }
  return map;
}

function materializeTodos(map) {
  const todos = {};
  for (const { patientId, item } of map.values()) {
    if (!todos[patientId]) todos[patientId] = [];
    todos[patientId].push(item);
  }
  return todos;
}

/** Fields whose values are maintained by typed endpoints — never overwritten by safety bundle. */
const TYPED_ENTRY_FIELDS = new Set(['note', 'indicaciones', 'labHistory', 'todos']);

/**
 * Merges a safety-bundle (partial) entry into the server's version.
 * Typed fields are preserved from serverEntry; all other fields come from incomingEntry.
 * New entries (no server match) are not handled here — they are appended directly.
 *
 * @param {object} serverEntry - Current server entry for this patient.
 * @param {object} incomingEntry - Entry from the partial safety bundle.
 * @returns {object} Merged entry.
 */
function mergePartialEntry(serverEntry, incomingEntry) {
  const merged = { ...serverEntry };
  for (const [key, val] of Object.entries(incomingEntry)) {
    if (!TYPED_ENTRY_FIELDS.has(key)) {
      merged[key] = val;
    }
  }
  return merged;
}

function mergeEntityLww(serverRec, incomingRec) {
  const cmp = compareUpdatedAt(recordTimestamp(serverRec), recordTimestamp(incomingRec));
  if (cmp < 0) return { winner: incomingRec, overwritten: true };
  if (cmp > 0) return { winner: serverRec, overwritten: false };
  return {
    winner: incomingRec,
    overwritten: JSON.stringify(serverRec) !== JSON.stringify(incomingRec),
  };
}

/**
 * @param {object | null} serverBundle
 * @param {object} incoming
 * @param {{ clientId?: string, nowIso: () => string }} opts
 */
/** @param {object} bundle @param {object} params */
function commitBundleRevision_(bundle, params) {
  const { payloadKeys, serverEntityVersions, serverRevision, nowIso, clientId } = params;
  const nextEntityVersions = { ...serverEntityVersions };
  for (const key of payloadKeys) {
    nextEntityVersions[key] = Number(nextEntityVersions[key] || 0) + 1;
  }
  bundle.entityVersions = nextEntityVersions;
  bundle.revision = serverRevision + 1;
  bundle.committedAt = nowIso;
  bundle.uploadedByClientId = clientId;
  if (!Array.isArray(bundle.audit_log)) bundle.audit_log = [];
  appendAudit(
    {
      at: nowIso,
      clientId: clientId || 'host',
      action: 'bundle.put',
      detail: { revision: bundle.revision, keys: [...payloadKeys] },
    },
    bundle.audit_log
  );
}

function normalizeMergeIncoming(incoming) {
  return incoming && typeof incoming === 'object' ? incoming : {};
}

function resolveServerBundle(serverBundle, nowIso) {
  if (serverBundle && typeof serverBundle === 'object') return serverBundle;
  return emptyBundle(nowIso);
}

function copyEntityVersions(bundle) {
  if (bundle.entityVersions && typeof bundle.entityVersions === 'object') {
    return { ...bundle.entityVersions };
  }
  return {};
}

function prepareMergeBundlePut_(serverBundle, incoming, opts) {
  const nowIso = opts.nowIso();
  const clientId = String((incoming && incoming.clientId) || opts.clientId || '');
  const base = normalizeMergeIncoming(incoming);
  const baseRevision = Number(base.baseRevision != null ? base.baseRevision : 0);
  const baseEntityVersions =
    base.baseEntityVersions && typeof base.baseEntityVersions === 'object'
      ? base.baseEntityVersions
      : {};
  const bundle = resolveServerBundle(serverBundle, nowIso);
  const serverRevision = Number(bundle.revision || 0);
  const serverEntityVersions = copyEntityVersions(bundle);
  const payloadKeys = collectKeysFromBundlePayload(base);
  const payloadKeyList = [...payloadKeys];
  const revisionSkew = serverRevision > 0 && baseRevision !== serverRevision;

  return {
    nowIso,
    clientId,
    base,
    baseRevision,
    baseEntityVersions,
    bundle,
    serverRevision,
    serverEntityVersions,
    payloadKeys,
    payloadKeyList,
    revisionSkew,
  };
}

function mergeBundlePut(serverBundle, incoming, opts) {
  const ctx = prepareMergeBundlePut_(serverBundle, incoming, opts);
  const lwwAppliedKeys = [];

  const skewFailure = revisionSkewFailure(
    ctx.serverRevision,
    ctx.baseRevision,
    ctx.payloadKeyList,
    ctx.bundle
  );
  if (skewFailure) return skewFailure;
  if (ctx.revisionSkew) lwwAppliedKeys.push('*');

  const { conflicts, autoMergedKeys } = collectEntityConflicts(
    ctx.payloadKeys,
    ctx.baseEntityVersions,
    ctx.serverEntityVersions,
    ctx.base,
    ctx.bundle
  );

  const conflictKeys = new Set(conflicts.map((c) => c.key));
  const mergeHelpers = {
    agendaById,
    agendaEntityKey,
    todosByKey,
    todoEntityKey,
    materializeTodos,
    mergeEntityLww,
  };

  mergeAgendaSection(ctx.bundle, ctx.base, conflictKeys, lwwAppliedKeys, mergeHelpers);
  mergeTodosSection(ctx.bundle, ctx.base, conflictKeys, lwwAppliedKeys, mergeHelpers);
  mergeEntriesSection(ctx.bundle, ctx.base, mergePartialEntry);
  mergeManejoSection(ctx.bundle, ctx.base);
  mergeClinicalOpsSection(ctx.bundle, ctx.base);

  commitBundleRevision_(ctx.bundle, {
    payloadKeys: ctx.payloadKeys,
    serverEntityVersions: ctx.serverEntityVersions,
    serverRevision: ctx.serverRevision,
    nowIso: ctx.nowIso,
    clientId: ctx.clientId,
  });

  return { ok: true, bundle: ctx.bundle, autoMergedKeys, lwwAppliedKeys };
}

module.exports = { mergeBundlePut, emptyBundle };
