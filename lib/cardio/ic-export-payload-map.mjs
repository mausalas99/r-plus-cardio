/**
 * Pure helpers for buildIcExportPayload (kept small for Tier-1 budgets).
 */

import { listActiveMeds } from './med-segments.mjs';
import { formatShortDate, toYmd } from './ic-export-payload-dates.mjs';

/** @param {Date} [d] */
export function localYmd(d) {
  const dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** @param {unknown} iso */
export function recordedAtToLocalYmd(iso) {
  if (!iso) return '';
  return localYmd(new Date(String(iso)));
}

/** @param {Record<string, unknown>} v */
export function formatVitalsParts(v) {
  const tas = v.tas != null ? v.tas : v.taSis;
  const tad = v.tad != null ? v.tad : v.taDia;
  const parts = [];
  if (tas != null && tad != null) parts.push(`TA: ${tas}/${tad} mmHg`);
  if (v.fc != null) parts.push(`FC: ${v.fc} lpm`);
  if (v.fr != null) parts.push(`FR: ${v.fr} rpm`);
  const sat = v.sat != null ? v.sat : v.spo2;
  if (sat != null) parts.push(`SPO2: ${sat}%`);
  if (v.temp != null) parts.push(`Temp: ${v.temp}°C`);
  return parts;
}

/**
 * EA-aligned diuresis: legacy `diuresis`, else `egrParts` (kind diuresis), else `egr`.
 * @param {Record<string, unknown> | null | undefined} io
 * @returns {number | null}
 */
export function resolveIoDiuresisMl(io) {
  if (!io || typeof io !== 'object') return null;
  if (io.diuresis != null && Number.isFinite(Number(io.diuresis))) return Number(io.diuresis);
  const egrParts = Array.isArray(io.egrParts) ? io.egrParts : [];
  for (const part of egrParts) {
    if (!part || typeof part !== 'object') continue;
    /** @type {any} */
    const p = part;
    if (p.kind !== 'diuresis') continue;
    if (p.value != null && Number.isFinite(Number(p.value))) return Number(p.value);
  }
  if (io.egr != null && Number.isFinite(Number(io.egr))) return Number(io.egr);
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {string} asOfYmd
 */
export function vitalsForDay(monitoreo, asOfYmd) {
  const hist = monitoreo && Array.isArray(monitoreo.historial) ? monitoreo.historial : [];
  /** @type {any} */
  let best = null;
  for (const row of hist) {
    if (!row || typeof row !== 'object') continue;
    if (recordedAtToLocalYmd(/** @type {any} */ (row).recordedAt) !== asOfYmd) continue;
    best = row;
  }
  if (!best) return { line: '', diuresis24h: null };
  const parts = formatVitalsParts(best.vitals || {});
  return {
    line: parts.length ? `${parts.join(' ')}  ` : '',
    diuresis24h: resolveIoDiuresisMl(best.io || {}),
  };
}

/** @param {string} text */
export function splitNonEmptyLines(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  return t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

/** @param {unknown} diagnosticos */
export function resolveDiagnosticos(diagnosticos) {
  if (Array.isArray(diagnosticos)) {
    return diagnosticos.map((d) => String(d).trim()).filter(Boolean);
  }
  if (typeof diagnosticos === 'string' && diagnosticos.trim()) {
    return splitNonEmptyLines(diagnosticos);
  }
  return [];
}

/** @param {any} block @param {string[]} out */
function pushIcLabBlock(block, out) {
  if (typeof block === 'string') {
    if (block.trim()) out.push(block.trim());
    return;
  }
  if (!block || typeof block !== 'object') return;
  const date = formatShortDate(toYmd(block.date)) || String(block.date || '').trim();
  if (date) out.push(date);
  const lines = Array.isArray(block.lines) ? block.lines : [];
  for (const line of lines) {
    if (String(line || '').trim()) out.push(String(line).trim());
  }
}

/** @param {any} set @param {string[]} out */
function pushLabHistorySet(set, out) {
  if (!set || typeof set !== 'object') return;
  const date = formatShortDate(toYmd(set.fecha)) || String(set.fecha || '').trim();
  if (date) out.push(date);
  if (Array.isArray(set.resLabs)) {
    for (const chunk of set.resLabs) {
      const t = String(chunk || '').trim();
      if (t) out.push(t);
    }
    return;
  }
  const t = String(set.sourceText || '').trim();
  if (t) out.push(t);
}

/** @param {any} p @returns {string[]} */
export function collectLabsLines(p) {
  /** @type {string[]} */
  const labsLines = [];
  if (Array.isArray(p.icLabs)) {
    for (const block of p.icLabs) pushIcLabBlock(block, labsLines);
  }
  if (labsLines.length || !Array.isArray(p.labHistory)) return labsLines;
  for (const set of p.labHistory) pushLabHistorySet(set, labsLines);
  return labsLines;
}

/** @param {string[]} names @param {string[]} doses @param {string[]} indicaciones @returns {string[]} */
function padMedCells(names, doses, indicaciones) {
  /** @type {string[]} */
  const cells = [];
  for (let i = 0; i < 9; i += 1) cells.push(names[i] || '');
  for (let i = 0; i < 9; i += 1) cells.push(doses[i] || '');
  for (let i = 0; i < 2; i += 1) cells.push(indicaciones[i] || '');
  return cells;
}

/** @param {unknown} fantasticos @param {string[]} names @param {string[]} fantDoses */
function pushFantasticosNamesAndDoses(fantasticos, names, fantDoses) {
  if (!Array.isArray(fantasticos)) return;
  for (const f of fantasticos) {
    if (!f || typeof f !== 'object') continue;
    const drug = String(/** @type {any} */ (f).drug || '').trim();
    if (!drug) continue;
    names.push(drug);
    const dosis = String(/** @type {any} */ (f).dosis || '').trim();
    if (dosis) fantDoses.push(dosis);
  }
}

/**
 * Flat cells for IC med table sentinels.
 * Template layout (Ma. Elena): 4 fantasticos names + 5 otros names (no Furosemida in the
 * 9 name slots) + 9 doses (non-empty fant doses + Furosemida dose + otros doses) +
 * 2 indication slots (Anticoagulación / Estreñimiento).
 * Furosemida name / inicio dates / other indicaciones are filled separately.
 *
 * @param {unknown} fantasticos
 * @param {unknown} medSegments
 * @returns {string[]}
 */
export function buildMedTableCells(fantasticos, medSegments) {
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const fantDoses = [];
  pushFantasticosNamesAndDoses(fantasticos, names, fantDoses);

  const active = listActiveMeds(medSegments);
  /** @type {any[]} */
  const furoSegs = [];
  /** @type {any[]} */
  const otros = [];
  for (const s of active) {
    if (!s) continue;
    if (/furosemida/i.test(String(s.tipo || ''))) furoSegs.push(s);
    else otros.push(s);
  }
  for (const s of otros) {
    const tipo = String(s.tipo || '').trim();
    if (tipo) names.push(tipo);
  }

  /** @type {string[]} */
  const doses = fantDoses.slice();
  for (const s of furoSegs) {
    const d = String(s.dosis || '').trim();
    if (d) doses.push(d);
  }
  for (const s of otros) {
    const d = String(s.dosis || '').trim();
    if (d) doses.push(d);
  }

  const anti = otros.find(function (s) {
    return /anticoag/i.test(String(s.indicacion || '')) || /enoxaparina/i.test(String(s.tipo || ''));
  });
  const estre = otros.find(function (s) {
    return /estreñimiento/i.test(String(s.indicacion || '')) || /polietilen/i.test(String(s.tipo || ''));
  });
  const indicaciones = [
    anti ? String(anti.indicacion || '').trim() : '',
    estre ? String(estre.indicacion || '').trim() : '',
  ];

  return padMedCells(names, doses, indicaciones);
}

/**
 * Inicio dates for fantasticos (non-empty) + Furosemida + otros meds, template order.
 * @param {unknown} fantasticos
 * @param {unknown} medSegments
 * @returns {string[]} display dates like 13.03.26
 */
export function buildMedInicioCells(fantasticos, medSegments) {
  /** @type {string[]} */
  const out = [];
  if (Array.isArray(fantasticos)) {
    for (const f of fantasticos) {
      if (!f || typeof f !== 'object') continue;
      const drug = String(/** @type {any} */ (f).drug || '').trim();
      if (!drug) continue;
      const dosis = String(/** @type {any} */ (f).dosis || '').trim();
      // Template only stores inicio next to fantasticos that have a dose row.
      if (!dosis) continue;
      const ymd = toYmd(/** @type {any} */ (f).inicio);
      out.push(ymd ? formatShortDate(ymd) : '');
    }
  }
  const active = listActiveMeds(medSegments);
  const furo = active.filter((s) => s && /furosemida/i.test(String(s.tipo || '')));
  const otros = active.filter((s) => s && !/furosemida/i.test(String(s.tipo || '')));
  for (const s of furo.concat(otros)) {
    const ymd = toYmd(s.inicio);
    out.push(ymd ? formatShortDate(ymd) : '');
  }
  return out;
}

/**
 * Extra med-table strings: Furosemida name + remaining indicaciones (Pred/Levo/EPOC).
 * @param {unknown} medSegments
 * @returns {{ furosemidaName: string, indicacionesExtra: string[] }}
 */
export function buildMedExtraCells(medSegments) {
  const active = listActiveMeds(medSegments);
  const furo = active.find((s) => s && /furosemida/i.test(String(s.tipo || '')));
  const otros = active.filter((s) => s && !/furosemida/i.test(String(s.tipo || '')));
  /** @type {string[]} */
  const indicacionesExtra = [];
  for (const s of otros) {
    const ind = String(s.indicacion || '').trim();
    if (!ind) continue;
    if (/anticoag/i.test(ind) || /estreñimiento/i.test(ind)) continue;
    indicacionesExtra.push(ind);
  }
  return {
    furosemidaName: furo ? String(furo.tipo || '').trim() : '',
    indicacionesExtra,
  };
}

/** @param {unknown} entries */
export function collectEventosLines(entries) {
  const list = Array.isArray(entries) ? entries.slice() : [];
  list.sort((a, b) => String((a && a.at) || '').localeCompare(String((b && b.at) || '')));
  return list
    .map((e) => {
      if (!e) return '';
      const ymd = toYmd(e.at) || recordedAtToLocalYmd(e.at);
      const prefix = ymd ? formatShortDate(ymd) : '';
      const text = String(e.text || '').trim();
      if (!text) return '';
      return prefix ? `${prefix} ${text}` : text;
    })
    .filter(Boolean);
}

/** @param {unknown} diureticSegs */
export function collectDiureticStrategyLines(diureticSegs) {
  const segs = Array.isArray(diureticSegs) ? diureticSegs : [];
  return segs
    .map((s) => {
      if (!s) return '';
      const start = formatShortDate(toYmd(s.inicio)) || String(s.inicio || '').trim();
      const tipo = String(s.tipo || 'Furosemida').trim();
      const dosis = String(s.dosis || '').trim();
      return [start, tipo, dosis].filter(Boolean).join(' ');
    })
    .filter(Boolean);
}

/** @param {any} pocus @returns {string} */
export function formatPocusLine(pocus) {
  if (!pocus || !pocus.date) return '';
  const date = formatShortDate(pocus.date) || pocus.date;
  if (pocus.note) return `${date} ${String(pocus.note).trim()}`;
  return formatPocusParamsLine(date, pocus);
}

/** @param {string} date @param {any} pocus */
function formatPocusParamsLine(date, pocus) {
  const bits = [`${date} Parámetros de congestión:`];
  if (pocus.vciCm != null) bits.push(`VCI: ${pocus.vciCm}`);
  if (pocus.vexus != null) bits.push(`VExUS score: ${pocus.vexus}`);
  if (pocus.congestionScore != null) bits.push(`congestion score: ${pocus.congestionScore}`);
  if (pocus.lungPattern) bits.push(`Patrón ${pocus.lungPattern}`);
  if (pocus.lungLinesB) bits.push(String(pocus.lungLinesB));
  return `${bits.join(' ')} `;
}

/** @param {unknown} n @param {string} suffix */
export function formatAcumuladoDisplay(n, suffix) {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) === 0) return '';
  if (suffix === 'ml') return `${Number(n).toLocaleString('en-US')} ml`;
  return `      ${n} mg `;
}
