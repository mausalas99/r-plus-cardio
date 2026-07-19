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

export function upsertPocusDay(history, record) {
  const date = String(record.date || '').trim();
  const list = Array.isArray(history) ? history.slice() : [];
  const row = {
    date,
    vciCm: record.vciCm ?? null,
    vciCollapse: record.vciCollapse || '',
    vexus: record.vexus ?? null,
    congestionScore: record.congestionScore ?? null,
    congestionComponents: record.congestionComponents || [],
    lungPattern: record.lungPattern || '',
    lungLinesB: record.lungLinesB || '',
    stevenson: record.stevenson || '',
    note: record.note || '',
    checklist: record.checklist || emptyCongestionChecklist(),
  };
  const idx = list.findIndex((r) => r && r.date === date);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return list;
}

export function getPocusDay(history, date) {
  return (history || []).find((r) => r && r.date === String(date)) || null;
}
