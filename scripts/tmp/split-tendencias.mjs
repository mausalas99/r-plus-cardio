#!/usr/bin/env node
/**
 * Split tendencias.mjs into modules (bridge breaks render ↔ catalog cycle).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'public/js/features/tendencias.mjs');
const lines = fs.readFileSync(SRC, 'utf8').split('\n');

const IMPORT_BLOCK = lines.slice(0, 49).join('\n');

const bridge = `/** Late-bound render to avoid catalog ↔ render cycle. */
export const tendenciasBridge = {
  renderTendencias(_opts) {},
  mountTendCardSortables() {},
  syncTendHiddenModalIfOpen() {},
};
`;

const stateBody = lines.slice(50, 132).join('\n');
const state = `import { tendenciasBridge } from './tendencias-bridge.mjs';

${stateBody.replace(/^var rt =/, 'export var rt =').replace(/^var _tendCardSortables/, 'export var _tendCardSortables').replace(/^var sparkCharts/, 'export var sparkCharts').replace(/^var detailChart/, 'export var detailChart').replace(/^var _tendRenderState/, 'export var _tendRenderState')}

export { aid, esc };
`;

const sparkBody = lines.slice(133, 227).join('\n');
const spark = `import { loadChartJs } from '../vendor-loader.mjs';
import { TREND_SPARK_WINDOW } from '../lab-history-cache.mjs';
import {
  getSetTrendValueForSeries,
  buildTendChartLabels,
} from '../tend-core.mjs';
import { aid, sparkCharts } from './tendencias-state.mjs';

${sparkBody}

export {
  buildTendRenderKey,
  tendPrefsHash,
  tendExpandedSectionsKey,
  tendSeriesKeySelector,
  patchTendCardsFromIndex,
  destroySparkChartEntry,
  sparkLineColorForJob,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  mountOneTrendSparkChartAsync,
};
`;

const LS_KEYS = lines.slice(287, 291).join('\n');

const catalogBody = lines.slice(291, 959).join('\n');
const catalog = `${IMPORT_BLOCK}
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, _tendRenderState } from './tendencias-state.mjs';
import { destroySparkChartEntry, sparkCharts } from './tendencias-spark.mjs';

${LS_KEYS}

${catalogBody.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}

