/**
 * Entrada masiva de laboratorios SOME: separadores de paciente, split por Expediente:,
 * vista previa y consolidación por día + tipo dentro de ventana de 2 h.
 */
import {
  procesarLabs,
  looksLikeSomeLabReport,
  mergeBhResLabRows_,
  extractLabExpedienteFromReport,
  reprocessLabResultLines_,
} from './labs.js';
import { normalizeFechaLabHistory, normalizeHoraLabHistory, parseFechaLabToMs } from './tend-core.mjs';
import { normalizeLabLine } from './lab-history-auto-store-core.mjs';
import { isGasometriaOnlyResLabs, primaryTipoForLabSet } from './lab-history-format.mjs';
import {
  clusterByDayTipoAndTimeWindow,
  clusterByTimeWindow,
  labTimestampMsFromFechaHora,
  resolveLabConsolidationWindowMs,
} from './lab-consolidation-cluster.mjs';
import { mergeTroponinaResLabRows_ } from './labs-troponin.mjs';

export const LAB_BULK_PATIENT_SEPARATOR = '--- PACIENTE ---';

function primaryTipoForResLabs(resLabs) {
  return primaryTipoForLabSet(resLabs);
}

export function dayKeyFromResult(result) {
  var fecha = normalizeFechaLabHistory(result.patient && result.patient.fecha) || '';
  var hora = normalizeHoraLabHistory(result.patient && result.patient.hora);
  if (fecha === 'Anterior') return 'Anterior';
  var ms = parseFechaLabToMs(fecha, hora);
  if (typeof ms === 'number' && isFinite(ms)) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  return 'unknown';
}

export function isLabBulkPatientSeparatorLine(line) {
  return /^\s*---\s*PACIENTE\s*---\s*$/i.test(String(line || '').trim());
}

/** Parte el pegado masivo en bloques por separador de paciente. */
export function splitBulkLabTextByPatient(text) {
  var raw = String(text || '');
  if (!raw.trim()) return [];
  var lines = raw.split(/\r?\n/);
  var blocks = [];
  var current = [];
  lines.forEach(function (line) {
    if (isLabBulkPatientSeparatorLine(line)) {
      if (current.length) {
        var chunk = current.join('\n').trim();
        if (chunk) blocks.push(chunk);
        current = [];
      }
      return;
    }
    current.push(line);
  });
  if (current.length) {
    var tail = current.join('\n').trim();
    if (tail) blocks.push(tail);
  }
  return blocks;
}

/** Dentro de un bloque de paciente, separa reportes SOME por encabezado Expediente:. */
export function splitSomeReportsInBlock(blockText) {
  var raw = String(blockText || '').trim();
  if (!raw) return [];
  return raw
    .split(/(?=^\s*Expediente\s*:)/im)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function labRowSectionKey(row) {
  var s = String(row || '').trim();
  if (!s) return '';
  var m = s.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ0-9]+)/);
  return m ? m[1].toUpperCase() : '';
}

function labRowRichnessScore(row) {
  var s = String(row || '');
  var score = s.length;
  score += (s.match(/\b(?:AG|DELTA-DELTA|ICA|LACTATO|BICA|PCO2|PO2)\b/gi) || []).length * 8;
  score += (s.match(/\d/g) || []).length;
  if (/INTERPRETACI[ÓO]N\s+GASOMETR[IÍ]A/i.test(s)) score += 20;
  return score;
}

function isBhResLabRow(row) {
  var key = labRowSectionKey(row);
  return key === 'BH' || /^BH:/i.test(String(row || '').trim());
}

