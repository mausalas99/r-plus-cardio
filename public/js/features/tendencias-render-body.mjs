import {
  buildTrendSeriesIndexCached,
  getLabHistoryRevision,
  getTrendRenderWindow,
  TREND_SPARK_WINDOW,
} from '../lab-history-cache.mjs';
import { readTendCardOrder } from '../tend-prefs.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { TEND_SECTION_LABELS, TEND_SECTION_ORDER } from './tendencias-constants.mjs';
import { isAbgAnalysisHidden } from './tendencias-lab-prefs.mjs';
import { tendAbnormalOnlyRead, tendHiddenSeriesRead, tendSectionIsExpanded, tendRefForSeries } from './tendencias-series.mjs';
import * as tc from './tendencias-core.mjs';

function buildTendRenderKey(patientId, revision, prefsHash, sectionsExpanded) {
  return [patientId, revision, prefsHash, sectionsExpanded].join('::');
}

function tendPrefsHash() {
  return String(tendAbnormalOnlyRead()) + '|' + String(tendHiddenSeriesRead().join(','));
}

function tendExpandedSectionsKey() {
  return TEND_SECTION_ORDER.filter(function (sk) {
    return tendSectionIsExpanded(sk);
  }).join(',');
}

function resetTendRenderEmpty(container, message) {
  tc.tendStore._tendRenderState.key = null;
  tc.tendStore._tendRenderState.seriesKeys = [];
  tc.closeTendHiddenModal();
  container.innerHTML = '<p class="tend-empty">' + message + '</p>';
}

function collectSeriesAvailability(mergedCatalog, seriesIndex, abnormalOnly) {
  var seriesAvail = [];
  for (var ci = 0; ci < mergedCatalog.length; ci++) {
    var sp = mergedCatalog[ci];
    if (tc.tendSeriesIsUserHidden(sp.sectionKey, sp.fieldKey)) continue;
    var idxAvail = seriesIndex[tc.tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey)];
    if (!idxAvail || idxAvail.setsDesc.length < 2) continue;
    seriesAvail.push(sp);
  }
  var full = seriesAvail.slice();
  if (abnormalOnly) {
    seriesAvail = seriesAvail.filter(function (sp) {
      var idxAb = seriesIndex[tc.tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey)];
      return idxAb && idxAb.isAbnormal;
    });
  }
  return { seriesAvail: seriesAvail, seriesAvailFull: full };
}

function renderTendenciasEmptyState(container, toolbarHtml, mergedCatalog, seriesIndex, abnormalOnly, seriesAvailFull) {
  var anyData = mergedCatalog.some(function (sp) {
    var idxAny = seriesIndex[tc.tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey)];
    return idxAny && idxAny.setsDesc.length >= 2;
  });
  var hiddenAll =
    anyData &&
    !mergedCatalog.some(function (sp) {
      if (tc.tendSeriesIsUserHidden(sp.sectionKey, sp.fieldKey)) return false;
      var idxVis = seriesIndex[tc.tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey)];
      return idxVis && idxVis.setsDesc.length >= 2;
    });
  if (abnormalOnly && seriesAvailFull.length) {
    container.innerHTML =
      toolbarHtml +
      '<p class="tend-empty">Ningún analito está fuera de rango de referencia (o no tiene referencia en el reporte). Pulsa <strong>Ver todas</strong> (tooltip en el botón) para volver a la vista completa.</p>';
  } else if (hiddenAll) {
    container.innerHTML =
      toolbarHtml +
      '<p class="tend-empty">Los analitos con datos están <strong>ocultos</strong>. Pulsa <strong>Ocultos</strong> y restaura con el ojo o <strong>Mostrar todos</strong>.</p>';
  } else {
    container.innerHTML =
      toolbarHtml + '<p class="tend-empty">No hay parámetros con suficientes datos para graficar.</p>';
  }
  tc.syncTendHiddenModalIfOpen();
}

function orderTendSections(bySection) {
  var sectionsOrdered = [];
  for (var oi = 0; oi < TEND_SECTION_ORDER.length; oi++) {
    var sec = TEND_SECTION_ORDER[oi];
    if (bySection[sec] && bySection[sec].length) sectionsOrdered.push(sec);
  }
  Object.keys(bySection).forEach(function (sec) {
    if (sectionsOrdered.indexOf(sec) === -1) sectionsOrdered.push(sec);
  });
  return sectionsOrdered;
}