export {
  getLabOutputPrefs,
  setLabOutputPrefs,
  isGasoInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  ascitisInterpretacionBody_,
  isBhMainResLabChunk,
  formatBhExtendedTabLine,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
  syncAbgLabPrefRowVisibility,
  toTrendAscendingSets,
  tendSectionExpandedRead,
  tendSectionExpandedWrite,
  tendSectionIsExpanded,
  destroySparkChartsForSection,
  mountSectionSparkCharts,
  applyTendSectionExpandedState,
  toggleTendSection,
  tendCardLabelParts,
  tendUnitForSeries,
  tendRefOrientative,
  tendRefFromLabSet,
  tendRefForSeries,
  tendParsedHistoryDesc,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  tendHiddenSeriesRead,
  tendHiddenSeriesWrite,
  tendSeriesIsUserHidden,
  tendSeriesSetUserHidden,
  seedTendHiddenDefaults,
  tendFindSeriesSpec,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendEyeVisibilitySvg,
  tendEyeHideSvg,
  tendAbnormalOnlyRead,
  tendAbnormalOnlyWrite,
  tendSeriesLatestAbnormal,
  tendHiddenChipDescriptors,
  buildTendHiddenChipsHtml,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  closeTendHiddenModal,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
};
`;

const domBody = lines.slice(959, 1616).join('\n');
const dom = `${IMPORT_BLOCK}
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, _tendCardSortables } from './tendencias-state.mjs';
import { sparkCharts, destroySparkChartEntry } from './tendencias-spark.mjs';
import {
  tendParsedHistoryDesc,
  tendCardLabelParts,
  tendRefForSeries,
  tendFindSeriesSpec,
  tendSectionIsExpanded,
  closeTendHiddenModal,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
  buildTendInlineControlsHtml,
  getTendSectionLabel,
  buildMergedTrendSeriesCatalog,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  tendSeriesIsUserHidden,
  tendAbnormalOnlyRead,
  tendHiddenChipDescriptors,
  historyHasGasoForExtended,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-catalog.mjs';

${domBody.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}

export {
  trendSparkDomId,
  trendSparkChartKey,
  formatDMYDate,
  inferFechaLabSetFromId,
  inferAnteriorLabDateFromNote,
  tendFinishRangeVbars,
  tendRefVbarMarkup,
  tendDetailChartOptions,
  updateTendDetailChartInPlace,
  tendDetailChartYBounds,
  syncTendDetailVbar,
  closeTendGroupModal,
  initTendGroupModal,
  openTendGroupModal,
  openTendGasoExtendedModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  tendSectionChartSvg,
  destroyTendCardSortables,
  syncTendCardOrderFromDom,
  ensureTendHiddenModalDelegation,
  onTendHiddenBackdropClick,
  onTendHiddenModalPanelClick,
  ensureTendenciasClickDelegation,
  onTendenciasContainerClick,
  tendCardActivate,
  mountTendCardPointerSort,
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
  isTendGroupModalOpen,
};
`;

const renderBody = lines.slice(1617, 2077).join('\n');
const render = `${IMPORT_BLOCK}
import { scheduleAfterPaint } from '../deferred-work.mjs';
import { buildTextSkeletonPanel } from '../ui-skeleton.mjs';
import {
  buildTrendSeriesIndexCached,
  getLabHistoryRevision,
  getTrendRenderWindow,
  TREND_DETAIL_DOWNSAMPLE,
  TREND_SPARK_WINDOW,
  trendCatalogSeriesKey,
} from '../lab-history-cache.mjs';
import { readTendCardOrder } from '../tend-prefs.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { cancelOverlayClose } from '../ui-motion.mjs';
import {
  getSetTrendValueForSeries,
  buildTendChartLabels,
  dedupeTrendSetsForSeries,
} from '../tend-core.mjs';
import { TEND_SECTION_LABELS, TEND_SECTION_ORDER } from './tendencias-constants.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, sparkCharts, detailChart, _tendRenderState } from './tendencias-state.mjs';
import {
  buildTendRenderKey,
  tendPrefsHash,
  tendExpandedSectionsKey,
  patchTendCardsFromIndex,
  destroySparkChartEntry,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  mountOneTrendSparkChartAsync,
} from './tendencias-spark.mjs';
import {
  syncAbgLabPrefRowVisibility,
  toTrendAscendingSets,
  tendSectionIsExpanded,
  tendSeriesIsUserHidden,
  tendAbnormalOnlyRead,
  tendHiddenChipDescriptors,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  isAbgAnalysisHidden,
  buildMergedTrendSeriesCatalog,
  tendRefForSeries,
  tendCardLabelParts,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  closeTendHiddenModal,
} from './tendencias-catalog.mjs';
import {
  trendSparkDomId,
  tendSectionChartSvg,
  tendEyeHideSvg,
  destroyTendCardSortables,
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
  tendDetailChartOptions,
  updateTendDetailChartInPlace,
  tendDetailChartYBounds,
  syncTendDetailVbar,
  tendRefVbarMarkup,
  tendFinishRangeVbars,
  formatDMYDate,
} from './tendencias-dom.mjs';

function isAbgAnalysisHidden() {
  return true;
}

${lines.slice(228, 286).join('\n').replace(/\bmountTendCardSortables\(\)/g, 'tendenciasBridge.mountTendCardSortables()').replace(/\bsyncTendHiddenModalIfOpen\(\)/g, 'tendenciasBridge.syncTendHiddenModalIfOpen()')}

${renderBody}

export {
  renderTendencias,
  buildSparkJobsFromIndex,
  downsampleTrendChartSeries,
  mountOneTrendSparkChart,
  openTendDetail,
  openTendDetailAsync,
  closeTendDetail,
};
`;

const main = `// Tendencias — barrel: runtime registration + window handlers
import { patients } from '../app-state.mjs';
import { TEND_UNITS } from './tendencias-constants.mjs';
import { registerSesionIngresoTrendsRuntime } from '../sesion-ingreso-trends-export.mjs';
import {
  closeSesionIngresoTrendsSendModal,
  openSesionIngresoTrendsSendModal,
  registerSesionIngresoTrendsSendRuntime,
} from './sesion-ingreso-trends-send-modal.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { rt, aid } from './tendencias-state.mjs';
import {
  buildMergedTrendSeriesCatalog,
  getTendSectionLabel,
  tendRefForSeries,
  tendParsedHistoryDesc,
  getLabOutputPrefs,
  setLabOutputPrefs,
  isGasoInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  ascitisInterpretacionBody_,
  isBhMainResLabChunk,
  formatBhExtendedTabLine,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
  seedTendHiddenDefaults,
  closeTendHiddenModal,
  openTendHiddenModal,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
} from './tendencias-catalog.mjs';
import {
  inferFechaLabSetFromId,
  formatDMYDate,
  closeTendGroupModal,
  openTendGroupModal,
  openTendGasoExtendedModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  tendCardActivate,
  initTendGroupModal,
  ensureTendHiddenModalDelegation,
  ensureTendenciasClickDelegation,
} from './tendencias-dom.mjs';
import { closeTendDetail, openTendDetail } from './tendencias-render.mjs';
import {
  renderTendencias,
} from './tendencias-render.mjs';
import {
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
  isTendGroupModalOpen as isTendGroupModalOpenImpl,
} from './tendencias-dom.mjs';

function isAbgAnalysisHidden() {
  return true;
}

tendenciasBridge.renderTendencias = renderTendencias;
tendenciasBridge.mountTendCardSortables = mountTendCardSortables;
tendenciasBridge.syncTendHiddenModalIfOpen = syncTendHiddenModalIfOpen;

export function registerTendenciasRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
  initTendGroupModal();
  ensureTendHiddenModalDelegation();
  ensureTendenciasClickDelegation();
  registerSesionIngresoTrendsRuntime({
    buildCatalog: buildMergedTrendSeriesCatalog,
    sectionLabel: getTendSectionLabel,
    refForSeries: function (history, sectionKey, fieldKey) {
      return tendRefForSeries(history, sectionKey, fieldKey, null);
    },
    unitForField: function (fieldKey) {
      return TEND_UNITS[fieldKey] || '';
    },
  });
  registerSesionIngresoTrendsSendRuntime({
    showToast: function (msg, kind) {
      rt.showToast(msg, kind);
    },
    getHistory: function () {
      var pid = aid();
      return pid ? tendParsedHistoryDesc(pid) : [];
    },
    getPatientLabel: function () {
      var pid = aid();
      var patient = (patients || []).find(function (p) {
        return p.id === pid;
      });
      return patient ? patient.nombre || patient.registro || '' : '';
    },
    getPatientId: function () {
      return aid() || '';
    },
    sendPayload: function (payload) {
      if (window.electronAPI && window.electronAPI.sendToSesionIngreso) {
        window.electronAPI.sendToSesionIngreso(payload).then(function (ok) {
          if (ok) rt.showToast('Tendencias enviadas a Neo', 'ok');
          else rt.showToast('No se pudo abrir Neo', 'warn');
        });
        return;
      }
      rt.showToast('Integración disponible solo en la app de escritorio', 'warn');
    },
  });
}

