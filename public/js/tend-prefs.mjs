const LS_SERIES_COLORS = 'rpc-tend-series-colors';
const LS_GROUP_VISIBLE = 'rpc-tend-group-visible';
const LS_GROUP_TABLE_HIDDEN = 'rpc-tend-group-table-hidden';
const LS_GROUP_PANEL_ORDER = 'rpc-tend-group-panel-order';
const LS_TEND_CARD_ORDER = 'rpc-tend-card-order';
const LS_GROUP_PANEL_HIDDEN = 'rpc-tend-group-panel-hidden';
const LS_GROUP_PANEL_TITLES = 'rpc-tend-group-panel-titles';

export const DEFAULT_PANEL_LABELS = {
  gases: 'Gasometría',
  'percent-diff': 'Fórmula leucocitaria (%)',
  'percent-rbc': 'Índices eritrocitarios (%)',
  absolute: 'Valores absolutos',
  'bh-absolute': 'Conteos absolutos celulares',
  'bh-quality': 'Calidad eritrocitaria (índices)',
  'bh-diff': 'Diferencial manual',
  'bh-diff-manual': 'Diferencial manual',
  'bh-coag': 'Coagulación'
};

export const DEFAULT_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16'
];

function readJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_e) { void _e; }
}

export function seriesColorKey(sectionKey, fieldKey) {
  return String(sectionKey) + '|' + String(fieldKey);
}

export function readSeriesColor(sectionKey, fieldKey) {
  var map = readJson(LS_SERIES_COLORS, {});
  return map[seriesColorKey(sectionKey, fieldKey)] || null;
}

export function writeSeriesColor(sectionKey, fieldKey, hex) {
  var map = readJson(LS_SERIES_COLORS, {});
  map[seriesColorKey(sectionKey, fieldKey)] = String(hex);
  writeJson(LS_SERIES_COLORS, map);
}

function groupKey(patientId, sectionKey) {
  return String(patientId) + '|' + String(sectionKey);
}

export function readGroupVisibleFields(patientId, sectionKey) {
  var map = readJson(LS_GROUP_VISIBLE, {});
  var arr = map[groupKey(patientId, sectionKey)];
  return Array.isArray(arr) ? arr.slice() : null;
}

export function writeGroupVisibleFields(patientId, sectionKey, fieldKeys) {
  var map = readJson(LS_GROUP_VISIBLE, {});
  map[groupKey(patientId, sectionKey)] = (fieldKeys || []).slice();
  writeJson(LS_GROUP_VISIBLE, map);
}

export function readGroupTableHidden(patientId, sectionKey) {
  var map = readJson(LS_GROUP_TABLE_HIDDEN, {});
  var entry = map[groupKey(patientId, sectionKey)];
  if (!entry || typeof entry !== 'object') return { rows: [], cols: [] };
  return {
    rows: Array.isArray(entry.rows) ? entry.rows.slice() : [],
    cols: Array.isArray(entry.cols) ? entry.cols.slice() : []
  };
}

export function writeGroupTableHidden(patientId, sectionKey, hidden) {
  var map = readJson(LS_GROUP_TABLE_HIDDEN, {});
  map[groupKey(patientId, sectionKey)] = {
    rows: Array.isArray(hidden && hidden.rows) ? hidden.rows.slice() : [],
    cols: Array.isArray(hidden && hidden.cols) ? hidden.cols.slice() : []
  };
  writeJson(LS_GROUP_TABLE_HIDDEN, map);
}

export function readGroupPanelOrder(patientId, sectionKey) {
  var map = readJson(LS_GROUP_PANEL_ORDER, {});
  var arr = map[groupKey(patientId, sectionKey)];
  return Array.isArray(arr) ? arr.slice() : null;
}

export function writeGroupPanelOrder(patientId, sectionKey, familyKeys) {
  var map = readJson(LS_GROUP_PANEL_ORDER, {});
  map[groupKey(patientId, sectionKey)] = (familyKeys || []).slice();
  writeJson(LS_GROUP_PANEL_ORDER, map);
}

/** Orden de tarjetas spark (claves sectionKey|fieldKey) por paciente y sección de laboratorio. */
export function readTendCardOrder(patientId, sectionKey) {
  var map = readJson(LS_TEND_CARD_ORDER, {});
  var arr = map[groupKey(patientId, sectionKey)];
  return Array.isArray(arr) ? arr.slice() : null;
}

export function writeTendCardOrder(patientId, sectionKey, seriesKeys) {
  var map = readJson(LS_TEND_CARD_ORDER, {});
  map[groupKey(patientId, sectionKey)] = (seriesKeys || []).slice();
  writeJson(LS_TEND_CARD_ORDER, map);
}

export function readGroupPanelHidden(patientId, sectionKey) {
  var map = readJson(LS_GROUP_PANEL_HIDDEN, {});
  var arr = map[groupKey(patientId, sectionKey)];
  return Array.isArray(arr) ? arr.slice() : [];
}

/** Lee paneles ocultos migrando claves legacy de BH (percent-rbc → bh-quality, …). */
export function readGroupPanelHiddenMigrated(patientId, sectionKey, migrateFn) {
  var raw = readGroupPanelHidden(patientId, sectionKey);
  if (!migrateFn || sectionKey !== 'BH') return raw;
  var out = [];
  var seen = Object.create(null);
  raw.forEach(function (fam) {
    var m = migrateFn(sectionKey, fam);
    if (!m || seen[m]) return;
    seen[m] = true;
    out.push(m);
  });
  return out;
}

export function writeGroupPanelHidden(patientId, sectionKey, familyKeys) {
  var map = readJson(LS_GROUP_PANEL_HIDDEN, {});
  map[groupKey(patientId, sectionKey)] = (familyKeys || []).slice();
  writeJson(LS_GROUP_PANEL_HIDDEN, map);
}

export function defaultPanelLabel(familyKey) {
  var fam = String(familyKey || '');
  return DEFAULT_PANEL_LABELS[fam] || fam;
}

export function readGroupPanelTitles(patientId, sectionKey) {
  var map = readJson(LS_GROUP_PANEL_TITLES, {});
  var entry = map[groupKey(patientId, sectionKey)];
  if (!entry || typeof entry !== 'object') return {};
  return Object.assign({}, entry);
}

export function writeGroupPanelTitle(patientId, sectionKey, familyKey, title) {
  var fam = String(familyKey || '');
  var trimmed = String(title || '').trim();
  var map = readJson(LS_GROUP_PANEL_TITLES, {});
  var gk = groupKey(patientId, sectionKey);
  var entry =
    map[gk] && typeof map[gk] === 'object' ? Object.assign({}, map[gk]) : {};
  if (!trimmed || trimmed === defaultPanelLabel(fam)) {
    delete entry[fam];
    if (!Object.keys(entry).length) delete map[gk];
    else map[gk] = entry;
  } else {
    entry[fam] = trimmed;
    map[gk] = entry;
  }
  writeJson(LS_GROUP_PANEL_TITLES, map);
}

export function resolvePanelTitle(patientId, sectionKey, familyKey) {
  var fam = String(familyKey || '');
  var custom = readGroupPanelTitles(patientId, sectionKey)[fam];
  if (custom && String(custom).trim()) return String(custom).trim();
  return defaultPanelLabel(fam);
}

export function defaultSeriesColor(index) {
  var i = Number(index);
  if (!isFinite(i) || i < 0) i = 0;
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}