/** Dedupe de renglones al consolidar mismo día (misma lógica que lab-panel). */
export function dedupeConsolidatedLabRows(rows, tipo) {
  var normalized = [];
  var seenExact = Object.create(null);
  (rows || []).forEach(function (row) {
    var norm = normalizeLabLine(String(row == null ? '' : row));
    if (!norm) return;
    if (seenExact[norm]) return;
    seenExact[norm] = true;
    normalized.push(String(row));
  });
  if (tipo !== 'labs') return normalized;

  var bhRows = [];
  var tropRows = [];
  var otherRows = [];
  normalized.forEach(function (row) {
    if (isBhResLabRow(row)) bhRows.push(row);
    else if (labRowSectionKey(row) === 'TROP') tropRows.push(row);
    else otherRows.push(row);
  });

  var bestBySection = Object.create(null);
  otherRows.forEach(function (row, idx) {
    var key = labRowSectionKey(row);
    if (!key) return;
    var cand = { row: row, idx: idx, score: labRowRichnessScore(row) };
    var prev = bestBySection[key];
    if (!prev || cand.score > prev.score || (cand.score === prev.score && cand.idx > prev.idx)) {
      bestBySection[key] = cand;
    }
  });

  var out = Object.keys(bestBySection).map(function (k) {
    return bestBySection[k].row;
  });
  var mergedTrop = mergeTroponinaResLabRows_(tropRows);
  if (mergedTrop) out.push(mergedTrop);
  if (bhRows.length) {
    var mergedBh = mergeBhResLabRows_(bhRows);
    if (mergedBh.bh) out.unshift(mergedBh.bh);
    if (mergedBh.coag) {
      var insertAt = mergedBh.bh ? 1 : 0;
      out.splice(insertAt, 0, mergedBh.coag);
    }
  }
  return out;
}

function sortDaysDesc(days) {
  return days.slice().sort(function (a, b) {
    var ma = parseFechaLabToMs(a, '');
    var mb = parseFechaLabToMs(b, '');
    if (typeof ma === 'number' && typeof mb === 'number' && ma !== mb) return mb - ma;
    return String(b).localeCompare(String(a));
  });
}

function parseReportChunkFailure(reportIndex, error, meta) {
  return { reportIndex, ok: false, error, ...meta };
}

function parseReportChunkSuccess(reportText, reportIndex, result) {
  return {
    reportIndex: reportIndex,
    ok: true,
    reportText: reportText,
    result: result,
    expediente: String((result.patient && result.patient.expediente) || '').trim(),
    nombre: String((result.patient && result.patient.name) || '').trim(),
    fecha: normalizeFechaLabHistory(result.patient && result.patient.fecha) || '',
    hora: normalizeHoraLabHistory(result.patient && result.patient.hora),
    bloques: result.resLabs.length,
  };
}

function resolveChartPatientForReport_(reportText, findPatient) {
  if (!findPatient) return null;
  var exp = extractLabExpedienteFromReport(reportText);
  if (!exp) return null;
  return findPatient(exp) || null;
}

function parseReportChunk(reportText, reportIndex, findPatient) {
  if (!looksLikeSomeLabReport(reportText)) {
    return parseReportChunkFailure(reportIndex, 'No parece reporte SOME (copia desde «Expediente:»)');
  }
  try {
    var chartPatient = resolveChartPatientForReport_(reportText, findPatient);
    var result = procesarLabs(reportText, chartPatient ? { patient: chartPatient } : undefined);
    if (!result.resLabs || !result.resLabs.length) {
      return parseReportChunkFailure(reportIndex, 'Sin resultados parseables', {
        expediente: result.patient && result.patient.expediente,
        nombre: result.patient && result.patient.name,
      });
    }
    return parseReportChunkSuccess(reportText, reportIndex, result);
  } catch (e) {
    return parseReportChunkFailure(reportIndex, e && e.message ? e.message : 'Error al parsear');
  }
}

function collectUniqueExpedientes(okReports) {
  var expedientes = [];
  okReports.forEach(function (r) {
    if (r.expediente && expedientes.indexOf(r.expediente) === -1) expedientes.push(r.expediente);
  });
  return expedientes;
}

function filterUsableReportsForPatient(okReports, match) {
  if (!match) return okReports;
  var patientReg = String(match.registro || '').trim();
  if (!patientReg) return okReports;
  return okReports.filter(function (r) {
    return r.expediente === patientReg;
  });
}

