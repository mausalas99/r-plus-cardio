// Lab panel — renderOutput helpers
import {
  looksLikeSomeLabReport,
  renderEntry,
  isLabSectionHeaderHtml,
} from '../labs.js';
import { parseSomeReportTables } from '../labs-some-table.mjs';
import { normalizeFechaLabHistory } from '../tend-core.mjs';
import {
  getActivePatientLabHistory,
  labSetIdForHistory,
  syncLabHistoryDateSelect,
  setLabHistorySelectedSetId,
} from './lab-panel-history.mjs';
import { findDisplayLabHistorySetId } from './lab-panel-history-dedupe.mjs';

export function resolveLabOutputFechaBanner(patient) {
  if (!patient || !patient.fecha) return '';
  var fechaBanner = normalizeFechaLabHistory(patient.fecha) || String(patient.fecha).trim();
  return fechaBanner === 'Anterior' ? '' : fechaBanner;
}

export function updateLabPatientBanner(patient, fechaBanner, findPatientByRegistro) {
  var banner = document.getElementById('lab-banner');
  if (!banner) return;
  if (!patient || !patient.name) {
    banner.style.display = 'none';
    return;
  }
  var reg = String(patient.expediente || '').trim();
  var inCensus = reg && findPatientByRegistro(reg);
  if (inCensus) {
    banner.style.display = 'none';
    return;
  }
  document.getElementById('lab-patient-name').textContent = patient.name;
  document.getElementById('lab-patient-meta').textContent = [
    patient.expediente ? 'Exp: ' + patient.expediente : '',
    patient.sexo,
    patient.edad || '',
    fechaBanner || patient.fecha,
  ]
    .filter(Boolean)
    .join('  |  ');
  banner.style.display = 'block';
}

export function attachSomeTablesParsed(result, src) {
  result.someTablesParsed = null;
  if (!src || !looksLikeSomeLabReport(src)) return;
  var someParsed = parseSomeReportTables(src);
  if (someParsed.departments && someParsed.departments.length) {
    result.someTablesParsed = someParsed;
  }
}

function appendBhExtendedLines(box, text, result, labDisp, rt) {
  if (!labDisp.showBhExtendedLine || !result.bhExtras || !rt.isBhMainResLabChunk(text)) return;
  var extTab = rt.formatBhExtendedTabLine(result.bhExtras, result.sourceText);
  if (!extTab) return;
  renderEntry(extTab).forEach(function (html, idx) {
    var divEx = document.createElement('div');
    divEx.className = (idx === 0 ? 'out-line' : 'out-indent') + ' lab-bh-extended-line';
    divEx.innerHTML = html;
    box.appendChild(divEx);
  });
}

function appendCitoquimInterpretacionChunk(box, text, rt) {
  var alertDiv = document.createElement('div');
  alertDiv.className = 'lab-out-citoquim-interp out-line';
  alertDiv.setAttribute('role', 'status');
  alertDiv.textContent = rt.citoquimInterpretacionBody_
    ? rt.citoquimInterpretacionBody_(text)
    : rt.ascitisInterpretacionBody_(text);
  box.appendChild(alertDiv);
}

function appendCultivoChunk(box, text, src, rt) {
  var wrap = document.createElement('div');
  wrap.className = 'lab-out-cultivo-chunk';
  wrap.innerHTML = rt.buildCultivoOutputHtmlFragments(text, src);
  box.appendChild(wrap);
}

function appendStandardResLabChunk(box, text) {
  renderEntry(text).forEach(function (html, idx) {
    var div = document.createElement('div');
    div.className = idx === 0 || isLabSectionHeaderHtml(html) ? 'out-line' : 'out-indent';
    div.innerHTML = html;
    box.appendChild(div);
  });
}

export function appendResLabChunksToBox(box, resLabs, src, result, labDisp, rt) {
  resLabs.forEach(function (text) {
    if (labDisp.hideGasoAdvInterp && rt.isGasoInterpretacionResLabChunk(text)) return;
    if (
      (rt.isCitoquimInterpretacionResLabChunk && rt.isCitoquimInterpretacionResLabChunk(text)) ||
      rt.isAscitisInterpretacionResLabChunk(text)
    ) {
      appendCitoquimInterpretacionChunk(box, text, rt);
      return;
    }
    if (rt.isResLabChunkPureCultivo(text)) {
      appendCultivoChunk(box, text, src, rt);
      return;
    }
    appendStandardResLabChunk(box, text);
    appendBhExtendedLines(box, text, result, labDisp, rt);
  });
}

export function syncLabOutputHistoryAfterRender(opts, result, rt) {
  if (opts && opts.fromHistory) return;
  var pid = rt.getActiveId();
  if (!pid) return;
  var preferId =
    (opts && opts.preferHistorySetId) ||
    findDisplayLabHistorySetId(pid, result) ||
    '';
  if (!preferId) {
    var hist = getActivePatientLabHistory();
    preferId = hist.length ? labSetIdForHistory(hist[0], 0) : '';
  }
  syncLabHistoryDateSelect({ preferSetId: preferId });
  if (preferId) setLabHistorySelectedSetId(pid, preferId);
}

export function prepareLabOutputBox(fechaBanner, rt) {
  var box = document.getElementById('lab-output-box');
  rt.removeAtbRisPanelsFromBody();
  box.innerHTML = '';
  if (fechaBanner) {
    var fechaTop = document.createElement('div');
    fechaTop.className = 'lab-output-fecha';
    fechaTop.textContent = fechaBanner;
    box.appendChild(fechaTop);
  }
  return box;
}
