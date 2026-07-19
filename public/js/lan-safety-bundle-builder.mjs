/**
 * Builds a stripped "safety bundle" for untyped domains.
 *
 * Only fields NOT managed by typed mutation endpoints are included in each
 * patient entry. The bundle sets entriesPartial: true so a V1 host calls
 * mergePartialEntry and preserves typed-path state (nota, indicaciones, labs).
 */

/** Fields managed by typed endpoints — excluded from safety bundle entries. */
export const TYPED_ENTRY_FIELDS = new Set([
  'note',
  'indicaciones',
  'labHistory',
  'todos',
]);

/**
 * Strips typed fields from patient entries and optionally filters to only
 * dirty patients.
 *
 * @param {object[]} allEntries - Full patient entry array from local state.
 * @param {Set<string>} [dirtyPatientIds] - If provided, only include entries
 *   whose `id` is in this set. If omitted, include all entries.
 * @returns {object[]} Stripped entries safe to include in a safety bundle.
 */
export function buildSafetyBundleEntries(allEntries, dirtyPatientIds) {
  if (!Array.isArray(allEntries)) return [];
  return allEntries
    .filter((e) => {
      if (!e || !e.id) return false;
      if (dirtyPatientIds && !dirtyPatientIds.has(e.id)) return false;
      return true;
    })
    .map((e) => {
      const stripped = {};
      for (const [key, val] of Object.entries(e)) {
        if (!TYPED_ENTRY_FIELDS.has(key)) {
          stripped[key] = val;
        }
      }
      return stripped;
    });
}
