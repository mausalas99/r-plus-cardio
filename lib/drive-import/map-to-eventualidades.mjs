import { parseDateLine, resolveYear, toNoonIso } from './eventualidad-dates.mjs';

const DATE_ONLY_RE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\s*$/;
const MONITOREO_RE = /^(N|V|HD|HI|NM)\s*:/i;

/**
 * @param {{
 *   eventualidadesBlocks: string[],
 *   referenceYear?: number,
 *   documentYear?: number,
 * }} input
 * @returns {{ entries: Array<{ at: string, text: string }>, warnings: string[] }}
 */
export function mapSectionsToEventualidades(input) {
  const blocks = input.eventualidadesBlocks || [];
  const hints = {
    referenceYear: input.referenceYear,
    documentYear: input.documentYear,
  };
  /** @type {Array<{ at: string, text: string }>} */
  const entries = [];
  /** @type {string[]} */
  const warnings = [];

  for (const block of blocks) {
    const lines = String(block || '').split('\n');
    /** @type {string | null} */
    let curDate = null;
    /** @type {string[]} */
    let buf = [];

    function flush() {
      const text = buf
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
      if (curDate && text) entries.push({ at: curDate, text });
      buf = [];
    }

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (MONITOREO_RE.test(line)) continue;
      if (DATE_ONLY_RE.test(line)) {
        const d = parseDateLine(line);
        if (d) {
          flush();
          const year = resolveYear(d, hints);
          curDate = toNoonIso({ day: d.day, month: d.month, year });
          continue;
        }
      }
      buf.push(line);
    }
    flush();
  }

  return { entries, warnings };
}