export function isTendGroupModalOpen() {
  return isTendGroupModalOpenImpl();
}

export {
  getLabOutputPrefs,
  setLabOutputPrefs,
  isGasoInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  ascitisInterpretacionBody_,
  isBhMainResLabChunk,
  formatBhExtendedTabLine,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
  inferFechaLabSetFromId,
  formatDMYDate,
  seedTendHiddenDefaults,
  renderTendencias,
};

export const tendenciasWindowHandlers = {
  openSesionIngresoTrendsSendModal,
  closeSesionIngresoTrendsSendModal,
  closeTendDetail,
  openTendGroupModal,
  openTendGasoExtendedModal,
  closeTendGroupModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openTendHiddenModal,
  closeTendHiddenModal,
  openTendDetail,
  tendCardActivate,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
};
`;

const dir = path.join(ROOT, 'public/js/features');
fs.writeFileSync(path.join(dir, 'tendencias-bridge.mjs'), bridge);
fs.writeFileSync(path.join(dir, 'tendencias-state.mjs'), state);
fs.writeFileSync(path.join(dir, 'tendencias-spark.mjs'), spark);
fs.writeFileSync(path.join(dir, 'tendencias-catalog.mjs'), catalog);
fs.writeFileSync(path.join(dir, 'tendencias-dom.mjs'), dom);
fs.writeFileSync(path.join(dir, 'tendencias-render.mjs'), render);
fs.writeFileSync(SRC, main);

console.log('split tendencias -> bridge, state, spark, catalog, dom, render, main');
