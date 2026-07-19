/** @typedef {'census_delete' | 'versioned_delete' | 'outbox_delete'} LanPatientDeleteStep */

/**
 * Explicit delete transport order for host patient purge.
 * @param {boolean} hasCensusRow
 * @param {{ hostOnly?: boolean }} [opts]
 * @returns {LanPatientDeleteStep[]}
 */
export function resolveLanPatientDeleteSteps(hasCensusRow, opts) {
  if (opts && opts.hostOnly) return ['census_delete'];
  if (!hasCensusRow) return ['census_delete', 'census_delete'];
  return ['versioned_delete', 'census_delete', 'outbox_delete'];
}
