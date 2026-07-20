/**
 * Map a Cardionotas patient → plain DTO for the IC hoja docx filler.
 * Empty fields stay empty/`—` at fill time; this module only gathers values.
 */

import { computeDescongestion } from './descongestion.mjs';
import { getPocusDay } from './congestion.mjs';
import { listActiveMeds, sumFurosemidaMg } from './med-segments.mjs';
import { ensureCardio } from './patient-cardio.mjs';
import {
  formatDisplayDate,
  formatShortDate,
  resolveIngresoYmd,
  toYmd,
} from './ic-export-payload-dates.mjs';
import {
  buildMedTableCells,
  collectDiureticStrategyLines,
  collectEventosLines,
  collectLabsLines,
  formatAcumuladoDisplay,
  formatPocusLine,
  localYmd,
  recordedAtToLocalYmd,
  resolveDiagnosticos,
  resolveIoDiuresisMl,
  splitNonEmptyLines,
  vitalsForDay,
} from './ic-export-payload-map.mjs';

export {
  toYmd,
  formatDisplayDate,
  formatShortDate,
  resolveIngresoYmd,
  buildMedTableCells,
};

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
    const n = resolveIoDiuresisMl(r.io || {});
    if (n == null) continue;
    byDay.set(ymd, (byDay.get(ymd) || 0) + n);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((e) => e[1]);
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
  const computed = computeDescongestion({
    ingresoDate,
    asOfDate,
    inicioDescongestion: cardio.inicioDescongestion || '',
    dailyDiuresisMl: extractDailyDiuresisMl(p.monitoreo),
    furosemidaAcumuladaMg: sumFurosemidaMg(cardio.diureticSegments),
    overrides: cardio.overrides || {},
  });
  return assembleIcPayload(p, cardio, asOfDate, ingresoDate, computed);
}

/**
 * @param {any} p
 * @param {any} cardio
 * @param {string} asOfDate
 * @param {string} ingresoDate
 * @param {any} computed
 */
function assembleIcPayload(p, cardio, asOfDate, ingresoDate, computed) {
  const hc = p.historiaClinica && typeof p.historiaClinica === 'object' ? p.historiaClinica : {};
  const app = hc.app && typeof hc.app === 'object' ? hc.app : {};
  const pocusHistory = Array.isArray(cardio.pocusByDay) ? cardio.pocusByDay : [];
  const pocusAsOf = getPocusDay(pocusHistory, asOfDate);
  const checklist = (pocusAsOf && pocusAsOf.checklist) || {};
  const vitals = vitalsForDay(p.monitoreo, asOfDate);
  const diureticSegs = Array.isArray(cardio.diureticSegments) ? cardio.diureticSegments : [];
  const activeDiuretics = listActiveMeds(diureticSegs);
  const evStore = p.eventualidades && typeof p.eventualidades === 'object' ? p.eventualidades : {};

  return Object.assign(
    identityFields(p, cardio, asOfDate, ingresoDate),
    narrativeFields(app, hc, p),
    descongestionFields(computed, cardio, vitals),
    congestionFields(pocusAsOf, checklist, pocusHistory),
    medEventLabFields(p, cardio, diureticSegs, activeDiuretics, evStore),
  );
}

/** @param {any} p @param {any} cardio @param {string} asOfDate @param {string} ingresoDate */
function identityFields(p, cardio, asOfDate, ingresoDate) {
  return {
    asOfDate,
    nombre: String(p.nombre || '').trim(),
    registro: String(p.registro || '').trim(),
    edad: String(p.edad != null ? p.edad : '').trim(),
    ingresoDisplay: formatDisplayDate(ingresoDate),
    fechaDisplay: formatDisplayDate(asOfDate),
    fenotipo: String(p.fenotipo || cardio.fenotipo || '').trim(),
    etiologia: String(p.etiologia || cardio.etiologia || '').trim(),
    residente: String(p.residente || cardio.residente || '').trim(),
    ekg: String(cardio.ekg || p.ekg || '').trim(),
    ritmo: String(cardio.ritmo || '').trim(),
    estrategiaControlFa: String(cardio.estrategiaControlFa || '').trim(),
    diagnosticos: resolveDiagnosticos(p.diagnosticos),
  };
}

/** @param {any} app @param {any} hc @param {any} p */
function narrativeFields(app, hc, p) {
  return {
    antecedentesLines: splitNonEmptyLines(app.descripcionDetallada),
    peeaLines: splitNonEmptyLines(hc.padecimientoActual || p.peea),
  };
}

/** @param {any} computed @param {any} cardio @param {{ line: string, diuresis24h: number|null }} vitals */
function descongestionFields(computed, cardio, vitals) {
  return {
    diasInternamiento: computed.diasInternamiento,
    inicioDescongestionDisplay: formatDisplayDate(toYmd(cardio.inicioDescongestion)),
    diasDescongestion: computed.diasDescongestion,
    vitalsLine: vitals.line,
    diuresis24hDisplay: vitals.diuresis24h != null ? ` ${vitals.diuresis24h} CC` : '',
    diuresisAcumuladaDisplay: formatAcumuladoDisplay(computed.diuresisAcumuladaMl, 'ml'),
    furosemidaAcumuladaDisplay: formatAcumuladoDisplay(computed.furosemidaAcumuladaMg, 'mg'),
  };
}

/** @param {any} pocusAsOf @param {any} checklist @param {any[]} pocusHistory */
function congestionFields(pocusAsOf, checklist, pocusHistory) {
  return {
    checklist: {
      pvy: checklist.pvy,
      rhy: checklist.rhy,
      soplo: checklist.soplo,
      soploNota: String(checklist.soploNota || '').trim(),
      estertores: checklist.estertores,
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
  };
}

/**
 * @param {any} p
 * @param {any} cardio
 * @param {any[]} diureticSegs
 * @param {any[]} activeDiuretics
 * @param {any} evStore
 */
function medEventLabFields(p, cardio, diureticSegs, activeDiuretics, evStore) {
  return {
    esquemaDiureticosActual: activeDiuretics.length
      ? activeDiuretics.map((s) => `${s.tipo || ''} ${s.dosis || ''}`.trim()).join('; ')
      : '',
    diureticStrategyLines: collectDiureticStrategyLines(diureticSegs),
    fantasticos: Array.isArray(cardio.fantasticos) ? cardio.fantasticos : [],
    medSegments: Array.isArray(cardio.medSegments) ? cardio.medSegments : [],
    medCells: buildMedTableCells(cardio.fantasticos, cardio.medSegments),
    eventosLines: collectEventosLines(evStore.entries),
    labsLines: collectLabsLines(p),
  };
}
