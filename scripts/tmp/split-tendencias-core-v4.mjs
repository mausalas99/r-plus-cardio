#!/usr/bin/env node
/** Split tendencias-core.mjs → state / series / spark / ui + thin re-export core. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(ROOT, 'public/js/features');
const lines = fs.readFileSync(path.join(dir, 'tendencias-core.mjs'), 'utf8').split('\n');

const n = (pred) => lines.findIndex(pred);
const slice = (a, b) => lines.slice(a, b).join('\n');

const importEnd = n((l) => l.startsWith('function aid()'));
const IMPORT = lines.slice(0, importEnd).join('\n');

const stateBody = slice(importEnd, n((l) => l.startsWith('function buildTendRenderKey')));
const seriesBody = slice(
  n((l) => l.startsWith('var TEND_SECTION_EXPANDED_LS')),
  n((l) => l.startsWith('function trendSparkDomId'))
);
const sparkBody = [
  slice(n((l) => l.startsWith('function tendSeriesKeySelector')), n((l) => l.startsWith('var TEND_SECTION_EXPANDED_LS'))),
  slice(n((l) => l.startsWith('function trendSparkDomId')), n((l) => l.startsWith('function tendFinishRangeVbars'))),
  slice(n((l) => l.startsWith('function mountOneTrendSparkChart(')), n((l) => l.startsWith('function syncTendHiddenModalIfOpen'))),
].join('\n');
const uiBody = [
  slice(n((l) => l.startsWith('function tendFinishRangeVbars')), n((l) => l.startsWith('function mountOneTrendSparkChart('))),
  slice(n((l) => l.startsWith('function syncTendHiddenModalIfOpen')), n((l) => l.startsWith('export {'))),
].join('\n');

const bridgeReplace = (s) =>
  s
    .replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')
    .replace(/\bmountTendCardSortables\(\)/g, 'tendenciasBridge.mountTendCardSortables()');

const state = `${IMPORT}
${stateBody}
export { aid, esc, _tendCardSortables, sparkCharts, detailChart, _tendRenderState };
`;

const series = `${IMPORT}
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, sparkCharts } from './tendencias-state.mjs';
import { destroySparkChartEntry, buildSparkJobsFromIndex } from './tendencias-spark.mjs';

${bridgeReplace(seriesBody)}

export {
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
  trendSparkDomId,
  trendSparkChartKey,
};
`;

const spark = `${IMPORT}
import { scheduleIdle } from '../deferred-work.mjs';
import { TREND_SPARK_WINDOW } from '../lab-history-cache.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, sparkCharts } from './tendencias-state.mjs';
import {
  tendRefForSeries,
  tendCatalogSeriesKey,
  trendSparkDomId,
  trendSparkChartKey,
} from './tendencias-series.mjs';

${bridgeReplace(sparkBody)}

export {
  tendSeriesKeySelector,
  patchTendCardsFromIndex,
  destroySparkChartEntry,
  sparkLineColorForJob,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  mountOneTrendSparkChartAsync,
  buildSparkJobsFromIndex,
  mountOneTrendSparkChart,
};
`;

const ui = `${IMPORT}
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc, sparkCharts, detailChart, _tendCardSortables } from './tendencias-state.mjs';
import { destroySparkChartEntry } from './tendencias-spark.mjs';
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
  toTrendAscendingSets,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-series.mjs';

${bridgeReplace(uiBody)}

export {
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
  ensureTendenciasClickDelegation,
  tendCardActivate,
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
  downsampleTrendChartSeries,
  openTendDetail,
  openTendDetailAsync,
  closeTendDetail,
  isTendGroupModalOpen,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
};
`;

const core = `// Re-export aggregator for tendencias submodules (keeps render/barrel import * as tc stable).
export { aid, esc, _tendCardSortables, sparkCharts, detailChart, _tendRenderState } from './tendencias-state.mjs';
export {
  toTrendAscendingSets,
  tendSectionIsExpanded,
  toggleTendSection,
  tendCardLabelParts,
  tendRefForSeries,
  tendParsedHistoryDesc,
  tendCatalogSeriesKey,
  tendSeriesIsUserHidden,
  tendAbnormalOnlyRead,
  tendHiddenChipDescriptors,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  orderTrendSeriesBySaved,
  buildMergedTrendSeriesCatalog,
  getTendSectionLabel,
  tendEyeHideSvg,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openTendHiddenModal,
  closeTendHiddenModal,
  seedTendHiddenDefaults,
  trendSparkDomId,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-series.mjs';
export {
  patchTendCardsFromIndex,
  destroySparkChartEntry,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  buildSparkJobsFromIndex,
} from './tendencias-spark.mjs';
export {
  formatDMYDate,
  inferFechaLabSetFromId,
  tendSectionChartSvg,
  destroyTendCardSortables,
  ensureTendHiddenModalDelegation,
  ensureTendenciasClickDelegation,
  initTendGroupModal,
  openTendGroupModal,
  openTendGasoExtendedModal,
  closeTendGroupModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  tendCardActivate,
  syncTendHiddenModalIfOpen,
  openTendDetail,
  closeTendDetail,
  isTendGroupModalOpen,
} from './tendencias-ui.mjs';
`;

// render helpers (only used by tendencias-render.mjs)
const renderKeys = slice(
  n((l) => l.startsWith('function buildTendRenderKey')),
  n((l) => l.startsWith('function tendSeriesKeySelector'))
);

const renderPatch = fs.readFileSync(path.join(dir, 'tendencias-render.mjs'), 'utf8');
if (!renderPatch.includes('function buildTendRenderKey')) {
  const renderInsert = `${renderKeys}
import { TEND_SECTION_ORDER } from './tendencias-constants.mjs';
import { tendAbnormalOnlyRead, tendHiddenSeriesRead, tendSectionIsExpanded } from './tendencias-series.mjs';

`;
  fs.writeFileSync(
    path.join(dir, 'tendencias-render.mjs'),
    renderPatch.replace(
      "import * as tc from './tendencias-core.mjs';\n",
      "import * as tc from './tendencias-core.mjs';\n\n" + renderInsert
    )
  );
}

// bridge: mountTendCardSortables late-bound from ui
const bridgePath = path.join(dir, 'tendencias-bridge.mjs');
fs.writeFileSync(
  bridgePath,
  `/** Late-bound render/sortables to avoid module cycles. */
