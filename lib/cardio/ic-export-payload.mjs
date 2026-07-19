/**
 * Map a Cardionotas patient → plain DTO for the IC hoja docx filler.
 * Empty fields stay empty/`—` at fill time; this module only gathers values.
 */

import { computeDescongestion } from './descongestion.mjs';
import { getPocusDay } from './congestion.mjs';
import { listActiveMeds, sumFurosemidaMg } from './med-segments.mjs';
import { ensureCardio } from './patient-cardio.mjs';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** @param {unknown} raw */
export function toYmd(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (ISO_RE.test(s)) return s;
  const m = DMY_RE.exec(s);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** @param {string} ymd */
export function formatDisplayDate(ymd) {
  const m = ISO_RE.exec(String(ymd || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** @param {string} ymd → 13.03.26 */
export function formatShortDate(ymd) {
  const m = ISO_RE.exec(String(ymd || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}

/** @param {unknown} patient */
export function resolveIngresoYmd(patient) {
  if (!patient || typeof patient !== 'object') return '';
  /** @type {any} */
  const p = patient;
  return toYmd(p.fimiFecha) || toYmd(p.fiuxFecha) || toYmd(p.ingresoDate) || '';
}

/** @param {Date} [d] */
function localYmd(d) {
  const dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** @param {unknown} iso */
function recordedAtToLocalYmd(iso) {
  if (!iso) return '';
  return localYmd(new Date(String(iso)));
}

/**
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @returns {number[]}
 */
function extractDailyDiuresisMl(monitoreo) {
  const hist = monitoreo && Array.isArray(monitoreo.historial) ? monitoreo.historial : [];
  /** @type {Map<string, number>} */
  const byDay = new Map();
  for (const row of hist) {
    if (!row || typeof row !== 'object') continue;
    /** @type {any} */
    const r = row;
    const ymd = recordedAtToLocalYmd(r.recordedAt);
    if (!ymd) continue;
    const io = r.io || {};
    const raw = io.diuresis != null ? io.diuresis : io.egr;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    byDay.set(ymd, (byDay.get(ymd) || 0) + n);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((e) => e[1]);
}

/**
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {string} asOfYmd
 */
function vitalsForDay(monitoreo, asOfYmd) {
  const hist = monitoreo && Array.isArray(monitoreo.historial) ? monitoreo.historial : [];
  /** @type {any} */
  let best = null;
  for (const row of hist) {
    if (!row || typeof row !== 'object') continue;
    /** @type {any} */
    const r = row;
    if (recordedAtToLocalYmd(r.recordedAt) !== asOfYmd) continue;
    best = r;
  }
  if (!best) return { line: '', diuresis24h: null };
  const v = best.vitals || {};
  const tas = v.tas != null ? v.tas : v.taSis;
  const tad = v.tad != null ? v.tad : v.taDia;
  const parts = [];
  if (tas != null && tad != null) parts.push(`TA: ${tas}/${tad} mmHg`);
  if (v.fc != null) parts.push(`FC: ${v.fc} lpm`);
  if (v.fr != null) parts.push(`FR: ${v.fr} rpm`);
  const sat = v.sat != null ? v.sat : v.spo2;
  if (sat != null) parts.push(`SPO2: ${sat}%`);
  if (v.temp != null) parts.push(`Temp: ${v.temp}°C`);
  const io = best.io || {};
  const diuresisRaw = io.diuresis != null ? io.diuresis : null;
  const diuresis24h = diuresisRaw != null && Number.isFinite(Number(diuresisRaw))
    ? Number(diuresisRaw)
    : null;
  return { line: parts.length ? `${parts.join(' ')}  ` : '', diuresis24h };
}

/**
 * @param {any} pocus
 * @returns {string}
 */
function formatPocusLine(pocus) {
  if (!pocus || !pocus.date) return '';
  const date = formatShortDate(pocus.date) || pocus.date;
  if (pocus.note) return `${date} ${String(pocus.note).trim()}`;
  const bits = [`${date} Parámetros de congestión:`];
  if (pocus.vciCm != null) bits.push(`VCI: ${pocus.vciCm}`);
  if (pocus.vexus != null) bits.push(`VExUS score: ${pocus.vexus}`);
  if (pocus.congestionScore != null) bits.push(`congestion score: ${pocus.congestionScore}`);
  if (pocus.lungPattern) bits.push(`Patrón ${pocus.lungPattern}`);
  if (pocus.lungLinesB) bits.push(String(pocus.lungLinesB));
  return `${bits.join(' ')} `;
}

/**
 * @param {unknown} patient
 * @param {{ asOfDate?: string }} [opts]
 */
export function buildIcExportPayload(patient, opts = {}) {
  const asOfDate = toYmd(opts.asOfDate) || localYmd();
  /** @type {any} */
  const p = patient && typeof patient === 'object' ? patient : {};
  ensureCardio(p);
  /** @type {any} */
  const cardio = p.cardio || {};
  const ingresoDate = resolveIngresoYmd(p);
  const dailyDiuresis = extractDailyDiuresisMl(p.monitoreo);
  const furoMg = sumFurosemidaMg(cardio.diureticSegments);
  const computed = computeDescongestion({
    ingresoDate,
    asOfDate,
    inicioDescongestion: cardio.inicioDescongestion || '',
    dailyDiuresisMl: dailyDiuresis,
    furosemidaAcumuladaMg: furoMg,
    overrides: cardio.overrides || {},
  });

  const hc = p.historiaClinica && typeof p.historiaClinica === 'object' ? p.historiaClinica : {};
  const app = hc.app && typeof hc.app === 'object' ? hc.app : {};
  const antecedentesText = String(app.descripcionDetallada || '').trim();
  const antecedentesLines = antecedentesText
    ? antecedentesText.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : [];
  const peeaText = String(hc.padecimientoActual || p.peea || '').trim();
  const peeaLines = peeaText
    ? peeaText.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : [];

  const pocusHistory = Array.isArray(cardio.pocusByDay) ? cardio.pocusByDay : [];
  const pocusAsOf = getPocusDay(pocusHistory, asOfDate);
  const checklist = (pocusAsOf && pocusAsOf.checklist) || {};

  const vitals = vitalsForDay(p.monitoreo, asOfDate);

  const evStore = p.eventualidades && typeof p.eventualidades === 'object' ? p.eventualidades : {};
  const evEntries = Array.isArray(evStore.entries) ? evStore.entries.slice() : [];
  evEntries.sort((a, b) => String(a && a.at || '').localeCompare(String(b && b.at || '')));
  const eventosLines = evEntries
    .map((e) => {
      if (!e) return '';
      const ymd = toYmd(e.at) || recordedAtToLocalYmd(e.at);
      const prefix = ymd ? formatShortDate(ymd) : '';
      const text = String(e.text || '').trim();
      if (!text) return '';
      return prefix ? `${prefix} ${text}` : text;
    })
    .filter(Boolean);

  const diureticSegs = Array.isArray(cardio.diureticSegments) ? cardio.diureticSegments : [];
  const diureticStrategyLines = diureticSegs.map((s) => {
    if (!s) return '';
    const start = formatShortDate(toYmd(s.inicio)) || String(s.inicio || '').trim();
    const tipo = String(s.tipo || 'Furosemida').trim();
    const dosis = String(s.dosis || '').trim();
    return [start, tipo, dosis].filter(Boolean).join(' ');
  }).filter(Boolean);

  const activeDiuretics = listActiveMeds(diureticSegs);
  const esquemaDiureticosActual = activeDiuretics.length
    ? activeDiuretics.map((s) => `${s.tipo || ''} ${s.dosis || ''}`.trim()).join('; ')
    : '';

  /** @type {string[]} */
  let diagnosticos = [];
  if (Array.isArray(p.diagnosticos)) {
    diagnosticos = p.diagnosticos.map((d) => String(d).trim()).filter(Boolean);
  } else if (typeof p.diagnosticos === 'string' && p.diagnosticos.trim()) {
    diagnosticos = p.diagnosticos.split(/\n+/).map((d) => d.trim()).filter(Boolean);
  }

  /** Labs stubs: optional `patient.icLabs` as `{ date, lines }[]` or string lines. */
  /** @type {string[]} */
  const labsLines = [];
  if (Array.isArray(p.icLabs)) {
    for (const block of p.icLabs) {
      if (typeof block === 'string') {
        if (block.trim()) labsLines.push(block.trim());
        continue;
      }
      if (!block || typeof block !== 'object') continue;
      const date = formatShortDate(toYmd(block.date)) || String(block.date || '').trim();
      if (date) labsLines.push(date);
      const lines = Array.isArray(block.lines) ? block.lines : [];
      for (const line of lines) {
        if (String(line || '').trim()) labsLines.push(String(line).trim());
      }
    }
  }

  const diuresisAcum = computed.diuresisAcumuladaMl;
  const diuresisAcumuladaDisplay =
    diuresisAcum != null && Number.isFinite(Number(diuresisAcum)) && Number(diuresisAcum) !== 0
      ? `${Number(diuresisAcum).toLocaleString('en-US')} ml`
      : '';
  const diuresis24Display =
    vitals.diuresis24h != null
      ? ` ${vitals.diuresis24h} CC`
      : '';

  const furoAcum = computed.furosemidaAcumuladaMg;
  const furosemidaAcumuladaDisplay =
    furoAcum != null && Number.isFinite(Number(furoAcum)) && Number(furoAcum) !== 0
      ? `      ${furoAcum} mg `
      : '';

  return {
    asOfDate,
    nombre: String(p.nombre || '').trim(),
    registro: String(p.registro || '').trim(),
    edad: String(p.edad != null ? p.edad : '').trim(),
    ingresoDisplay: formatDisplayDate(ingresoDate),
    fechaDisplay: formatDisplayDate(asOfDate),
    fenotipo: String(p.fenotipo || cardio.fenotipo || '').trim(),
    etiologia: String(p.etiologia || cardio.etiologia || '').trim(),
    antecedentesLines,
    peeaLines,
    diasInternamiento: computed.diasInternamiento,
    inicioDescongestionDisplay: formatDisplayDate(toYmd(cardio.inicioDescongestion)),
    diasDescongestion: computed.diasDescongestion,
    vitalsLine: vitals.line,
    diuresis24hDisplay: diuresis24Display,
    diuresisAcumuladaDisplay,
    checklist: {
      pvy: checklist.pvy,
      rhy: checklist.rhy,
      soploNota: String(checklist.soploNota || '').trim(),
      estertoresNota: String(checklist.estertoresNota || '').trim(),
      ascitisHepatomegalia: checklist.ascitisHepatomegalia,
      edemaMi: checklist.edemaMi,
      llenadoCapilar: String(checklist.llenadoCapilar || '').trim(),
    },
    pocusLines: pocusHistory.map(formatPocusLine).filter(Boolean),
    stevenson: pocusAsOf && pocusAsOf.stevenson != null ? String(pocusAsOf.stevenson) : '',
    vexus: pocusAsOf && pocusAsOf.vexus != null ? pocusAsOf.vexus : null,
    congestionScore:
      pocusAsOf && pocusAsOf.congestionScore != null ? pocusAsOf.congestionScore : null,
    usPulmonar: pocusAsOf && pocusAsOf.lungPattern ? String(pocusAsOf.lungPattern) : '',
    esquemaDiureticosActual,
    furosemidaAcumuladaDisplay,
    diureticStrategyLines,
    fantasticos: Array.isArray(cardio.fantasticos) ? cardio.fantasticos : [],
    medSegments: Array.isArray(cardio.medSegments) ? cardio.medSegments : [],
    eventosLines,
    labsLines,
    diagnosticos,
    residente: String(p.residente || cardio.residente || '').trim(),
    ekg: String(cardio.ekg || p.ekg || '').trim(),
    ritmo: String(cardio.ritmo || '').trim(),
    estrategiaControlFa: String(cardio.estrategiaControlFa || '').trim(),
  };
}
