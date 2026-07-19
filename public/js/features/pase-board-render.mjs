/**
 * Vista Pase board DOM render (resumen del paciente).
 */
import { renderEntry, isLabSectionHeaderHtml } from '../labs.js';
import { storage } from '../storage.js';
import { sortLabHistoryChronological } from '../tend-core.mjs';
import { dosisBeforeSlash, effectiveDiaTratamiento } from '../med-receta-core.mjs';
import { patients, medRecetaByPatient } from '../app-state.mjs';
import { isPaseMode } from './chrome.mjs';
import {
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
  paseCultivoAtbBlockHtml,
  removeAtbRisPanelsFromBody,
  wireAtbRisHoverPanels,
} from './expediente.mjs';
import { todoCompareForSort, toggleTodo } from './todos.mjs';
import { rt } from './pase-board-runtime.mjs';
import { buildPaseBoardCacheKey, getPaseBoardCacheKey, setPaseBoardCacheKey } from './pase-board-cache-keys.mjs';

/** Misma fila que Laboratorio (colores BH/QS, valores alterados). */
function buildPaseLabBlockHtml(labChunks) {
  if (!labChunks || !labChunks.length) return "";
  var parts = [];
  labChunks.forEach(function (text) {
    renderEntry(text).forEach(function (htmlLine, idx) {
      var isSechead = idx === 0 || isLabSectionHeaderHtml(htmlLine);
      parts.push(
        '<div class="pase-lab-line' + (isSechead ? " pase-lab-line--sechead" : "") + '">' + htmlLine + "</div>"
      );
    });
  });
  return '<div class="pase-lab-block" role="text">' + parts.join("") + "</div>";
}

/** Limpia línea de dosis para tarjeta Pase: solo lo aplicable (antes de //), sin *DIA#*, sin calendario colado. */

