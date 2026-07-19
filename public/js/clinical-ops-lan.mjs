/**
 * LAN LiveSync helpers for V2 clinical ops SQL tables (rotation, assignments, guardia).
 */

import {
  mergeClinicalOpsFromSourcesData,
  mergeClinicalOpsSnapshotsData,
} from './clinical-ops-bundle-merge.mjs';
import { recordClinicalOpsTrace } from './lan-sync-diagnostics.mjs';

let cachedSnapshot = null;
/** @type {object|null} */
let pendingClinicalOpsSnapshot = null;

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

export function isClinicalOpsLanAvailable() {
  const api = dbApi();
  return !!(
    api &&
    typeof api.dbClinicalOpsExport === 'function' &&
    typeof api.dbClinicalOpsMerge === 'function'
  );
}

/** @returns {Promise<object|null>} */
export async function refreshClinicalOpsSnapshotCache() {
  cachedSnapshot = await collectClinicalOpsForLanSync();
  return cachedSnapshot;
}

/** Refresh export cache when LAN bundles are built or clinical session starts. */
export async function prepareClinicalOpsForLanSync() {
  if (!isClinicalOpsLanAvailable()) return null;
  return refreshClinicalOpsSnapshotCache();
}

/** @returns {object|null} */
export function getCachedClinicalOpsSnapshot() {
  return cachedSnapshot;
}

/** @returns {Promise<object|null>} */
export async function collectClinicalOpsForLanSync() {
  const api = dbApi();
  if (!api || typeof api.dbClinicalOpsExport !== 'function') return null;
  const res = await api.dbClinicalOpsExport();
  if (!res || res.ok === false) return null;
  const snap = res.snapshot && typeof res.snapshot === 'object' ? res.snapshot : null;
  if (snap) {
    recordClinicalOpsTrace('export', {
      usersExported: Array.isArray(snap.clinical_users) ? snap.clinical_users.length : 0,
      teamMembership: Array.isArray(snap.team_membership) ? snap.team_membership.length : 0,
    });
  }
  return snap;
}

/** @param {object|null|undefined} mergeStats */
export function clinicalOpsMergeHadChanges(mergeStats) {
  if (!mergeStats || typeof mergeStats !== 'object') return false;
  return Object.keys(mergeStats).some((key) => {
    const value = mergeStats[key];
    return typeof value === 'number' && value > 0;
  });
}

function deferClinicalOpsLanSnapshot(snapshot) {
  pendingClinicalOpsSnapshot = snapshot;
  recordClinicalOpsTrace('merge', {
    ok: false,
    changed: false,
    deferred: true,
    code: 'DB_LOCKED',
    incomingUsers: Array.isArray(snapshot?.clinical_users) ? snapshot.clinical_users.length : 0,
    mergeStats: null,
  });
  return { ok: false, changed: false, code: 'DB_LOCKED', deferred: true };
}

/** Apply clinical-ops snapshot queued while SQLCipher was still locked. */
export async function flushPendingClinicalOpsLanSnapshot() {
  if (!pendingClinicalOpsSnapshot) return { ok: true, changed: false };
  const snap = pendingClinicalOpsSnapshot;
  pendingClinicalOpsSnapshot = null;
  return applyClinicalOpsLanSnapshot(snap);
}

function recordClinicalOpsMergeTrace(snapshot, res, ok, changed) {
  recordClinicalOpsTrace('merge', {
    ok,
    changed,
    incomingUsers: Array.isArray(snapshot.clinical_users) ? snapshot.clinical_users.length : 0,
    mergeStats: res && res.mergeStats ? res.mergeStats : null,
    code: ok ? undefined : res?.code,
    error: ok ? undefined : res?.error,
  });
}

function dispatchClinicalOpsSynced(mergeStats) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('rpc-clinical-ops-synced', { detail: { mergeStats: mergeStats || null } })
  );
}

function buildClinicalOpsMergeResult(res, ok, changed) {
  return {
    ok,
    changed,
    code: ok ? undefined : res?.code,
    error: ok ? undefined : res?.error,
  };
}

async function mergeClinicalOpsSnapshot(api, snapshot) {
  const res = await api.dbClinicalOpsMerge({ snapshot });
  if (res?.code === 'DB_LOCKED') return deferClinicalOpsLanSnapshot(snapshot);
  const ok = res?.ok !== false;
  const changed = ok && clinicalOpsMergeHadChanges(res?.mergeStats);
  recordClinicalOpsMergeTrace(snapshot, res, ok, changed);
  if (ok && changed) dispatchClinicalOpsSynced(res?.mergeStats);
  return buildClinicalOpsMergeResult(res, ok, changed);
}

/**
 * @param {object|null} snapshot
 * @returns {Promise<{ ok: boolean, changed: boolean, code?: string, deferred?: boolean }>}
 */
export async function applyClinicalOpsLanSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, changed: false };
  const api = dbApi();
  if (!api || typeof api.dbClinicalOpsMerge !== 'function') return { ok: false, changed: false };
  return mergeClinicalOpsSnapshot(api, snapshot);
}

/** @param {object[]} sources */
export function mergeClinicalOpsFromSources(sources) {
  return mergeClinicalOpsFromSourcesData(sources);
}

export { mergeClinicalOpsSnapshotsData };
