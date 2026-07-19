/**
 * Push lab-history consolidation / deletion to the LAN host (typed endpoints).
 */
import { labHistory } from './app-state.mjs';
import { lanMutationRegistry } from './lan-mutation-registry.mjs';

function lanClientTimestamp() {
  return Date.now();
}

function stampLabSetForLan(set) {
  const clientTimestamp = lanClientTimestamp();
  const stamped = {
    ...set,
    _clientTimestamp: clientTimestamp,
    updatedAt: new Date().toISOString(),
  };
  return { set: stamped, clientTimestamp };
}

/**
 * @param {string} patientId
 * @param {object} set
 */
export function pushLabHistorySetToLan(patientId, set) {
  if (!patientId || !set || !set.id) return;
  const { set: stamped } = stampLabSetForLan(set);
  set._clientTimestamp = stamped._clientTimestamp;
  set.updatedAt = stamped.updatedAt;
  void lanMutationRegistry.dispatchLanMutation('lab-history', patientId, stamped);
}

/**
 * @param {string} patientId
 * @param {string} setId
 * @param {number} [clientTimestamp]
 */
export function pushLabHistoryDeleteToLan(patientId, setId, clientTimestamp) {
  if (!patientId || !setId) return;
  void lanMutationRegistry.dispatchLanMutation('lab-history-delete', patientId, {
    setId: String(setId),
    clientTimestamp: Number(clientTimestamp || lanClientTimestamp()),
  });
}

/**
 * After consolidation: upsert keeper sets and tombstone removed ids on the host.
 * @param {string} patientId
 * @param {{ keeperIds?: string[], removedIds?: string[] }} result
 */
export function syncLabHistoryConsolidationToLan(patientId, result) {
  if (!patientId || !result) return;
  const keeperIds = new Set((result.keeperIds || []).map(String));
  const removedIds = (result.removedIds || []).map(String).filter(Boolean);
  if (!keeperIds.size && !removedIds.length) return;

  const sets = labHistory[patientId] || [];
  sets.forEach(function (set) {
    if (set && keeperIds.has(String(set.id))) {
      pushLabHistorySetToLan(patientId, set);
    }
  });
  removedIds.forEach(function (setId) {
    pushLabHistoryDeleteToLan(patientId, setId);
  });
}

/**
 * @param {string} patientId
 * @param {string[]} setIds
 */
export function syncLabHistoryDeletesToLan(patientId, setIds) {
  if (!patientId || !setIds || !setIds.length) return;
  setIds.forEach(function (setId) {
    pushLabHistoryDeleteToLan(patientId, setId);
  });
}
