export function emptyCongestionChecklist() {
  return {
    pvy: null, // true|false|null
    rhy: null,
    soplo: null,
    soploNota: '',
    estertores: null,
    estertoresNota: '',
    ascitisHepatomegalia: null,
    edemaMi: null,
    edemaMiNota: '',
    llenadoCapilar: '',
  };
}

/**
 * Prefer explicit `next` when the key is present on `record`; otherwise keep `prev`.
 * @template T
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {T} prevVal
 * @param {T} emptyVal
 * @returns {T}
 */
function coalesceField(record, key, prevVal, emptyVal) {
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    const v = record[key];
    return /** @type {T} */ (v === undefined || v === null ? emptyVal : v);
  }
  return prevVal !== undefined && prevVal !== null ? prevVal : emptyVal;
}

export function upsertPocusDay(history, record) {
  const date = String(record.date || '').trim();
  const list = Array.isArray(history) ? history.slice() : [];
  const idx = list.findIndex((r) => r && r.date === date);
  const prev = idx >= 0 ? list[idx] : null;

  const row = {
    date,
    vciCm: coalesceField(record, 'vciCm', prev && prev.vciCm, null),
    vciCollapse: String(coalesceField(record, 'vciCollapse', prev && prev.vciCollapse, '') || ''),
    vexus: coalesceField(record, 'vexus', prev && prev.vexus, null),
    congestionScore: coalesceField(
      record,
      'congestionScore',
      prev && prev.congestionScore,
      null,
    ),
    congestionComponents: coalesceField(
      record,
      'congestionComponents',
      prev && prev.congestionComponents,
      [],
    ),
    lungPattern: String(coalesceField(record, 'lungPattern', prev && prev.lungPattern, '') || ''),
    lungLinesB: String(coalesceField(record, 'lungLinesB', prev && prev.lungLinesB, '') || ''),
    stevenson: String(coalesceField(record, 'stevenson', prev && prev.stevenson, '') || ''),
    note: String(coalesceField(record, 'note', prev && prev.note, '') || ''),
    // Preserve existing checklist when omitted — partial POCUS updates must not wipe it.
    checklist: coalesceField(
      record,
      'checklist',
      prev && prev.checklist,
      emptyCongestionChecklist(),
    ),
  };

  if (idx >= 0) list[idx] = row;
  else list.push(row);
  list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return list;
}

export function getPocusDay(history, date) {
  return (history || []).find((r) => r && r.date === String(date)) || null;
}