function collectReportDays(usableReports) {
  var days = [];
  usableReports.forEach(function (r) {
    if (r.fecha && days.indexOf(r.fecha) === -1) days.push(r.fecha);
  });
  return days;
}

function resolveBulkBlockStatus(chunks, okReports, match, expedientes, usableReports) {
  if (!chunks.length) return 'empty';
  if (!okReports.length) return 'parse-errors';
  if (!match) return 'no-patient';
  if (expedientes.length > 1) return 'mixed-expediente';
  if (!usableReports.length) return 'parse-errors';
  return 'ok';
}

function buildBulkBlockPreview(blockText, blockIndex, findPatient) {
  var chunks = splitSomeReportsInBlock(blockText);
  var reports = chunks.map(function (chunk, ri) {
    return parseReportChunk(chunk, ri, findPatient);
  });
  var okReports = reports.filter(function (r) {
    return r.ok;
  });
  var expedientes = collectUniqueExpedientes(okReports);
  var primaryExp = expedientes[0] || '';
  var match = primaryExp && findPatient ? findPatient(primaryExp) : null;
  var usableReports = filterUsableReportsForPatient(okReports, match);
  var days = collectReportDays(usableReports);
  var status = resolveBulkBlockStatus(chunks, okReports, match, expedientes, usableReports);
  var patientReg = match ? String(match.registro || '').trim() : '';
  var setsAfterMerge = usableReports.length
    ? mergeBulkParseResultsForStorage(
        usableReports.map(function (r) {
          return { result: r.result, reportText: r.reportText };
        })
      ).length
    : 0;

  return {
    blockIndex: blockIndex,
    reportCount: chunks.length,
    okReportCount: usableReports.length,
    reports: reports,
    expedientes: expedientes,
    patient: match,
    patientName: match ? match.nombre || 'Sin nombre' : okReports[0] ? okReports[0].nombre || '—' : '—',
    primaryExpediente: patientReg || primaryExp,
    days: sortDaysDesc(days),
    daysLabel: sortDaysDesc(days).join(', ') || '—',
    setsAfterMerge: setsAfterMerge,
    status: status,
    canProcess: !!match && usableReports.length > 0,
  };
}

/**
 * @param {string} text
 * @param {{ findPatientByRegistro: (reg: string) => { id: string, nombre?: string, registro?: string } | null }} opts
 */
export function buildBulkLabPreview(text, opts) {
  var findPatient = opts && opts.findPatientByRegistro;
  var blocks = splitBulkLabTextByPatient(text);
  if (!blocks.length && String(text || '').trim()) {
    blocks = [String(text).trim()];
  }
  return blocks.map(function (blockText, blockIndex) {
    return buildBulkBlockPreview(blockText, blockIndex, findPatient);
  });
}

function buildMergedPayloadFromGroup(items, tipo) {
  var mergeOrder = (items || []).slice().sort(function (a, b) {
    var sa =
      a && a.reportText && looksLikeSomeLabReport(a.reportText) ? 1 : 0;
    var sb =
      b && b.reportText && looksLikeSomeLabReport(b.reportText) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return 0;
  });
  var merged = [];
  var sourceParts = [];
  var mergedBhExtras = {};
  var mergedRefs = {};
  var newestHora = '';
  var horaSome = '';
  mergeOrder.forEach(function (item, _idx) {
    var result = item.result;
    var rows = (result.resLabs || []).slice();
    if (merged.length && rows.length) merged.push('');
    merged = merged.concat(rows);
    if (item.reportText && String(item.reportText).trim()) sourceParts.push(String(item.reportText).trim());
    if (result.bhExtras && typeof result.bhExtras === 'object') {
      Object.keys(result.bhExtras).forEach(function (k) {
        mergedBhExtras[k] = result.bhExtras[k];
      });
    }
    if (result.refsBySection && typeof result.refsBySection === 'object') {
      Object.keys(result.refsBySection).forEach(function (k) {
        mergedRefs[k] = result.refsBySection[k];
      });
    }
    var h = normalizeHoraLabHistory(result.patient && result.patient.hora);
    if (h) newestHora = h;
    if (item.reportText && looksLikeSomeLabReport(item.reportText) && h) horaSome = h;
  });
  var deduped = dedupeConsolidatedLabRows(merged, tipo);
  deduped = reprocessLabResultLines_(deduped, {
    gasRefs: mergedRefs.GASES,
  });
  var first = mergeOrder[0].result;
  var fecha = normalizeFechaLabHistory(first.patient && first.patient.fecha) || '';
  return {
    resLabs: deduped,
    fecha: fecha,
    hora: horaSome || newestHora,
    sourceText: sourceParts.join('\n\n---\n\n'),
    bhExtras: mergedBhExtras,
    refsBySection: mergedRefs,
    patient: first.patient,
  };
}

