import { daysBetweenInclusive } from './descongestion.mjs';

export const FANTASTICO_CLASSES = [
  'IECA/ARA/ARNI',
  'SGLT2i',
  'Betabloqueador',
  'MRA',
];

/** Suggested drugs per GDMT pillar (not the general med/diuretic catalog). */
export const FANTASTICO_DRUGS_BY_CLASS = {
  'IECA/ARA/ARNI': [
    'Sacubitril/Valsartán',
    'Neparvis',
    'Enalapril',
    'Lisinopril',
    'Ramipril',
    'Losartán',
    'Valsartán',
    'Candesartán',
  ],
  SGLT2i: ['Dapagliflozina', 'Empagliflozina', 'Canagliflozina'],
  Betabloqueador: ['Bisoprolol', 'Carvedilol', 'Metoprolol', 'Nebivolol'],
  MRA: ['Espironolactona', 'Eplerenona', 'Finerenona'],
};

const DIURETIC_DRUG_NAMES = [
  'Furosemida',
  'Bumetanida',
  'Torasemida',
  'Metolazona',
];

/**
 * True when `drug` is a known suggestion for a *different* Fantásticos class or a diuretic.
 * @param {string} className
 * @param {string} drug
 */
export function isMisplacedFantasticoDrug(className, drug) {
  const key = String(className || '').trim();
  const d = String(drug || '')
    .trim()
    .toLowerCase();
  if (!d) return false;
  const own = FANTASTICO_DRUGS_BY_CLASS[key] || [];
  if (own.some((x) => x.toLowerCase() === d)) return false;
  if (DIURETIC_DRUG_NAMES.some((x) => x.toLowerCase() === d)) return true;
  for (const cls of FANTASTICO_CLASSES) {
    if (cls === key) continue;
    const list = FANTASTICO_DRUGS_BY_CLASS[cls] || [];
    if (list.some((x) => x.toLowerCase() === d)) return true;
  }
  return false;
}

/**
 * Combo options for a Fantásticos class. Never mixes diuretics / other pillars.
 * @param {string} className
 * @param {string} [currentDrug] kept only if free-text outside other catalogs
 * @returns {string[]}
 */
export function fantasticoDrugOptions(className, currentDrug) {
  const key = String(className || '').trim();
  const base = FANTASTICO_DRUGS_BY_CLASS[key] || [];
  const seen = new Set(base.map((d) => d.toLowerCase()));
  const out = base.slice();
  const cur = String(currentDrug || '').trim();
  if (cur && !seen.has(cur.toLowerCase()) && !isMisplacedFantasticoDrug(key, cur)) {
    out.push(cur);
  }
  return out;
}

function newId() {
  return 'ms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function appendDoseSegment(segments, row) {
  const list = Array.isArray(segments) ? segments.slice() : [];
  const endedRaw = String(row.endedAt == null ? '' : row.endedAt).trim();
  list.push({
    id: newId(),
    tipo: String(row.tipo || '').trim(),
    inicio: String(row.inicio || '').trim(),
    dosis: String(row.dosis || '').trim(),
    indicacion: String(row.indicacion || '').trim(),
    endedAt: endedRaw || null,
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

/**
 * Daily mg from a dosis string like "80 mg IV cada 12h" → 160.
 * DU/bolo / no frequency → single daily dose (mg once).
 * @param {unknown} dosis
 * @returns {number}
 */
export function parseDosisDailyMg(dosis) {
  const s = String(dosis || '').trim();
  if (!s) return 0;
  const mgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*mg\b/i) || s.match(/^(\d+(?:[.,]\d+)?)\b/);
  if (!mgMatch) return 0;
  const mg = Number(String(mgMatch[1]).replace(',', '.'));
  if (!Number.isFinite(mg) || mg <= 0) return 0;

  const cada =
    s.match(/cada\s+(\d+)\s*h(?:oras?)?\b/i) ||
    s.match(/\bc\/\s*(\d+)\s*h(?:oras?)?\b/i);
  if (cada) {
    const hours = Number(cada[1]);
    if (Number.isFinite(hours) && hours > 0 && hours <= 24) {
      return mg * (24 / hours);
    }
  }
  return mg;
}

/**
 * Days a segment covers. `endedAt` is the inclusive last day of the regimen.
 * Counts are capped at asOfDate (never into the future).
 * @param {unknown} inicio
 * @param {unknown} endedAt
 * @param {unknown} asOfDate
 * @returns {number}
 */
export function segmentDayCount(inicio, endedAt, asOfDate) {
  const start = String(inicio || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return 0;
  const asOf = String(asOfDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return 0;
  const ended = String(endedAt || '').trim();
  const end =
    /^\d{4}-\d{2}-\d{2}$/.test(ended) && ended < asOf ? ended : asOf;
  if (end < start) return 0;
  return daysBetweenInclusive(start, end);
}

/**
 * Accumulated furosemida mg from diuretic segments.
 * Prefers explicit mgTotal; otherwise dosis × days through asOfDate.
 * @param {unknown} segments
 * @param {string} [asOfDate] YYYY-MM-DD (defaults to today local)
 */
export function sumFurosemidaMg(segments, asOfDate) {
  const asOf = String(asOfDate || localYmdToday()).trim();
  return (segments || []).reduce((sum, s) => {
    if (!s || !/furosemida/i.test(String(s.tipo || ''))) return sum;
    if (s.mgTotal != null && s.mgTotal !== '' && Number.isFinite(Number(s.mgTotal))) {
      return sum + Number(s.mgTotal);
    }
    const daily = parseDosisDailyMg(s.dosis);
    if (!daily) return sum;
    return sum + daily * segmentDayCount(s.inicio, s.endedAt, asOf);
  }, 0);
}

function localYmdToday() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
