import { deriveSnapshot, balanceTurno, ensureMonitoreo } from './features/estado-actual-data.mjs';
import { parseEstadoActualPaste } from './features/estado-actual-parser.mjs';
import {
  computeIoBalanceFromIngEgr,
  ioNumericEgressTotal,
  isIoNumericValue,
  normalizeIoNcAbbrev,
  normalizeEvacAbbrev,
  serializeEgrPartsToFormText,
  toEaSalidaText,
} from './features/estado-actual-io.mjs';

const SOPORTE_LABEL = {
  'Aire ambiente': 'AL AIRE AMBIENTE',
  'Puntillas nasales': 'POR PUNTILLAS NASALES',
  'Alto flujo': 'POR ALTO FLUJO',
  'VM no invasiva': 'CON VENTILACIÓN MECÁNICA NO INVASIVA',
  Traqueostomía: 'CON TRAQUEOSTOMÍA',
};

/**
 * @param {unknown} n
 * @returns {string|null}
 */
function formatCc(n) {
  if (!isIoNumericValue(n)) return null;
  return Number(n).toLocaleString('es-MX') + ' CC';
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function formatEgresoShort(raw, egrParts) {
  if (Array.isArray(egrParts) && egrParts.length) {
    var allNc = egrParts.every(function (p) {
      return p && (p.value === 'NC' || String(p.value).toUpperCase() === 'NC');
    });
    if (allNc) return 'NO CUANTIFICADA';
    var serialized = serializeEgrPartsToFormText(egrParts);
    if (serialized) return toEaSalidaText(serialized);
  }
  if (raw == null || raw === '') return '';
  var norm = normalizeIoNcAbbrev(raw);
  if (norm === 'NC') return 'NO CUANTIFICADA';
  if (isIoNumericValue(norm)) return formatCc(norm) || String(norm);
  if (/no\s+cuantificad/i.test(String(raw))) return 'NO CUANTIFICADA';
  return toEaSalidaText(raw);
}

/**
 * @param {unknown} evac
 * @returns {string}
 */
function formatEvacShort(evac) {
  if (evac == null || evac === '') return '';
  var norm = normalizeEvacAbbrev(evac);
  if (norm === 'NC') return 'NO REPORTADAS';
  if (isIoNumericValue(evac)) {
    return Number(evac).toLocaleString('es-MX');
  }
  if (/no\s+reportad|sin\s+evac/i.test(String(evac))) return 'NO REPORTADAS';
  return toEaSalidaText(evac);
}

/**
 * @param {unknown} io
 * @param {number} [balTurno]
 * @returns {string}
 */
function ioSnapshotHasContent(io) {
  return (
    (io.ing != null && io.ing !== '') ||
    (io.egr != null && io.egr !== '') ||
    (Array.isArray(io.egrParts) && io.egrParts.length > 0) ||
    (io.evac != null && io.evac !== '')
  );
}

function formatBalanceShort(io, balTurno) {
  io = io && typeof io === 'object' ? io : {};
  if (!ioSnapshotHasContent(io)) return '';

  if (balTurno != null && balTurno !== '' && Number.isFinite(Number(balTurno))) {
    var n = Number(balTurno);
    return (n > 0 ? '+' : '') + n.toLocaleString('es-MX') + ' CC';
  }
  var computed = computeIoBalanceFromIngEgr(io.ing, io);
  if (Number.isFinite(computed)) {
    return (computed > 0 ? '+' : '') + computed.toLocaleString('es-MX') + ' CC';
  }
  if (ioNumericEgressTotal(io) == null) return 'NC';
  return '';
}

function appendCensoVitalLines(lines, v) {
  if (v.temp != null && v.temp !== '') lines.push('T°: ' + v.temp + ' °C');
  if (v.fc != null && v.fc !== '') lines.push('FC: ' + v.fc + ' LPM');
  if (v.fr != null && v.fr !== '') lines.push('FR: ' + v.fr + ' RPM');
  if (v.tas != null || v.tad != null) {
    lines.push('TA: ' + (v.tas != null && v.tas !== '' ? v.tas : '—') + '/' + (v.tad != null && v.tad !== '' ? v.tad : '—') + ' MMHG');
  }
}

function resolveCensoGlucometrias(snapshot) {
  if (snapshot && Array.isArray(snapshot.glucometrias) && snapshot.glucometrias.length) {
    return snapshot.glucometrias;
  }
  if (snapshot && Array.isArray(snapshot.bombaInsulina) && snapshot.bombaInsulina.length) {
    return snapshot.bombaInsulina;
  }
  return [];
}

function appendCensoGluLine(lines, glu) {
  if (!glu.length) return;
  var vals = glu
    .map(function (g) {
      return g && g.value != null && g.value !== '' ? String(g.value) : '';
    })
    .filter(Boolean)
    .join(', ');
  if (vals) lines.push('DXT: ' + vals + ' MG/DL');
}

function appendCensoSatLine(lines, v, ctx) {
  if (v.sat == null || v.sat === '') return;
  var soporteKey = ctx.soporte != null ? String(ctx.soporte).trim() : '';
  var soporte =
    SOPORTE_LABEL[soporteKey] ||
    (ctx.soporteHint ? toEaSalidaText(ctx.soporteHint) : '') ||
    SOPORTE_LABEL['Aire ambiente'];
  lines.push('SAT: ' + v.sat + '% ' + soporte);
}

/**
 * @param {{ vitals?: Record<string, unknown>, glucometrias?: Array<{ value?: unknown }>, bombaInsulina?: Array<{ value?: unknown }> } | null | undefined} snapshot
 * @param {{ soporte?: unknown, soporteHint?: string | null } | null | undefined} ctx
 * @returns {string[]}
 */
export function formatCensoSignosColumn(snapshot, ctx) {
  ctx = ctx || {};
  var v =
    snapshot && snapshot.vitals && typeof snapshot.vitals === 'object'
      ? /** @type {Record<string, unknown>} */ (snapshot.vitals)
      : {};
  var lines = [];
  appendCensoVitalLines(lines, v);
  appendCensoGluLine(lines, resolveCensoGlucometrias(snapshot));
  appendCensoSatLine(lines, v, ctx);
  return lines;
}

/**
 * @param {{ ing?: unknown, egr?: unknown, egrParts?: unknown[] } | null | undefined} io
 * @param {number} [balTurno]
 * @returns {string[]}
 */
export function formatCensoIoColumn(io, balTurno) {
  io = io && typeof io === 'object' ? io : {};
  var lines = [];

  if (io.ing != null && io.ing !== '') {
    var ing = formatCc(io.ing);
    if (ing) lines.push('I: ' + ing);
  }
  var egrText = formatEgresoShort(io.egr, /** @type {import('./features/estado-actual-io.mjs').IoEgresoPart[] | undefined} */ (io.egrParts));
  if (egrText) lines.push('E: ' + egrText);
  else if (ioNumericEgressTotal(io) == null && (io.egr != null || (Array.isArray(io.egrParts) && io.egrParts.length))) {
    lines.push('E: NO CUANTIFICADA');
  }

  var bal = formatBalanceShort(io, balTurno);
  if (bal) lines.push('B: ' + bal);

  if (io.evac != null && io.evac !== '') {
    lines.push('EVAC: ' + formatEvacShort(io.evac));
  }

  return lines;
}

/**
 * @param {ReturnType<typeof deriveSnapshot>} snapshot
 * @returns {boolean}
 */
function snapshotHasVitals(v) {
  return ['temp', 'fc', 'fr', 'tas', 'tad', 'sat'].some(function (k) {
    return v[k] != null && v[k] !== '';
  });
}

function snapshotHasCensoData(snapshot) {
  if (!snapshot) return false;
  var v =
    snapshot.vitals && typeof snapshot.vitals === 'object'
      ? /** @type {Record<string, unknown>} */ (snapshot.vitals)
      : {};
  if (snapshotHasVitals(v)) return true;
  if (Array.isArray(snapshot.glucometrias) && snapshot.glucometrias.length) return true;
  if (Array.isArray(snapshot.bombaInsulina) && snapshot.bombaInsulina.length) return true;
  var io = snapshot.io && typeof snapshot.io === 'object' ? snapshot.io : {};
  return ioSnapshotHasContent(io);
}

/**
 * @param {ReturnType<typeof parseEstadoActualPaste>} parsed
 * @returns {ReturnType<typeof deriveSnapshot>}
 */
function snapshotFromParsed(parsed) {
  return {
    vitals: parsed.vitals,
    alteredAt: parsed.alteredAt,
    glucometrias: parsed.glucometrias,
    bombaInsulina: [],
    io: parsed.io,
  };
}

/**
 * @param {Record<string, unknown>} patient
 * @returns {{ snapshot: ReturnType<typeof deriveSnapshot>, soporteHint?: string | null }}
 */
export function resolveCensoMonitoreoSnapshot(patient) {
  ensureMonitoreo(patient);
  /** @type {any} */
  var mon = patient.monitoreo || {};
  var snapshot = deriveSnapshot(mon);
  var soporteHint = null;

  if (!snapshotHasCensoData(snapshot)) {
    var tg = mon.textoGuardado;
    var text =
      tg && tg.text != null
        ? String(tg.text).trim()
        : tg && tg.texto != null
          ? String(tg.texto).trim()
          : '';
    if (text) {
      var parsed = parseEstadoActualPaste(text);
      if (parsed.ok) {
        snapshot = snapshotFromParsed(parsed);
        soporteHint = parsed.soporteHint || null;
      }
    }
  }

  return { snapshot: snapshot, soporteHint: soporteHint };
}

/**
 * @param {Record<string, unknown>} patient
 * @returns {{ signosCol: string, ioCol: string }}
 */
export function formatCensoSignosIoFromPatient(patient) {
  var resolved = resolveCensoMonitoreoSnapshot(patient);
  /** @type {any} */
  var mon = patient.monitoreo || {};
  var ec = mon.estadoClinico && typeof mon.estadoClinico === 'object' ? mon.estadoClinico : {};
  var ctx = {
    soporte: ec.soporte,
    soporteHint: resolved.soporteHint,
  };
  var bal = balanceTurno(mon);
  var signosLines = formatCensoSignosColumn(resolved.snapshot, ctx);
  var ioLines = formatCensoIoColumn(resolved.snapshot.io, Number.isFinite(bal) ? bal : undefined);
  return {
    signosCol: signosLines.join('\n'),
    ioCol: ioLines.join('\n'),
  };
}