export const tendenciasBridge = {
  renderTendencias(_opts) {},
  mountTendCardSortables() {},
};
`
);

fs.writeFileSync(path.join(dir, 'tendencias-state.mjs'), state);
fs.writeFileSync(path.join(dir, 'tendencias-series.mjs'), series);
fs.writeFileSync(path.join(dir, 'tendencias-spark.mjs'), spark);
fs.writeFileSync(path.join(dir, 'tendencias-ui.mjs'), ui);
fs.writeFileSync(path.join(dir, 'tendencias-core.mjs'), core);

// Wire bridge in ui after write — patch tendencias.mjs barrel to assign mountTendCardSortables
const barrelPath = path.join(dir, 'tendencias.mjs');
let barrel = fs.readFileSync(barrelPath, 'utf8');
if (!barrel.includes('mountTendCardSortables')) {
  barrel = barrel.replace(
    'tendenciasBridge.renderTendencias = renderTendencias;\n',
    `import { mountTendCardSortables } from './tendencias-ui.mjs';\n\ntendenciasBridge.renderTendencias = renderTendencias;\ntendenciasBridge.mountTendCardSortables = mountTendCardSortables;\n`
  );
  fs.writeFileSync(barrelPath, barrel);
}

for (const f of ['tendencias-state.mjs', 'tendencias-series.mjs', 'tendencias-spark.mjs', 'tendencias-ui.mjs', 'tendencias-core.mjs']) {
  const c = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').length;
  console.log(f, c);
}
