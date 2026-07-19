/**
 * Insulin rescue (rescate) helpers for glucometrías in Estado Actual.
 */

/** @typedef {{ minMgDl: number, maxMgDl: number, units: number }} InsulinRescateTier */

var RESCATE_TIER_RE =
  /\b(\d{2,3})\s*[-–—]\s*(\d{2,3})\b(?:\s*(?:MG\/DL|MG\s*\/\s*DL|MGDL|DESTROX(?:IAS)?|GLUCOSA)?)?\s*[:\s,;]*(\d+(?:[.,]\d+)?)\s*(?:UI|U\.?I\.?|UNIDADES?)\b/gi;

/**
 * @param {unknown} n
 * @returns {string}
 */
function num(n) {
  if (n == null || n === '') return '___';
  return String(n);
}

/**
 * Criterio SOME típico: rango de glucosa + dosis (p. ej. "180-220 4UI", "221-250 MG/DL 6 UI").
 * @param {unknown} text
 * @returns {InsulinRescateTier[]}
 */
var RESCATE_UNITS_ENTRE_RE =
  /(\d+(?:[.,]\d+)?)\s*(?:UI|U\.?I\.?|UNIDADES?)\b[\s\S]*?ENTRE\s+(\d{2,3})\s*[-–—]\s*(\d{2,3})/gi;
var RESCATE_UNITS_GT_RE = /(\d+(?:[.,]\d+)?)\s*(?:UI|U\.?I\.?|UNIDADES?)\b[\s\S]*?>\s*(\d{2,3})/gi;

/**
 * @param {InsulinRescateTier[]} tiers
 * @param {number} minMgDl
 * @param {number} maxMgDl
 * @param {number} units
 */
function pushRescateTier(tiers, minMgDl, maxMgDl, units) {
  if (!Number.isFinite(minMgDl) || !Number.isFinite(maxMgDl) || !Number.isFinite(units)) return;
  if (minMgDl >= maxMgDl || units <= 0) return;
  tiers.push({ minMgDl: minMgDl, maxMgDl: maxMgDl, units: units });
}

export function parseInsulinRescateCriteria(text) {
  var s = String(text || '');
  if (!s.trim()) return [];
  /** @type {InsulinRescateTier[]} */
  var tiers = [];
  var re = new RegExp(RESCATE_TIER_RE.source, 'gi');
  var m;
  while ((m = re.exec(s)) !== null) {
    pushRescateTier(
      tiers,
      Number(m[1]),
      Number(m[2]),
      Number(String(m[3]).replace(',', '.'))
    );
  }
  var entreRe = new RegExp(RESCATE_UNITS_ENTRE_RE.source, 'gi');
  while ((m = entreRe.exec(s)) !== null) {
    pushRescateTier(
      tiers,
      Number(m[2]),
      Number(m[3]),
      Number(String(m[1]).replace(',', '.'))
    );
  }
  var gtRe = new RegExp(RESCATE_UNITS_GT_RE.source, 'gi');
  while ((m = gtRe.exec(s)) !== null) {
    var threshold = Number(m[2]);
    pushRescateTier(tiers, threshold, threshold + 200, Number(String(m[1]).replace(',', '.')));
  }
  return tiers;
}

/**
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} block
 * @returns {string}
 */
function collectRecetaBlockText(block) {
  if (!block) return '';
  var parts = [String(block.pasteRaw || '')];
  if (Array.isArray(block.items)) {
    block.items.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      /** @type {any} */
      var it = item;
      parts.push(String(it.nombreRaw || ''));
      parts.push(String(it.dosisRaw || ''));
      parts.push(String(it.frecuenciaRaw || ''));
      parts.push(String(it.viaRaw || ''));
    });
  }
  return parts.join('\n');
}

/**
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} block
 * @returns {InsulinRescateTier[]}
 */
export function insulinRescateCriteriaFromRecetaBlock(block) {
  return parseInsulinRescateCriteria(collectRecetaBlockText(block));
}

/**
 * SOME incluye escala de rescate (rango glucosa + UI), p. ej. en CUIDADOS o dosis de insulina.
 * @param {{ pasteRaw?: unknown, items?: unknown[] } | null | undefined} block
 * @returns {boolean}
 */
export function patientHasInsulinRescatesInReceta(block) {
  return insulinRescateCriteriaFromRecetaBlock(block).length > 0;
}

/**
 * @param {Array<{ value?: unknown, time?: string, rescueUnits?: unknown, postRescueValue?: unknown }> | null | undefined} glucometrias
 * @param {{ rescatesInSome?: boolean } | null | undefined} [opts]
 * @returns {string} Empty when no glucometrías in snapshot or no rescates in SOME (unless applied).
 */
export function formatInsulinRescatesClause(glucometrias, opts) {
  const glus = Array.isArray(glucometrias) ? glucometrias : [];
  const hasGlu = glus.some(function (g) {
    return g && g.value != null && g.value !== '';
  });
  if (!hasGlu) return '';

  const applied = glus.filter(function (g) {
    if (!g || typeof g !== 'object') return false;
    const u = Number(/** @type {{ rescueUnits?: unknown }} */ (g).rescueUnits);
    return Number.isFinite(u) && u > 0;
  });

  if (applied.length) return '';

  opts = opts || {};
  if (opts.rescatesInSome === false) return '';
  return 'RESCATES DE INSULINA DISPONIBLES';
}
