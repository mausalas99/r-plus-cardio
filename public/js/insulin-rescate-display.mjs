/**
 * Agrupa insulinas PRN SC por glucometría (rescates) en Manejo y Estado Actual.
 */

import {
  isInsulinRescateMedicationItem,
  insulinRescateItemsFromList,
  patientHasInsulinRescateMeds,
} from './insulin-rescate-detect.mjs';

export const INSULIN_RESCATE_GROUP_ID = '__insulin_rescate_group__';
export const INSULIN_RESCATE_NM_LABEL = 'RESCATES DE INSULINA';

export {
  isInsulinRescateMedicationItem,
  insulinRescateItemsFromList,
  patientHasInsulinRescateMeds,
} from './insulin-rescate-detect.mjs';

/**
 * @param {unknown[]} allItems
 * @param {unknown[]} soapSelected
 * @returns {string | null}
 */
export function insulinRescateNmSoapFragment(allItems, soapSelected) {
  if (!patientHasInsulinRescateMeds(allItems)) return null;
  var selected = Array.isArray(soapSelected) ? soapSelected : [];
  var hasRescateSoap = selected.some(isInsulinRescateMedicationItem);
  if (!hasRescateSoap) return null;
  return INSULIN_RESCATE_NM_LABEL;
}

/**
 * @param {unknown} item
 * @param {unknown[]} allItems
 * @returns {boolean}
 */
export function skipRecetaItemForInsulinRescateBucket(item, allItems) {
  if (!patientHasInsulinRescateMeds(allItems)) return false;
  return isInsulinRescateMedicationItem(item);
}

/**
 * @param {unknown[]} items
 * @param {(s: string) => string} escFn
 * @returns {string}
 */
export function insulinRescateMedLabelHtml(escFn) {
  return escFn(INSULIN_RESCATE_NM_LABEL);
}

/**
 * @param {string} patientId
 * @param {unknown[]} items
 * @param {(patientId: string, itemId: string) => boolean} isSelectedFn
 * @returns {boolean}
 */
export function isInsulinRescateGroupSoapSelected(patientId, items, isSelectedFn) {
  var rescates = insulinRescateItemsFromList(items);
  if (!rescates.length) return false;
  return rescates.some(function (it) {
    return isSelectedFn(patientId, String(/** @type {{ id?: unknown }} */ (it).id || ''));
  });
}

/**
 * @param {string} patientId
 * @param {unknown[]} items
 * @param {(patientId: string, itemId: string) => boolean} isSuspendedFn
 * @returns {boolean}
 */
export function isInsulinRescateGroupSuspended(items, isSuspendedFn) {
  var rescates = insulinRescateItemsFromList(items);
  if (!rescates.length) return false;
  return rescates.every(function (it) {
    return isSuspendedFn(String(/** @type {{ id?: unknown }} */ (it).id || ''));
  });
}