import { esc } from '../dom-escape.mjs';
function cleanPaseMedDosisForCard(dosisRaw) {
  var s = String(dosisBeforeSlash(dosisRaw) || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  var día =
    /\b(?:LOS\s+)?(?:LUNES|MARTES|MIERCOLES|MIÉRCOLES|JUEVES|VIERNES|SABADO|SÁBADO|DOMINGO)\b/i;
  var m = s.match(día);
  if (m && m.index != null && m.index > 0) {
    s = s
      .slice(0, m.index)
      .replace(/\s*(?:,\s*|\bY\b|\bO\b)\s*$/gi, "")
      .replace(/[,\s]+$/g, "")
      .trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Abrevia cantidades muy grandes en UI/IU para la pastilla Pase (p. ej. 2400000 → 2.4M).
 * Solo valores enteros sencillos tras // para evitar ambigüedad con miles con separadores.
 */
function abbreviatePaseMedDosisCore(core) {
  var t = String(core || "").trim();
  if (!t) return t;
  var m = t.match(/^(\d+)\s*(UI|IU)\s*$/i);
  if (!m) return t;
  var n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1e6) return t;
  var mil = n / 1e6;
  var label = mil % 1 === 0 ? String(mil) : String(Math.round(mil * 10) / 10).replace(".", ",");
  return label + "M " + m[2].toUpperCase();
}

/**
 * Separa número+unidad (núcleo sin partir) del resto del texto de dosis para chips Pase.
 */
function splitPaseMedDosisForDisplay(dosisClean) {
  var s = String(dosisClean || "").trim();
  if (!s) return { core: "", extra: "", splitOk: false };
  var unit =
    "(?:UI\\/ML|IU\\/ML|MCG\\/ML|MG\\/ML|" +
    "\\b(?:UI|IU|MCG|UG|MG|NG|ML|UL)\\b)";
  var re = new RegExp(
    "^((?:\\d+(?:[,\\.]\\d+)?(?:\\s*/\\s*\\d+(?:[,\\.]\\d+)?)?\\s*(?:" +
      unit +
      "))|(?:\\d+(?:[,\\.]\\d+)?\\s*%))(?:\\s+([\\s\\S]*))?$",
    "i"
  );
  var m = s.match(re);
  if (!m || !String(m[1] || "").trim()) return { core: s, extra: "", splitOk: false };
  return {
    core: String(m[1]).trim(),
    extra: String(m[2] || "").trim(),
    splitOk: true,
  };
}

/** Vía resumida para tarjetas Pase. */
function abbreviatePaseMedVia(viaRaw) {
  var u = String(viaRaw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!u.trim()) return "";
  if (/\bINTRAPERITONEAL\b/.test(u)) return "IP";
  if (/\bINTRAMUSCULAR\b/.test(u)) return "IM";
  if (/\bINTRAVENOSA\b/.test(u)) return "IV";
  if (/\bORAL\b/.test(u)) return "VO";
  var fallback = String(viaRaw || "").trim();
  return fallback.length > 28 ? fallback.slice(0, 26) + "…" : fallback;
}

/** Título corto Pase: principio activo (antes de la dosis numérica); sin (*…). */
function paseMedPrincipioActivoTitle(nombreRaw) {
  var s = String(nombreRaw || "").trim();
  if (!s) return "";
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  var chunk = s.split(/\s+(?=\d)/)[0] || "";
  chunk = chunk.trim();
  return chunk.slice(0, 120) || s.slice(0, 120);
}

function findPaseLatestLabSend(patientId) {
  if (!patientId) return null;
  var hist = sortLabHistoryChronological(rt.ensureParsedLabHistory(patientId));
  for (var i = 0; i < hist.length; i++) {
    var set = hist[i];
    var tipo = rt.primaryTipoForLabSet(set.resLabs);
    if (tipo === "cultivo") continue;
    var sp = rt.splitResLabsByTipo(set.resLabs || []);
    var labChunks = sp.labs.filter(function (x) {
      return String(x || "").trim();
    });
    if (!labChunks.length) continue;
    var meta = rt.formatLabHistoryListMeta(set);
    return { meta: meta, labChunks: labChunks };
  }
  return null;
}

function getPaseAgendaForPatient(patientId) {
  var cutoff = Date.now() - 3600000;
  return storage
    .getScheduledProcedures()
    .filter(function (ev) {
      return String(ev.patientId) === String(patientId);
    })
    .filter(function (ev) {
      var t = Date.parse(ev.start);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort(function (a, b) {
      return Date.parse(a.start) - Date.parse(b.start);
    })
    .slice(0, 12);
}

function buildPasePatientHeaderHtml(patient) {
  if (!patient) return "";
  var chips = [];
  if (patient.cuarto) chips.push({ label: "Cto.", value: String(patient.cuarto) });
  if (patient.cama) chips.push({ label: "Cama", value: String(patient.cama) });
  if (patient.servicio) chips.push({ label: "Servicio", value: String(patient.servicio) });
  if (patient.registro) chips.push({ label: "Reg.", value: String(patient.registro), mono: true });
  var chipsHtml = chips
    .map(function (c) {
      return (
        '<span class="pase-patient-chip' +
        (c.mono ? " pase-patient-chip--mono" : "") +
        '"><span class="pase-patient-chip-label">' +
        esc(c.label) +
        "</span> " +
        esc(c.value) +
        "</span>"
      );
    })
    .join("");
  return (
    '<section class="pase-section pase-patient-banner" aria-label="Paciente activo">' +
    '<div class="pase-patient-banner-body">' +
    '<div class="pase-patient-name">' +
    esc(patient.nombre || "Paciente") +
    "</div>" +
    (chipsHtml ? '<div class="pase-patient-meta-row">' + chipsHtml + "</div>" : "") +
    "</div>" +
    "</section>"
  );
}

function ensurePaseBoardTodoDelegate(host) {
  if (host._paseDelegate) return;
  host._paseDelegate = true;
  host.addEventListener('click', function (e) {
    var todoBtn = e.target.closest('[data-pase-todo]');
    if (todoBtn && todoBtn.getAttribute('data-pase-todo')) {
      e.preventDefault();
      toggleTodo(todoBtn.getAttribute('data-pase-todo'));
    }
  });
}

function shouldSkipPaseBoardRender(host, aid) {
  if (!aid) {
    setPaseBoardCacheKey('');
    return false;
  }
  var cacheKey = buildPaseBoardCacheKey(aid);
  if (getPaseBoardCacheKey() === cacheKey && host.querySelector('.pase-patient-header')) {
    return true;
  }
  setPaseBoardCacheKey(cacheKey);
  return false;
}

function buildPaseTodoCardsHtml(todos) {
  if (!todos.length) {
    return '<div class="pase-mini-card pase-mini-card--dim">Sin pendientes.</div>';
  }
  return todos
    .map(function (t) {
      var prio = t.priority === 'alta' ? 'alta' : t.priority === 'baja' ? 'baja' : 'media';
      return (
        '<div class="pase-mini-card pase-todo-card todo-prio-' +
        prio +
        (t.completed ? ' pase-mini-card--todo-done' : '') +
        '">' +
        '<button type="button" class="pase-todo-hit" data-pase-todo="' +
        esc(String(t.id)) +
        '" aria-label="' +
        (t.completed ? 'Marcar como pendiente' : 'Marcar como hecho') +
        '">' +
        (t.completed ? '✓' : '○') +
        '</button><span>' +
        esc(String(t.text || '')) +
        '</span></div>'
      );
    })
    .join('');
}

function buildPaseAgendaCardsHtml(ag) {
  if (!ag.length) {
    return '<div class="pase-mini-card pase-mini-card--dim">Sin procedimientos próximos.</div>';
  }
  return ag
    .map(function (ev) {
      var when = new Date(ev.start);
      var whenStr = isNaN(when.getTime())
        ? '—'
        : when.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      return (
        '<div class="pase-mini-card"><strong>' +
        esc(String(ev.procedure || 'Procedimiento')) +
        '</strong><span class="pase-sub">' +
        esc(whenStr + ' · ' + String(ev.location || '').trim()) +
        '</span></div>'
      );
    })
    .join('');
}

function buildPaseTodosAgendaRowHtml(pid) {
  var todos = storage.getTodos(pid).slice().sort(todoCompareForSort);
  var ag = getPaseAgendaForPatient(pid);
  return (
    '<div class="pase-section-row pase-section-row--split">' +
    '<section class="pase-section" aria-label="Pendientes">' +
    '<div class="pase-section-head">' +
    '<button type="button" class="pase-section-title" onclick="openPaseSectionInNormal(\'pendientes\')">Pendientes</button>' +
    '</div><div class="pase-dual-col-grid">' +
    buildPaseTodoCardsHtml(todos) +
    '</div></section>' +
    '<section class="pase-section" aria-label="Agenda">' +
    '<div class="pase-section-head">' +
    '<button type="button" class="pase-section-title" onclick="openPaseSectionInNormal(\'agenda\')">Agenda</button>' +
    '</div><div class="pase-dual-col-grid">' +
    buildPaseAgendaCardsHtml(ag) +
    '</div></section></div>'
  );
}

function buildPaseLabSectionHtml(pid) {
  var labSend = findPaseLatestLabSend(pid);
  var body = !labSend
    ? '<div class="pase-mini-card pase-mini-card--dim">Sin envíos de laboratorio convencional en el historial.</div>'
    : '<div class="pase-mini-card pase-mini-card--wide pase-mini-card--lab"><div class="pase-lab-meta">' +
      esc(labSend.meta) +
      '</div>' +
      buildPaseLabBlockHtml(labSend.labChunks) +
      '</div>';
  return (
    '<section class="pase-section" aria-label="Laboratorio">' +
    '<div class="pase-section-head">' +
    '<button type="button" class="pase-section-title" onclick="openPaseSectionInNormal(\'labs\')" aria-label="Laboratorio">Labs</button>' +
    '</div><div class="pase-card-grid">' +
    body +
    '</div></section>'
  );
}

function sortPaseCultivoRows(flatRows) {
  var displayRows = filterCultivoRowsSignificantFlip(flatRows);
  return displayRows.slice().sort(function (a, b) {
    var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
    var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
    if (db !== da) return db - da;
    return (b._seq || 0) - (a._seq || 0);
  });
}

function buildPaseCultivoCardHtml(pid, r) {
  var fd = r.fechaMuestra && r.fechaMuestra !== '—' ? r.fechaMuestra : r.studyDate || '—';
  return (
    '<div class="pase-mini-card pase-cultivo-card' +
    (r.negativo ? ' pase-mini-card--dim' : '') +
    '"><div class="pase-cult-org">' +
    esc(String(r.organismo || '—')) +
    (r.cuenta ? '<div class="pase-cult-cuenta">' + esc(String(r.cuenta)) + '</div>' : '') +
    '</div>' +
    paseCultivoAtbBlockHtml(pid, r) +
    '<div class="pase-sub">' +
    esc(String(r.tipoLabel || '') + ' · ' + String(r.sitio || '').slice(0, 72)) +
    '<br>' +
    esc(fd) +
    '</div></div>'
  );
}

function buildPaseCultivosSectionHtml(pid) {
  var displayRows = sortPaseCultivoRows(extractCultivoTableRowsFromHistory(pid));
  var body = !displayRows.length
    ? '<div class="pase-mini-card pase-mini-card--dim">Sin cultivos relevantes para la ronda (positivos o negativos con cambio de signo en la misma muestra).</div>'
    : displayRows
        .slice(0, 10)
        .map(function (r) {
          return buildPaseCultivoCardHtml(pid, r);
        })
        .join('');
  return (
    '<section class="pase-section" aria-label="Cultivos">' +
    '<div class="pase-section-head">' +
    '<button type="button" class="pase-section-title" onclick="openPaseSectionInNormal(\'cultivos\')">Cultivos</button>' +
    '</div><div class="pase-card-grid">' +
    body +
    '</div></section>'
  );
}

function buildPaseMedMetaRowHtml(dosisSplit, viaAbbr, freq) {
  var metaParts = [];
  if (dosisSplit.core || dosisSplit.extra) {
    if (dosisSplit.splitOk) {
      metaParts.push(
        '<span class="pase-med-chip pase-med-chip--dosis">' +
          (dosisSplit.core
            ? '<span class="pase-med-dosis-core">' + esc(abbreviatePaseMedDosisCore(dosisSplit.core)) + '</span>'
            : '') +
          (dosisSplit.extra ? '<span class="pase-med-dosis-rest">' + esc(dosisSplit.extra) + '</span>' : '') +
          '</span>'
      );
    } else {
      metaParts.push('<span class="pase-med-chip">' + esc(dosisSplit.core) + '</span>');
    }
  }
  if (viaAbbr) metaParts.push('<span class="pase-med-chip">' + esc(viaAbbr) + '</span>');
  if (freq) metaParts.push('<span class="pase-med-chip">' + esc(freq) + '</span>');
  return metaParts.length ? '<div class="pase-med-meta-row">' + metaParts.join('') + '</div>' : '';
}

function buildPaseMedCardHtml(it, block) {
  var nombre = paseMedPrincipioActivoTitle(it.nombreRaw || '');
  var viaAbbr = abbreviatePaseMedVia(it.viaRaw || '');
  var freq = String(it.frecuenciaRaw || '').trim();
  var dosis = cleanPaseMedDosisForCard(it.dosisRaw || '');
  var dosisSplit = dosis ? splitPaseMedDosisForDisplay(dosis) : { core: '', extra: '', splitOk: false };
  var diaDisplay =
    it.diaTratamiento != null
      ? effectiveDiaTratamiento(it.diaTratamiento, block && block.fechaActualizacion)
      : null;
  var diaBadge =
    diaDisplay != null
      ? '<div class="pase-med-dia-badge" title="Día de tratamiento">Día ' + esc(String(diaDisplay)) + '</div>'
      : '';
  return (
    '<div class="pase-mini-card pase-med-card"><div class="pase-med-card-head">' +
    '<div class="pase-med-name">' +
    esc(nombre) +
    '</div>' +
    diaBadge +
    '</div>' +
    buildPaseMedMetaRowHtml(dosisSplit, viaAbbr, freq) +
    '</div>'
  );
}

function buildPaseMedSectionHtml(pid) {
  var block = medRecetaByPatient[pid];
  var medItems =
    block && block.items ? block.items.filter(function (it) { return !it.suspendido; }) : [];
  var body = !medItems.length
    ? '<div class="pase-mini-card pase-mini-card--dim">Sin medicamentos activos en la receta (o todos excluidos).</div>'
    : medItems.map(function (it) { return buildPaseMedCardHtml(it, block); }).join('');
  return (
    '<section class="pase-section" aria-label="Manejo">' +
    '<div class="pase-section-head">' +
    '<button type="button" class="pase-section-title" onclick="openPaseSectionInNormal(\'med\')">Manejo</button>' +
    '</div><div class="pase-card-grid">' +
    body +
    '</div></section>'
  );
}

function buildPaseBoardBodyHtml(pid, patient) {
  return (
    buildPasePatientHeaderHtml(patient) +
    buildPaseTodosAgendaRowHtml(pid) +
    buildPaseLabSectionHtml(pid) +
    buildPaseCultivosSectionHtml(pid) +
    buildPaseMedSectionHtml(pid)
  );
}

export function renderPaseBoard() {
  var host = document.getElementById('pase-board-scroll');
  if (!host || !isPaseMode()) return;
  var aid = rt.getActiveId();
  if (shouldSkipPaseBoardRender(host, aid)) return;
  removeAtbRisPanelsFromBody();
  ensurePaseBoardTodoDelegate(host);
  if (!aid) {
    host.innerHTML =
      '<div class="pase-empty-screen" role="status">Selecciona un paciente en la lista para ver el resumen.</div>';
    return;
  }
  var patient = patients.find(function (x) {
    return String(x.id) === String(aid);
  });
  host.innerHTML = buildPaseBoardBodyHtml(aid, patient);
  wireAtbRisHoverPanels(host);
}
