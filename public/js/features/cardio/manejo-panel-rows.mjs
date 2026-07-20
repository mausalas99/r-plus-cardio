import {
  FANTASTICO_CLASSES,
  isMisplacedFantasticoDrug,
} from '../../../../lib/cardio/med-segments.mjs';

/**
 * Ensure exactly four fantástico rows aligned to FANTASTICO_CLASSES.
 * @param {unknown} fantasticos
 * @returns {Array<{ className: string, drug: string, inicio: string, dosis: string, tolerancia: string }>}
 */
export function normalizeFantasticosRows(fantasticos) {
  var byClass = new Map();
  if (Array.isArray(fantasticos)) {
    for (var i = 0; i < fantasticos.length; i++) {
      var row = fantasticos[i];
      if (!row || typeof row !== 'object') continue;
      var key = String(row.className || '').trim();
      if (!key) continue;
      byClass.set(key, {
        className: key,
        drug: String(row.drug || ''),
        inicio: String(row.inicio || ''),
        dosis: String(row.dosis || ''),
        tolerancia: String(row.tolerancia || ''),
      });
    }
  }
  return FANTASTICO_CLASSES.map(function (className) {
    var row = byClass.get(className) || {
      className: className,
      drug: '',
      inicio: '',
      dosis: '',
      tolerancia: '',
    };
    var drug = row.drug;
    // Drop values clearly belonging to another pillar / diuretics (e.g. Furosemida in SGLT2i).
    if (isMisplacedFantasticoDrug(className, drug)) drug = '';
    return {
      className: className,
      drug: drug,
      inicio: row.inicio,
      dosis: row.dosis,
      tolerancia: row.tolerancia,
    };
  });
}

/**
 * @param {unknown} fantasticos
 * @param {string} className
 * @param {'drug' | 'inicio' | 'dosis' | 'tolerancia'} field
 * @param {unknown} value
 */
export function updateFantasticoField(fantasticos, className, field, value) {
  var rows = normalizeFantasticosRows(fantasticos);
  return rows.map(function (row) {
    if (row.className !== className) return Object.assign({}, row);
    var next = Object.assign({}, row);
    next[field] = String(value == null ? '' : value);
    return next;
  });
}

/**
 * @param {unknown} segments
 * @returns {Array<{
 *   id: string,
 *   tipo: string,
 *   inicio: string,
 *   dosis: string,
 *   indicacion: string,
 *   endedAt: string | null,
 *   mgTotal: number | null,
 *   active: boolean,
 * }>}
 */
export function buildSegmentRows(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .filter(function (s) {
      return s && typeof s === 'object';
    })
    .map(function (s) {
      var endedAt = s.endedAt == null || s.endedAt === '' ? null : String(s.endedAt);
      var mgRaw = s.mgTotal;
      var mgTotal =
        mgRaw == null || mgRaw === ''
          ? null
          : Number.isFinite(Number(mgRaw))
            ? Number(mgRaw)
            : null;
      return {
        id: String(s.id || ''),
        tipo: String(s.tipo || ''),
        inicio: String(s.inicio || ''),
        dosis: String(s.dosis || ''),
        indicacion: String(s.indicacion || ''),
        endedAt: endedAt,
        mgTotal: mgTotal,
        active: !endedAt,
      };
    });
}

/**
 * @param {{
 *   tipo?: unknown,
 *   inicio?: unknown,
 *   endedAt?: unknown,
 *   dosis?: unknown,
 *   indicacion?: unknown,
 *   mgTotal?: unknown,
 * }} draft
 */
export function serializeSegmentDraft(draft) {
  var src = draft && typeof draft === 'object' ? draft : {};
  var mgRaw = src.mgTotal;
  var mgTotal = null;
  if (mgRaw != null && String(mgRaw).trim() !== '') {
    var n = Number(mgRaw);
    mgTotal = Number.isFinite(n) ? n : null;
  }
  var endedRaw = String(src.endedAt == null ? '' : src.endedAt).trim();
  return {
    tipo: String(src.tipo || '').trim(),
    inicio: String(src.inicio || '').trim(),
    endedAt: endedRaw || null,
    dosis: String(src.dosis || '').trim(),
    indicacion: String(src.indicacion || '').trim(),
    mgTotal: mgTotal,
  };
}

/**
 * @param {unknown} catalog
 * @param {string} [currentTipo]
 * @returns {string[]}
 */
export function catalogTipoOptions(catalog, currentTipo) {
  /** @type {string[]} */
  var opts = [];
  /** @type {Set<string>} */
  var seen = new Set();
  if (Array.isArray(catalog)) {
    for (var i = 0; i < catalog.length; i++) {
      var entry = catalog[i];
      var tipo = entry && String(entry.tipo || '').trim();
      if (!tipo) continue;
      var key = tipo.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push(tipo);
    }
  }
  var cur = String(currentTipo || '').trim();
  if (cur && !seen.has(cur.toLowerCase())) opts.push(cur);
  return opts;
}
