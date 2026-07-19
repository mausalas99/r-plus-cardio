/**
 * @param {string} line
 * @returns {{ day: number, month: number, year?: number } | null}
 */
export function parseDateLine(line) {
  const t = String(line || '').trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return { day: Number(m[1]), month: Number(m[2]), year: y };
  }
  m = /^(\d{1,2})[/.-](\d{1,2})$/.exec(t);
  if (m) return { day: Number(m[1]), month: Number(m[2]) };
  return null;
}

/**
 * @param {{ day: number, month: number, year?: number }} partial
 * @param {{ referenceYear?: number, documentYear?: number }} hints
 * @returns {number}
 */
export function resolveYear(partial, hints) {
  if (partial.year != null && Number.isFinite(partial.year)) return partial.year;
  if (hints.referenceYear != null) return hints.referenceYear;
  const now = new Date();
  let y = hints.documentYear != null ? hints.documentYear : now.getFullYear();
  if (partial.month > now.getMonth() + 1) y -= 1;
  return y;
}

/**
 * @param {{ day: number, month: number, year: number }} parts
 * @returns {string}
 */
export function toNoonIso(parts) {
  const dt = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
}

/**
 * @param {string} text
 * @returns {number | undefined}
 */
export function inferDocumentYearFromText(text) {
  const m = /(?:FIUX|FECHA\s+DE\s+INGRESO)[^\d]*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i.exec(text);
  if (m) return Number(m[3]);
  const years = [];
  const re = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g;
  let hit;
  while ((hit = re.exec(text)) !== null) {
    years.push(Number(hit[3]));
  }
  return years.length ? Math.max(...years) : undefined;
}