function buildTendPatchJobs(seriesAvail, seriesIndex) {
  var patchJobs = [];
  for (var pj = 0; pj < seriesAvail.length; pj += 1) {
    var spP = seriesAvail[pj];
    var skP = spP.sectionKey;
    var fkP = spP.fieldKey;
    if (!tc.tendSectionIsExpanded(skP)) continue;
    var idxP = seriesIndex[tc.tendCatalogSeriesKey(skP, fkP)];
    if (!idxP || !idxP.setsDesc.length) continue;
    var sparkDescP = idxP.setsDesc.slice(0, TREND_SPARK_WINDOW);
    var setsAscP = tc.toTrendAscendingSets(sparkDescP);
    patchJobs.push({
      sk2: skP,
      fk2: fkP,
      setsDesc2: sparkDescP,
      labels2: buildTendChartLabels(setsAscP),
      values2: setsAscP.map(function (s) {
        return getSetTrendValueForSeries(s, skP, fkP);
      }),
    });
  }
  return patchJobs;
}

function tryPatchTendenciasDom(container, seriesAvail, seriesIndex, historyDesc, renderKey, nextSeriesKeys) {
  var canPatch =
    tc.tendStore._tendRenderState.key === renderKey &&
    tc.tendStore._tendRenderState.seriesKeys.length === nextSeriesKeys.length &&
    tc.tendStore._tendRenderState.seriesKeys.every(function (k, i) {
      return k === nextSeriesKeys[i];
    }) &&
    container.querySelector('.tend-grid');
  if (!canPatch || !tc.patchTendCardsFromIndex(seriesIndex, seriesAvail)) return false;
  tc.updateSparkChartsFromJobs(buildTendPatchJobs(seriesAvail, seriesIndex), historyDesc);
  tc.syncTendHiddenModalIfOpen();
  return true;
}

function buildTendenciaCardHtml(sectionKey, spec, seriesIndex, expanded) {
  var specFk = spec.fieldKey;
  var idxCard = seriesIndex[tc.tendCatalogSeriesKey(sectionKey, specFk)];
  var latest = idxCard ? idxCard.latest : null;
  var isAb = idxCard ? idxCard.isAbnormal : false;
  var domId = tc.trendSparkDomId(sectionKey, specFk);
  var labelParts = tc.tendCardLabelParts(sectionKey, specFk);
  var unitHtml = labelParts.unit ? '<div class="tend-unit">' + tc.esc(labelParts.unit) + '</div>' : '';
  var seriesKey = tc.tendCatalogSeriesKey(sectionKey, specFk);
  return (
    '<div class="tend-card" role="button" tabindex="0" data-series-key="' +
    tc.esc(seriesKey) +
    '" data-abnormal="' +
    (isAb ? '1' : '0') +
    '">' +
    '<div class="tend-card-header">' +
    '<span class="tend-param-name">' +
    tc.esc(labelParts.title) +
    '</span>' +
    '<span class="tend-card-header-end">' +
    '<button type="button" class="tend-card-hide-btn" title="Ocultar analito" aria-label="Ocultar analito">' +
    tc.tendEyeHideSvg() +
    '</button>' +
    '<span class="tend-param-value' +
    (isAb ? ' tend-abnormal' : '') +
    '">' +
    (latest != null ? latest : '—') +
    '</span></span></div>' +
    unitHtml +
    '<div class="tend-spark-wrap"><div class="tend-spark-canvas-cell">' +
    (expanded
      ? '<canvas id="' + domId + '"></canvas>'
      : '<div class="tend-spark-placeholder" aria-hidden="true"></div>') +
    '</div></div></div>'
  );
}

function buildTendenciaSectionHtml(sectionKey, list, seriesIndex) {
  var expanded = tc.tendSectionIsExpanded(sectionKey);
  var secLabel = TEND_SECTION_LABELS[sectionKey] || sectionKey;
  var cardParts = list.map(function (spec) {
    return buildTendenciaCardHtml(sectionKey, spec, seriesIndex, expanded);
  });
  return (
    '<section class="tend-section" data-section="' +
    tc.esc(sectionKey) +
    '"><div class="tend-section-head">' +
    '<button type="button" class="tend-section-toggle" aria-expanded="' +
    (expanded ? 'true' : 'false') +
    '"><span class="tend-section-chevron" aria-hidden="true">' +
    (expanded ? '▼' : '▶') +
    '</span><span class="tend-section-title">' +
    tc.esc(secLabel) +
    '</span></button><span class="tend-section-toggle-end"><span class="tend-section-count">' +
    list.length +
    '</span>' +
    (list.length > 0
      ? '<button type="button" class="tend-section-chart-btn" title="Abrir gráfica y tabla del estudio" aria-label="Gráfica del estudio">' +
        tc.tendSectionChartSvg() +
        '<span class="tend-section-chart-label">Gráfica</span></button>'
      : '') +
    '</span></div><div class="tend-section-body' +
    (expanded ? '' : ' tend-section-body--collapsed') +
    '"><div class="tend-grid tend-sort-zone" data-section-key="' +
    tc.esc(sectionKey) +
    '">' +
    cardParts.join('') +
    '</div></div></section>'
  );
}

