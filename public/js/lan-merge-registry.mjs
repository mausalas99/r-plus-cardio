/**
 * Domain merge dispatch for LAN room bundles (IM-12).
 */

import { mergeLiveSyncBundles } from './live-sync-room.mjs';
import {
  mergeLanPatientEntrySources,
  filterEntriesByPatientDeletes,
} from './lan-patient-merge.mjs';
import { attachTodosMapToPatientEntries } from './livesync-patient-ids.mjs';
import { mergeClinicalOpsFromSources } from './clinical-ops-lan.mjs';

/** @type {Record<string, (sources: object[]) => unknown>} */
const domainMergers = {
  agendaTodosPatients(sources) {
    return mergeLiveSyncBundles(sources);
  },
  patientEntries(sources) {
    return mergeLanPatientEntrySources(sources);
  },
  clinicalOps(sources) {
    return mergeClinicalOpsFromSources(sources);
  },
};

/**
 * Merge LAN room bundle sources (agenda/todos, patients, clinicalOps).
 * @param {object[]} sources
 */
export function mergeLiveSyncFullBundles(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const base = domainMergers.agendaTodosPatients(list);
  let entries = domainMergers.patientEntries(list);
  entries = filterEntriesByPatientDeletes(entries, base.patientDeletes || []);
  base.entries = attachTodosMapToPatientEntries(entries, base.todos, base.todoTouchedPatientIds);
  base.clinicalOps = domainMergers.clinicalOps(list);
  return base;
}

export { domainMergers };
