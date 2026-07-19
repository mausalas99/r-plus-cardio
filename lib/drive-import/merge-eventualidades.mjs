import { toClinicalHistoryText } from '../historia-clinica/clinical-text.mjs';

/**
 * @param {{ at?: string, text?: string }} entry
 * @returns {string}
 */
export function dedupeEventualidadKey(entry) {
  const day = String(entry.at || '').slice(0, 10);
  const prefix = toClinicalHistoryText(entry.text).trim().slice(0, 160);
  return day + '|' + prefix;
}

/**
 * @param {Array<{ at?: string, text?: string }>} existing
 * @param {Array<{ at?: string, text?: string }>} incoming
 * @returns {{ toAdd: Array<{ at: string, text: string }>, skipped: number }}
 */
export function filterNewEventualidades(existing, incoming) {
  const keys = new Set();
  for (const e of existing || []) {
    keys.add(dedupeEventualidadKey(e));
  }
  /** @type {Array<{ at: string, text: string }>} */
  const toAdd = [];
  let skipped = 0;
  for (const e of incoming || []) {
    const key = dedupeEventualidadKey(e);
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    keys.add(key);
    toAdd.push({ at: String(e.at), text: String(e.text) });
  }
  return { toAdd, skipped };
}