function timestampMsFromParsedItem(item) {
  var result = item && item.result;
  if (!result) return null;
  return labTimestampMsFromFechaHora(result.patient && result.patient.fecha, result.patient && result.patient.hora);
}

/**
 * Agrupa reportes del mismo día y tipo homogéneo si caen en ventana de 2 h consecutiva.
 * @param {{ result: object, reportText: string }[]} parsedItems
 */
export function mergeBulkParseResults(parsedItems) {
  var clusters = clusterByDayTipoAndTimeWindow(
    (parsedItems || []).filter(function (item) {
      return item && item.result && item.result.resLabs && item.result.resLabs.length;
    }),
    function (item) {
      return dayKeyFromResult(item.result);
    },
    function (item) {
      return primaryTipoForResLabs(item.result.resLabs || []);
    },
    timestampMsFromParsedItem,
    function (item) {
      return isGasometriaOnlyResLabs(item.result.resLabs || []);
    }
  );
  return clusters.map(function (cluster) {
    var tipo = primaryTipoForResLabs(cluster[0].result.resLabs || []);
    return buildMergedPayloadFromGroup(cluster, tipo);
  });
}

/**
 * Historial: un conjunto por día calendario (repo / pegado masivo del mismo día).
 * Evita duplicar Labs (1)…(4) cuando llegan gasometría y química en PDFs separados.
 */
export function mergeBulkParseResultsForStorage(parsedItems) {
  var items = (parsedItems || []).filter(function (item) {
    return item && item.result && item.result.resLabs && item.result.resLabs.length;
  });
  if (!items.length) return [];

  var byDay = Object.create(null);
  var passthrough = [];

  items.forEach(function (item) {
    var tipo = primaryTipoForResLabs(item.result.resLabs || []);
    var dk = dayKeyFromResult(item.result);
    if (tipo === 'mixed' || tipo === 'cultivo' || !dk || dk === 'unknown' || dk === 'Anterior') {
      passthrough.push(item);
      return;
    }
    if (!byDay[dk]) byDay[dk] = [];
    byDay[dk].push(item);
  });

  var out = [];
  Object.keys(byDay).forEach(function (dk) {
    var dayItems = byDay[dk];
    var tipo = primaryTipoForResLabs(dayItems[0].result.resLabs || []);
    out.push(buildMergedPayloadFromGroup(dayItems, tipo));
  });

  if (passthrough.length) {
    out = out.concat(mergeBulkParseResults(passthrough));
  }
  return out;
}

