// Cultivos table render, cache, refresh
import { sortLabHistoryChronological } from '../../tend-core.mjs';
import { getLabHistoryRevision, TREND_REFRESH_DEBOUNCE_MS } from '../../lab-history-cache.mjs';
import { scheduleIdle } from '../../deferred-work.mjs';
import { isPaseMode } from '../chrome.mjs';
import { rt, aid, esc } from './expediente-runtime.mjs';
import {
  parseCultureBlockFromLineArray,
  isCultureTableHeaderLine,
} from './expediente-cultivos-parse.mjs';
import {
  buildCultivoAntibiogramCellHtmlForPatient,
  wireAtbRisHoverPanels,
  removeAtbRisPanelsFromBody,
} from './expediente-cultivos-atb-ui.mjs';

var CULTIVO_TIPO_ORDER = ['hemo', 'uro', 'cateter', 'gram', 'fungi', 'otro'];
var CULTIVO_TIPO_LABELS = {
  hemo: 'Hemocultivo',
  uro: 'Urocultivo',
  cateter: 'Cultivo de catéter',
  gram: 'Tinción Gram',
  fungi: 'Fungicultivo',
  otro: 'Otros cultivos',
};
function cultivoOrganismoCellHtml(r) {
  var html = esc(r.organismo);
  if (r.cuenta && !r.negativo) {
    html += '<div class="cultivos-cuenta">' + esc(r.cuenta) + '</div>';
  }
  return html;
}

