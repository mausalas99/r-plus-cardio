/**
 * @param {string} fecha
 * @returns {string}
 */
function normalizeFecha(fecha) {
  return String(fecha || '').trim();
}

/**
 * @param {string} fecha
 * @param {string} [hora]
 * @returns {string}
 */
export function calendarDayKeyFromLabSet({ fecha, hora }) {
  const t = normalizeFecha(fecha);
  if (!t || t === 'Anterior') return '';
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!m) return t;
  let y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (y < 100) y += 2000;
  const h = String(hora || '').trim();
  const hm = h.match(/^(\d{1,2}):(\d{2})/);
  if (hm) {
    const ms = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
    const withH =
      ms +
      (parseInt(hm[1], 10) * 3600 + parseInt(hm[2], 10) * 60) * 1000;
    const d = new Date(withH);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  return y + '-' + parseInt(m[2], 10) + '-' + parseInt(m[1], 10);
}

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function normalizeLabLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map(function (line) {
      return String(line || '')
        .trim()
        .replace(/\s+/g, ' ');
    })
    .filter(Boolean);
}

/**
 * @param {string[]} subset
 * @param {string[]} superset
 * @returns {boolean}
 */
function isSubsetLabLines(subset, superset) {
  const sub = normalizeLabLines(subset);
  const sup = normalizeLabLines(superset);
  if (!sub.length) return false;
  const supSet = new Set(sup);
  return sub.every(function (line) {
    return supSet.has(line);
  });
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
export function areDriveLabSetsEquivalent(a, b) {
  const aa = normalizeLabLines(a);
  const bb = normalizeLabLines(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

/**
 * @param {{ fecha?: string, hora?: string, resLabs?: string[] }} existing
 * @param {{ fecha?: string, hora?: string, resLabs?: string[] }} incoming
 * @returns {boolean}
 */
export function isDuplicateDriveLabSet(existing, incoming) {
  if (!existing || !incoming) return false;

  const exLabs = existing.resLabs || [];
  const inLabs = incoming.resLabs || [];

  const sameFecha = normalizeFecha(existing.fecha) === normalizeFecha(incoming.fecha);
  const eh = String(existing.hora || '').trim();
  const ih = String(incoming.hora || '').trim();
  const sameHora = eh === ih;

  if (sameFecha && sameHora && areDriveLabSetsEquivalent(exLabs, inLabs)) return true;

  const dayEx = calendarDayKeyFromLabSet(existing);
  const dayIn = calendarDayKeyFromLabSet(incoming);
  if (!dayEx || !dayIn || dayEx !== dayIn) return false;

  if (areDriveLabSetsEquivalent(exLabs, inLabs)) return true;
  if (isSubsetLabLines(inLabs, exLabs)) return true;

  return false;
}

/**
 * @param {Array<{ fecha?: string, hora?: string, resLabs?: string[] }>} existingHistory
 * @param {Array<{ fecha?: string, hora?: string, resLabs?: string[] }>} incomingSets
 * @returns {{ sets: typeof incomingSets, skipped: number }}
 */
export function filterNewDriveLabSets(existingHistory, incomingSets) {
  let skipped = 0;
  /** @type {typeof incomingSets} */
  const fresh = [];
  (incomingSets || []).forEach(function (set) {
    const dup = (existingHistory || []).some(function (ex) {
      return isDuplicateDriveLabSet(ex, set);
    });
    if (dup) skipped += 1;
    else fresh.push(set);
  });
  return { sets: fresh, skipped: skipped };
}