function latestDayKeyFromParsedItems(parsedItems) {
  var latestMs = -Infinity;
  (parsedItems || []).forEach(function (item) {
    if (!item || !item.result) return;
    var fecha = normalizeFechaLabHistory(item.result.patient && item.result.patient.fecha) || '';
    var hora = normalizeHoraLabHistory(item.result.patient && item.result.patient.hora);
    var ms = parseFechaLabToMs(fecha, hora);
    if (typeof ms === 'number' && isFinite(ms) && ms > latestMs) latestMs = ms;
  });
  if (!(latestMs > -Infinity)) return '';
  var d = new Date(latestMs);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function wrapSingleParsedLabDisplay(item) {
  if (!item || !item.result) return null;
  return {
    patient: item.result.patient,
    resLabs: item.result.resLabs,
    bhExtras: item.result.bhExtras,
    refsBySection: item.result.refsBySection,
    sourceText: item.reportText,
    expediente: item.result.patient && item.result.patient.expediente,
  };
}

/**
 * Resultados tras pegado: día más reciente; fusiona solicitudes del mismo bloque horario (≤2 h).
 * @param {{ result: object, reportText: string }[]} parsedItems
 */
export function pickLatestDayMergedLabDisplay(parsedItems) {
  var items = (parsedItems || []).filter(function (item) {
    return item && item.result && item.result.resLabs && item.result.resLabs.length;
  });
  if (!items.length) return null;
  if (items.length === 1) return wrapSingleParsedLabDisplay(items[0]);

  var latestDayKey = latestDayKeyFromParsedItems(items);
  var dayItems = latestDayKey
    ? items.filter(function (item) {
        return dayKeyFromResult(item.result) === latestDayKey;
      })
    : items.slice();
  if (!dayItems.length) dayItems = items.slice();
  if (dayItems.length === 1) return wrapSingleParsedLabDisplay(dayItems[0]);

  var latestItem = dayItems[0];
  var latestMs = timestampMsFromParsedItem(latestItem);
  dayItems.slice(1).forEach(function (item) {
    var ms = timestampMsFromParsedItem(item);
    if (typeof ms === 'number' && isFinite(ms)) {
      if (typeof latestMs !== 'number' || !isFinite(latestMs) || ms > latestMs) {
        latestItem = item;
        latestMs = ms;
      }
    }
  });

  var dayTipo = primaryTipoForResLabs(latestItem.result.resLabs || []);
  var dayClusters = clusterByTimeWindow(
    dayItems,
    timestampMsFromParsedItem,
    resolveLabConsolidationWindowMs(dayTipo)
  );
  var targetCluster = dayClusters.find(function (cluster) {
    return cluster.indexOf(latestItem) !== -1;
  }) || [latestItem];
  if (targetCluster.length === 1) return wrapSingleParsedLabDisplay(targetCluster[0]);

  var tipo = primaryTipoForResLabs(targetCluster[0].result.resLabs || []);
  return buildMergedPayloadFromGroup(targetCluster, tipo);
}

function bulkBlocksHaveProcessablePatient(blocks) {
  return blocks.some(function (b) {
    return b && b.canProcess && b.okReportCount > 0 && b.patient;
  });
}

function bulkBlocksHaveDisplayableReports(blocks) {
  return blocks.some(function (b) {
    return b && b.okReportCount > 0;
  });
}

/** Muestra vista previa antes de guardar cuando hay pegado masivo o avisos. */
export function shouldShowBulkLabPreview(blocks, totalOkReports, opts) {
  if (!Array.isArray(blocks) || !blocks.length) return false;
  var quickLabOutput = !!(opts && opts.quickLabOutput);
  // Salida rápida: si ningún expediente está en la lista, formatear sin modal
  // (varios días/reportes en un pegado también aplican).
  if (
    quickLabOutput &&
    bulkBlocksHaveDisplayableReports(blocks) &&
    !bulkBlocksHaveProcessablePatient(blocks)
  ) {
    return false;
  }
  if (blocks.length > 1) return true;
  if (totalOkReports > 1) return true;
  return blocks.some(function (b) {
    return b && b.status !== 'ok';
  });
}

/** Datos SOME del paciente para el modal de alta (primer reporte válido del bloque). */
export function extractLabPatientFromBulkBlock(block) {
  if (!block || !Array.isArray(block.reports)) return null;
  var ok = block.reports.find(function (r) {
    return r.ok && r.result && r.result.patient;
  });
  if (!ok || !ok.result.patient) return null;
  return ok.result.patient;
}

export function bulkPreviewStatusLabel(status) {
  switch (status) {
    case 'ok':
      return 'Listo';
    case 'mixed-expediente':
      return 'Varios expedientes';
    case 'no-patient':
      return 'Paciente no encontrado';
    case 'parse-errors':
      return 'Error al parsear';
    case 'empty':
      return 'Vacío';
    default:
      return status || '—';
  }
}