function cultivoAntibiogramCellHtml(r) {
  return buildCultivoAntibiogramCellHtmlForPatient(r, aid());
}
function extractCultivoTableRowsFromHistory(patientId) {
  var history = sortLabHistoryChronological(rt.ensureParsedLabHistory(patientId));
  var rows = [];
  var seq = 0;
  history.forEach(function (set) {
    if (!set || !set.resLabs || !set.resLabs.length) return;
    var cult = rt.splitResLabsByTipo(set.resLabs).cultivo;
    cult.forEach(function (chunk) {
      var sections = String(chunk || '')
        .split(/\n\n+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      sections.forEach(function (sec) {
        var lines = sec.split(/\r?\n/).map(function (l) {
          return l.replace(/\*+$/g, '').trim();
        }).filter(function (l) {
          return l;
        });
        if (!lines.length) return;
        if (!isCultureTableHeaderLine(lines[0])) return;
        rows.push(parseCultureBlockFromLineArray(lines, set, seq++).row);
      });
    });
  });
  return rows;
}

/** Agrupa por tipo de cultivo y ordena del más reciente al más antiguo. */
function groupCultivoRowsByTipoChronologic(rows) {
  var byKey = Object.create(null);
  rows.forEach(function (r) {
    var k = r.tipoKey || 'otro';
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(r);
  });
  CULTIVO_TIPO_ORDER.forEach(function (k) {
    if (!byKey[k]) return;
    byKey[k].sort(function (a, b) {
      var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
      var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
      if (da !== db) return db - da;
      return (b._seq || 0) - (a._seq || 0);
    });
  });
  return CULTIVO_TIPO_ORDER.filter(function (k) {
    return byKey[k] && byKey[k].length;
  }).map(function (k) {
    return {
      key: k,
      label: CULTIVO_TIPO_LABELS[k] || CULTIVO_TIPO_LABELS.otro,
      rows: byKey[k],
    };
  });
}

/** Modo Pase: positivos siempre; negativos solo si hay cambio de signo vs. otro resultado del mismo tipo+muestra (cronológico). */
function filterCultivoRowsSignificantFlip(rows) {
  function seriesKey(r) {
    return (
      (r.tipoKey || 'otro') +
      '\x01' +
      String(r.sitio || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  var bySeries = Object.create(null);
  rows.forEach(function (r) {
    var k = seriesKey(r);
    if (!bySeries[k]) bySeries[k] = [];
    bySeries[k].push(r);
  });
  var out = [];
  Object.keys(bySeries).forEach(function (k) {
    var arr = bySeries[k].slice().sort(function (a, b) {
      var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
      var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
      if (da !== db) return da - db;
      return (a._seq || 0) - (b._seq || 0);
    });
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      if (!r.negativo) {
        out.push(r);
        continue;
      }
      var prev = arr[i - 1];
      var next = arr[i + 1];
      if ((prev && !prev.negativo) || (next && !next.negativo)) out.push(r);
    }
  });
  return out;
}

var _cultivosTableCacheKey = '';
var CULTIVOS_CHUNK_ROWS = 40;

/** Fuerza re-render de Cultivos (p. ej. tras re-seed del tour pitch). */
export function invalidateCultivosTableCache() {
  _cultivosTableCacheKey = '';
}
var CULTIVOS_CHUNKED_THRESHOLD = 72;

function renderCultivosTableBodyChunked(container, shellHtml, rowChunks, onDone) {
  container.innerHTML = shellHtml;
  var tbody = container.querySelector(".cultivos-table tbody");
  if (!tbody || !rowChunks.length) {
    onDone();
    return;
  }
  var i = 0;
  function appendChunk() {
    var end = Math.min(i + CULTIVOS_CHUNK_ROWS, rowChunks.length);
    for (; i < end; i += 1) {
      tbody.insertAdjacentHTML("beforeend", rowChunks[i]);
    }
    if (i < rowChunks.length) {
      scheduleIdle(appendChunk, 12);
      return;
    }
    onDone();
  }
  scheduleIdle(appendChunk, 0);
}

function rowFechaDisplay(r) {
  if (r.fechaMuestra && r.fechaMuestra !== '—') return r.fechaMuestra;
  return r.studyDate || '—';
}

function buildCultivosNegStrip(negs) {
  if (!negs.length) return '';
  var parts = negs.map(function (r) {
    var fd = rowFechaDisplay(r);
    var lab = r.tipoLabel || '';
    return lab + ' · ' + fd + ' · ' + (r.sitio.length > 36 ? r.sitio.slice(0, 34) + '…' : r.sitio);
  });
  return (
    '<div class="cultivos-neg-strip" role="status"><strong>Cultivos negativos</strong> (en la tabla, por tipo y fecha) · ' +
    parts
      .map(function (p) {
        return '<span>' + esc(p) + '</span>';
      })
      .join(' <span class="cultivos-neg-sep">|</span> ') +
    '</div>'
  );
}

function collectCultivoTableRowChunks(groups, rowFechaDisplayFn) {
  var rowChunks = [];
  var totalRows = 0;
  groups.forEach(function (g) {
    rowChunks.push('<tr class="cultivos-section-row"><td colspan="4">' + esc(g.label) + '</td></tr>');
    g.rows.forEach(function (r) {
      totalRows += 1;
      rowChunks.push(
        '<tr class="' +
          (r.negativo ? 'cultivos-row-neg' : '') +
          '"><td>' +
          esc(rowFechaDisplayFn(r)) +
          '</td><td>' +
          esc(r.sitio) +
          '</td><td class="cultivos-cell-org">' +
          cultivoOrganismoCellHtml(r) +
          '</td><td class="cultivos-cell-atb">' +
          cultivoAntibiogramCellHtml(r) +
          '</td></tr>'
      );
    });
  });
  return { rowChunks: rowChunks, totalRows: totalRows };
}

function renderCultivosTable() {
  var container = document.getElementById('cultivos-table-container');
  if (!container) return;
  var pid = aid();
  if (pid) {
    var cultKey = String(pid) + '|L' + getLabHistoryRevision(pid);
    if (_cultivosTableCacheKey === cultKey && container.querySelector('.cultivos-table')) {
      return;
    }
    _cultivosTableCacheKey = cultKey;
  } else {
    _cultivosTableCacheKey = '';
  }
  removeAtbRisPanelsFromBody();
  if (!aid()) {
    container.innerHTML = '<p class="tend-empty">Selecciona un paciente.</p>';
    if (isPaseMode()) rt.renderPaseBoard();
    return;
  }
  var flatRows = extractCultivoTableRowsFromHistory(aid());
  if (!flatRows.length) {
    container.innerHTML =
      '<p class="tend-empty">No hay cultivos en el historial. Aparecen urocultivos, hemocultivos, tinción Gram y cultivos de catéter enviados desde Laboratorio.</p>';
    if (isPaseMode()) rt.renderPaseBoard();
    return;
  }
  var groups = groupCultivoRowsByTipoChronologic(flatRows);
  var negs = flatRows
    .filter(function (r) {
      return r.negativo;
    })
    .sort(function (a, b) {
      var oa = CULTIVO_TIPO_ORDER.indexOf(a.tipoKey || 'otro');
      var ob = CULTIVO_TIPO_ORDER.indexOf(b.tipoKey || 'otro');
      if (oa !== ob) return oa - ob;
      var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
      var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
      if (da !== db) return db - da;
      return (b._seq || 0) - (a._seq || 0);
    });
  var negStrip = buildCultivosNegStrip(negs);
  var thead =
    '<thead><tr><th>Fecha</th><th>Sitio / muestra</th><th>Organismo</th><th>Antibiograma</th></tr></thead>';
  var built = collectCultivoTableRowChunks(groups, rowFechaDisplay);
  var finishTable = function () {
    wireAtbRisHoverPanels(container);
    if (isPaseMode()) rt.renderPaseBoard();
  };
  if (built.totalRows > CULTIVOS_CHUNKED_THRESHOLD) {
    var shellHtml =
      negStrip +
      '<p class="cultivos-table-hint">Por categoría (tipo de estudio), orden cronológico de más reciente a más antiguo.</p>' +
      '<div class="cultivos-table-wrap"><table class="cultivos-table">' +
      thead +
      '<tbody></tbody></table></div>';
    renderCultivosTableBodyChunked(container, shellHtml, built.rowChunks, finishTable);
    return;
  }
  container.innerHTML =
    negStrip +
    '<p class="cultivos-table-hint">Por categoría (tipo de estudio), orden cronológico de más reciente a más antiguo.</p>' +
    '<div class="cultivos-table-wrap"><table class="cultivos-table">' +
    thead +
    '<tbody>' +
    built.rowChunks.join('') +
    '</tbody></table></div>';
  finishTable();
}

var _tendRefreshTimer = null;

function refreshTendenciasOrCultivosPanel() {
  if (rt.getActiveAppTab() !== 'nota') return;
  if (_tendRefreshTimer) clearTimeout(_tendRefreshTimer);
  _tendRefreshTimer = setTimeout(function () {
    _tendRefreshTimer = null;
    if (rt.getActiveInner() === 'tend') rt.renderTendencias();
    else if (rt.getActiveInner() === 'cult') renderCultivosTable();
  }, TREND_REFRESH_DEBOUNCE_MS);
}

export {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
};
