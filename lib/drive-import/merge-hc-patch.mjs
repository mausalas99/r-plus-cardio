function isEmptyString(v) {
  return v == null || (typeof v === 'string' && !String(v).trim());
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {Record<string, unknown>} tgt
 * @param {Record<string, unknown>} src
 * @returns {Record<string, unknown>}
 */
function mergeObjectFill(tgt, src) {
  const out = Object.assign({}, tgt);
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue;
    if (isPlainObject(v)) {
      const base = isPlainObject(out[k]) ? /** @type {Record<string, unknown>} */ (out[k]) : {};
      out[k] = mergeObjectFill(base, /** @type {Record<string, unknown>} */ (v));
    } else if (Array.isArray(v)) {
      if (!Array.isArray(out[k]) || !out[k].length) out[k] = v.slice();
    } else if (isEmptyString(out[k])) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} tgt
 * @param {Record<string, unknown>} src
 * @returns {Record<string, unknown>}
 */
function mergeObjectReplace(tgt, src) {
  const out = Object.assign({}, tgt);
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = mergeObjectReplace(
        /** @type {Record<string, unknown>} */ (out[k]),
        /** @type {Record<string, unknown>} */ (v),
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} existing
 * @param {Record<string, unknown>} patch
 * @param {'fill' | 'replace'} mode
 * @returns {Record<string, unknown>}
 */
export function mergeHcPatch(existing, patch, mode) {
  const base = Object.assign({}, existing || {});
  const p = patch || {};
  if (mode === 'replace') return mergeObjectReplace(base, p);
  return mergeObjectFill(base, p);
}
