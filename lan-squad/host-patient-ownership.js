'use strict';

/**
 * Mirror of public/js/features/lan/host-patients-annotate.mjs — keep both in sync.
 * clientId is bound via X-Client-Token when available (plan 010); query fallback is
 * audited; isProgramAdmin remains a client assertion pending RBAC.
 */

/** @param {object|null|undefined} row */
function resolveHostPatientOwnerClientId(row) {
  const audit = Array.isArray(row?.audit_log) ? row.audit_log : [];
  const createEntry =
    audit.find(function (e) {
      return e && e.action === 'patient.create';
    }) || null;
  return String(createEntry?.clientId || '').trim();
}

/**
 * True when another LAN device registered the chart (this client should not purge it).
 * @param {object|null|undefined} row
 * @param {string} [requesterClientId]
 */
function isHostPatientOwnedByOtherClient(row, requesterClientId) {
  const local = String(requesterClientId || '').trim();
  const ownerClientId = resolveHostPatientOwnerClientId(row);
  if (!local || !ownerClientId || ownerClientId === 'host') return false;
  return ownerClientId !== local;
}

/**
 * Server-side purge guard for live census rows.
 * @param {object|null|undefined} row
 * @param {string} [requesterClientId]
 * @param {boolean} [isProgramAdmin]
 */
function shouldBlockHostPatientPurge(row, requesterClientId, isProgramAdmin) {
  if (isProgramAdmin) return false;
  const ownerClientId = resolveHostPatientOwnerClientId(row);
  if (!ownerClientId || ownerClientId === 'host') return false;
  const requester = String(requesterClientId || '').trim();
  if (!requester) return true;
  return isHostPatientOwnedByOtherClient(row, requester);
}

/**
 * @param {object} store
 * @param {string} patientId
 * @param {string} clientId
 * @param {boolean} isProgramAdmin
 */
function evaluateHostPatientPurgeGuard(store, patientId, clientId, isProgramAdmin) {
  const id = String(patientId || '').trim();
  const liveRow = store.getState().patients.find((p) => p && p.id === id && !p._deleted);
  if (!liveRow) return { blocked: false };
  if (shouldBlockHostPatientPurge(liveRow, clientId, isProgramAdmin)) {
    return { blocked: true, patientId: id, clientId: String(clientId || '').trim() || null };
  }
  return { blocked: false };
}

module.exports = {
  resolveHostPatientOwnerClientId,
  isHostPatientOwnedByOtherClient,
  shouldBlockHostPatientPurge,
  evaluateHostPatientPurgeGuard,
};