function paintTendenciasGrid(container, toolbarHtml, sectionsOrdered, bySection, seriesIndex, seriesAvail, historyDesc) {
  var htmlParts = [toolbarHtml];
  for (var si = 0; si < sectionsOrdered.length; si++) {
    var sectionKey = sectionsOrdered[si];
    var list = tc.orderTrendSeriesBySaved(bySection[sectionKey], readTendCardOrder(tc.aid(), sectionKey));
    htmlParts.push(buildTendenciaSectionHtml(sectionKey, list, seriesIndex));
  }
  container.innerHTML = htmlParts.join('');
  tc.buildSparkJobsFromIndex(seriesAvail, seriesIndex, historyDesc, tc.sparkChartAnim(600));
}

export function renderTendenciasBody(container) {
  tc.destroyTendCardSortables();
  Object.keys(tc.tendStore.sparkCharts).forEach(function (k) {
    tc.destroySparkChartEntry(k);
  });
  if (!tc.aid()) {
    resetTendRenderEmpty(container, 'Selecciona un paciente.');
    return;
  }
  var historyDesc = tc.tendParsedHistoryDesc(tc.aid());
  if (historyDesc.length < 2) {
    resetTendRenderEmpty(container, 'Agrega al menos 2 sets de laboratorio para ver tendencias.');
    return;
  }
  var historyAsc = historyDesc.slice().reverse();
  var catalogAsc = getTrendRenderWindow(historyAsc, 'catalog');
  var mergedCatalog = tc.buildMergedTrendSeriesCatalog(historyDesc);
  var indexCacheKey =
    String(tc.aid()) +
    '|' +
    getLabHistoryRevision(tc.aid()) +
    '|' +
    mergedCatalog.length +
    '|' +
    historyDesc.length;
  var seriesIndex = buildTrendSeriesIndexCached(indexCacheKey, {
    catalogSpecs: mergedCatalog,
    historyFullDesc: historyDesc,
    windowHistoryAsc: catalogAsc,
    tendRefForSeries: tendRefForSeries,
  });
  tc.tendStore._tendRenderState.seriesIndex = seriesIndex;
  var abnormalOnly = tc.tendAbnormalOnlyRead();
  var avail = collectSeriesAvailability(mergedCatalog, seriesIndex, abnormalOnly);
  tc.tendStore._tendRenderState.seriesAvail = avail.seriesAvail;
  var hiddenChipN = tc.tendHiddenChipDescriptors().length;
  var toolbarOpts = {
    showGasoExtended: !isAbgAnalysisHidden() && tc.historyHasGasoForExtended(historyDesc),
  };
  var toolbarHtml = tc.buildTendInlineControlsHtml(hiddenChipN, toolbarOpts);
  if (!avail.seriesAvail.length) {
    renderTendenciasEmptyState(
      container,
      toolbarHtml,
      mergedCatalog,
      seriesIndex,
      abnormalOnly,
      avail.seriesAvailFull
    );
    return;
  }
  var bySection = Object.create(null);
  avail.seriesAvail.forEach(function (spec) {
    var k = spec.sectionKey;
    if (!bySection[k]) bySection[k] = [];
    bySection[k].push(spec);
  });
  var sectionsOrdered = orderTendSections(bySection);
  var renderKey = buildTendRenderKey(
    tc.aid(),
    getLabHistoryRevision(tc.aid()),
    tendPrefsHash(),
    tendExpandedSectionsKey()
  );
  var nextSeriesKeys = avail.seriesAvail.map(function (sp) {
    return tc.tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey);
  });
  if (tryPatchTendenciasDom(container, avail.seriesAvail, seriesIndex, historyDesc, renderKey, nextSeriesKeys)) {
    return;
  }
  tc.tendStore._tendRenderState.key = renderKey;
  tc.tendStore._tendRenderState.seriesKeys = nextSeriesKeys;
  paintTendenciasGrid(container, toolbarHtml, sectionsOrdered, bySection, seriesIndex, avail.seriesAvail, historyDesc);
}
