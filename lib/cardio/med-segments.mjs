export const FANTASTICO_CLASSES = [
  'IECA/ARA/ARNI',
  'SGLT2i',
  'Betabloqueador',
  'MRA',
];

function newId() {
  return 'ms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function appendDoseSegment(segments, row) {
  const list = Array.isArray(segments) ? segments.slice() : [];
  list.push({
    id: newId(),
    tipo: String(row.tipo || '').trim(),
    inicio: String(row.inicio || '').trim(),
    dosis: String(row.dosis || '').trim(),
    indicacion: String(row.indicacion || '').trim(),
    endedAt: null,
    mgTotal: row.mgTotal != null ? Number(row.mgTotal) : null,
  });
  return list;
}

export function endDoseSegment(segments, id, endedAt) {
  const list = Array.isArray(segments) ? segments.slice() : [];
  const idx = list.findIndex((s) => s && s.id === id);
  if (idx < 0) return list;
  list[idx] = Object.assign({}, list[idx], { endedAt: String(endedAt || '').trim() || null });
  return list;
}

export function listActiveMeds(segments) {
  return (segments || []).filter((s) => s && !s.endedAt);
}

export function sumFurosemidaMg(segments) {
  return (segments || []).reduce((sum, s) => {
    if (!s || !/furosemida/i.test(String(s.tipo || ''))) return sum;
    return sum + (Number(s.mgTotal) || 0);
  }, 0);
}

export function addCatalogTipo(catalog, entry) {
  const tipo = String(entry.tipo || '').trim();
  if (!tipo) return catalog || [];
  const list = Array.isArray(catalog) ? catalog.slice() : [];
  const idx = list.findIndex((c) => c && String(c.tipo).toLowerCase() === tipo.toLowerCase());
  const row = {
    tipo,
    defaultIndicacion: String(entry.defaultIndicacion || '').trim(),
  };
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], row);
  else list.push(row);
  return list;
}

export function emptyFantasticos() {
  return FANTASTICO_CLASSES.map((className) => ({
    className,
    drug: '',
    inicio: '',
    dosis: '',
    tolerancia: '',
  }));
}
