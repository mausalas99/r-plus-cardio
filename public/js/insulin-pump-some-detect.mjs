/** Detección de bomba de insulina IV en bloques SOME (MEDICAMENTOS P2 + algoritmo). */

import { parseIndicacionesPaste } from './med-receta-parse.mjs';

/** `BOMBA EN ALGORITMO 2` o `BOMBA ALGORITMO 2` (SOME a veces omite «EN» en el diluyente P1/P2). */
var BOMBA_ALGORITMO_RE = /BOMBA\s+(?:EN\s+)?ALGORITMO\s*(\d)/i;
var INSULIN_IV_RE = /\bINSULINA\b/i;
var IV_VIA_RE = /\b(?:VIA\s+)?INTRAVENOSA\b|\bIV\b/i;

/**
 * @param {unknown} text
 * @returns {number | null} 1–4
 */
export function parseInsulinPumpAlgorithmFromText(text) {
  var m = String(text || '').match(BOMBA_ALGORITMO_RE);
  if (!m) return null;
  var n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 4) return null;
  return n;
}

/**
 * Insulina IV en SOME (p. ej. INSULINA HUMANA RAPIDA 100 UI).
 * @param {{ nombreRaw?: unknown, dosisRaw?: unknown, viaRaw?: unknown, suspendido?: boolean }} item
 * @returns {boolean}
 */
export function isInsulinIvMedicationItem(item) {
  if (!item || item.suspendido) return false;
  var nombre = String(item.nombreRaw || '');
  if (!INSULIN_IV_RE.test(nombre)) return false;
  var via = String(item.viaRaw || '');
  return IV_VIA_RE.test(via) || /\bINTRAVENOSA\b/i.test(via);
}

/**
 * @param {unknown[]} items
 * @returns {number | null} 1–4 when carrier + insulina IV; null otherwise
 */
export function detectInsulinPumpAlgorithmFromRecetaItems(items) {
  var list = Array.isArray(items) ? items : [];
  var algorithm = null;
  var hasInsulinIv = false;

  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || typeof it !== 'object' || it.suspendido) continue;
    if (isInsulinIvMedicationItem(it)) hasInsulinIv = true;
    var blob = [it.nombreRaw, it.dosisRaw, it.frecuenciaRaw, it.viaRaw].join(' ');
    var alg = parseInsulinPumpAlgorithmFromText(blob);
    if (alg != null) algorithm = alg;
  }

  if (algorithm != null && hasInsulinIv) return algorithm;
  return null;
}

/**
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} block
 * @returns {number | null}
 */
export function detectInsulinPumpAlgorithmFromRecetaBlock(block) {
  if (!block) return null;
  var fromItems = detectInsulinPumpAlgorithmFromRecetaItems(block.items);
  if (fromItems != null) return fromItems;
  if (Array.isArray(block.items) && block.items.length) return null;
  var raw = String(block.pasteRaw || '');
  if (!raw.trim()) return null;
  return detectInsulinPumpAlgorithmFromRecetaItems(parseIndicacionesPaste(raw).items);
}

/**
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} block
 * @returns {boolean}
 */
export function patientHasInsulinPumpInReceta(block) {
  return detectInsulinPumpAlgorithmFromRecetaBlock(block) != null;
}

/**
 * @param {number | null | undefined} algorithmNumber
 * @returns {string}
 */
export function formatInsulinPumpAlgoritmoLabel(algorithmNumber) {
  var n = Number(algorithmNumber);
  if (!Number.isFinite(n) || n < 1 || n > 4) return '';
  return 'BOMBA DE INSULINA EN ALGORITMO ' + n;
}

/**
 * @param {number | null | undefined} algorithmNumber
 * @returns {string}
 */
export function formatInsulinPumpAlgorithmPill(algorithmNumber) {
  var n = Number(algorithmNumber);
  if (!Number.isFinite(n) || n < 1 || n > 4) return '';
  return 'ALGORITMO ' + n;
}

/**
 * Diluyente P1/P2 con «BOMBA ALGORITMO N» cuando el bloque activa bomba + insulina IV.
 * @param {unknown} item
 * @param {unknown[]} allItems
 * @returns {boolean}
 */
export function isInsulinPumpCarrierMedicationItem(item, allItems) {
  if (!item || typeof item !== 'object' || /** @type {{ suspendido?: boolean }} */ (item).suspendido) {
    return false;
  }
  if (isInsulinIvMedicationItem(/** @type {Parameters<typeof isInsulinIvMedicationItem>[0]} */ (item))) {
    return false;
  }
  if (detectInsulinPumpAlgorithmFromRecetaItems(allItems) == null) return false;
  var blob = [
    /** @type {{ nombreRaw?: unknown, dosisRaw?: unknown, frecuenciaRaw?: unknown, viaRaw?: unknown }} */ (
      item
    ).nombreRaw,
    /** @type {{ dosisRaw?: unknown }} */ (item).dosisRaw,
    /** @type {{ frecuenciaRaw?: unknown }} */ (item).frecuenciaRaw,
    /** @type {{ viaRaw?: unknown }} */ (item).viaRaw,
  ].join(' ');
  return parseInsulinPumpAlgorithmFromText(blob) != null;
}

/**
 * @param {unknown[]} items
 * @param {{ nombreRaw?: unknown, dosisRaw?: unknown, viaRaw?: unknown, suspendido?: boolean }} item
 * @returns {number | null}
 */
export function insulinPumpAlgorithmForMedicationItem(items, item) {
  if (!isInsulinIvMedicationItem(item)) return null;
  return detectInsulinPumpAlgorithmFromRecetaItems(items);
}

/**
 * @param {number} algorithmNumber
 * @param {string} escFn HTML escaper
 * @returns {string}
 */
export function insulinPumpMedLabelHtml(algorithmNumber, escFn) {
  var pill = formatInsulinPumpAlgorithmPill(algorithmNumber);
  if (!pill) return escFn('BOMBA DE INSULINA');
  return (
    escFn('BOMBA DE INSULINA') +
    ' <span class="med-insulin-pump-alg-pill">' +
    escFn(pill) +
    '</span>'
  );
}
