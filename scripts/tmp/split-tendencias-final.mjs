#!/usr/bin/env node
/** Split tendencias-series + tendencias-ui into submodules <600 lines. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/js/features');
const seriesLines = fs.readFileSync(path.join(dir, 'tendencias-series.mjs'), 'utf8').split('\n');
const uiLines = fs.readFileSync(path.join(dir, 'tendencias-ui.mjs'), 'utf8').split('\n');

const n = (lines, pred) => lines.findIndex(pred);
const slice = (lines, start, end) => lines.slice(start, end).join('\n');

// --- series → catalog / sections / hidden ---
const catStart = n(seriesLines, (l) => l.startsWith('function toTrendAscendingSets'));
const secStart = n(seriesLines, (l) => l.startsWith('function tendSectionExpandedRead'));
const hidStart = n(seriesLines, (l) => l.startsWith('function tendHiddenSeriesRead'));
const cardStart = n(seriesLines, (l) => l.startsWith('function tendCardLabelParts'));
const abnStart = n(seriesLines, (l) => l.startsWith('function tendAbnormalOnlyRead'));
const expStart = n(seriesLines, (l) => n(seriesLines, (x) => x === 'export {'));

const CATALOG_IMPORTS = `import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  sortLabHistoryChronological,
  tendEligibleSectionKey,
} from '../tend-core.mjs';
import { trendCatalogSeriesKey } from '../lab-history-cache.mjs';
import { bhTrendDisplayTitle, sortTrendSpecsBySomeOrder } from '../labs.js';
import {
  TEND_UNITS,
  TEND_REF,
  TEND_REF_GASES,
  TEND_SERIES_CATALOG,
} from './tendencias-constants.mjs';
import { rt } from './tendencias-runtime-state.mjs';
`;

const catalogBody = [
  slice(seriesLines, catStart, secStart),
  slice(seriesLines, cardStart, hidStart),
  slice(seriesLines, n(seriesLines, (l) => l.startsWith('function tendFindSeriesSpec')), abnStart),
].join('\n');

const catalog = `${CATALOG_IMPORTS}
${catalogBody}
export {
  toTrendAscendingSets,
  tendCardLabelParts,
  tendUnitForSeries,
  tendRefOrientative,
  tendRefFromLabSet,
  tendRefForSeries,
  tendParsedHistoryDesc,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  tendFindSeriesSpec,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendEyeVisibilitySvg,
  tendEyeHideSvg,
};
`;

const SECTIONS_IMPORTS = `import { TREND_SPARK_WINDOW } from '../lab-history-cache.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, tendStore, trendSparkDomId } from './tendencias-state.mjs';
import { destroySparkChartEntry, buildSparkJobsFromIndex, sparkChartAnim } from './tendencias-spark.mjs';
import { tendCatalogSeriesKey } from './tendencias-catalog.mjs';
`;

const sectionsBody = [
  slice(seriesLines, n(seriesLines, (l) => l.startsWith('var TEND_SECTION_EXPANDED_LS')), catStart),
  slice(seriesLines, secStart, cardStart),
].join('\n');

const sections = `${SECTIONS_IMPORTS}
${sectionsBody.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}
export {
  tendSectionExpandedRead,
  tendSectionExpandedWrite,
  tendSectionIsExpanded,
  destroySparkChartsForSection,
  mountSectionSparkCharts,
  applyTendSectionExpandedState,
  toggleTendSection,
};
`;

const HIDDEN_IMPORTS = `import { safeAttrJsString } from './lab-panel.mjs';
import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
} from '../tend-core.mjs';
import {
  isAbgAnalysisHidden,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-lab-prefs.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, esc } from './tendencias-state.mjs';
import {
  tendCatalogSeriesKey,
  tendFindSeriesSpec,
  tendEyeVisibilitySvg,
  tendRefForSeries,
} from './tendencias-catalog.mjs';
`;

const hiddenBody = [
  slice(seriesLines, hidStart, n(seriesLines, (l) => l.startsWith('function tendFindSeriesSpec'))),
  slice(seriesLines, abnStart, expStart),
].join('\n');

const hidden = `${HIDDEN_IMPORTS}
${hiddenBody.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}
export {
  tendHiddenSeriesRead,
  tendHiddenSeriesWrite,
  tendSeriesIsUserHidden,
  tendSeriesSetUserHidden,
  seedTendHiddenDefaults,
  tendAbnormalOnlyRead,
  tendAbnormalOnlyWrite,
  tendSeriesLatestAbnormal,
  tendHiddenChipDescriptors,
  buildTendHiddenChipsHtml,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
};
`;

const seriesAgg = `// Re-export catalog + sections + hidden (stable import path for spark/render/core).
export {
  toTrendAscendingSets,
  tendCardLabelParts,
  tendUnitForSeries,
  tendRefOrientative,
  tendRefFromLabSet,
  tendRefForSeries,
  tendParsedHistoryDesc,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  tendFindSeriesSpec,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendEyeVisibilitySvg,
  tendEyeHideSvg,
} from './tendencias-catalog.mjs';
export {
  tendSectionExpandedRead,
  tendSectionExpandedWrite,
  tendSectionIsExpanded,
  destroySparkChartsForSection,
  mountSectionSparkCharts,
  applyTendSectionExpandedState,
  toggleTendSection,
} from './tendencias-sections.mjs';
export {
  tendHiddenSeriesRead,
  tendHiddenSeriesWrite,
  tendSeriesIsUserHidden,
  tendSeriesSetUserHidden,
  seedTendHiddenDefaults,
  tendAbnormalOnlyRead,
  tendAbnormalOnlyWrite,
  tendSeriesLatestAbnormal,
  tendHiddenChipDescriptors,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openTendHiddenModal,
  closeTendHiddenModal,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-hidden.mjs';
`;

// --- ui → detail + shell ---
const fmtStart = n(uiLines, (l) => l.startsWith('function formatDMYDate'));
const grpStart = n(uiLines, (l) => l.startsWith('var tendGroupModal'));
const destStart = n(uiLines, (l) => l.startsWith('function destroyTendCardSortables'));
const dsStart = n(uiLines, (l) => l.startsWith('function downsampleTrendChartSeries'));
const syncStart = n(uiLines, (l) => l.startsWith('function syncTendHiddenModalIfOpen'));
const detOpen = n(uiLines, (l) => l.startsWith('function openTendDetail(sectionKey'));
const uiExp = n(uiLines, (l) => l === 'export {');

const DETAIL_IMPORTS = `import { notes } from '../app-state.mjs';
import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  buildTendChartLabels,
  sortLabHistoryChronological,
  parseFechaLabToMs,
  normalizeFechaLabHistory,
} from '../tend-core.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from '../ui-motion.mjs';
import { TREND_DETAIL_DOWNSAMPLE } from '../lab-history-cache.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import { aid, tendStore } from './tendencias-state.mjs';
import {
  tendCardLabelParts,
  tendRefForSeries,
  tendFindSeriesSpec,
  tendParsedHistoryDesc,
  toTrendAscendingSets,
} from './tendencias-catalog.mjs';
`;

const detailBody = [
  slice(uiLines, fmtStart, grpStart),
  slice(uiLines, dsStart, syncStart),
  slice(uiLines, detOpen, uiExp),
].join('\n');

const detail = `${DETAIL_IMPORTS}
${detailBody}
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
  downsampleTrendChartSeries,
  openTendDetail,
  openTendDetailAsync,
  closeTendDetail,
};
`;

const SHELL_IMPORTS = `import { createTendGroupModal } from '../tend-group-modal.mjs';
import { writeTendCardOrder } from '../tend-prefs.mjs';
import { guidedTourAdvanceAfter, getGuidedTourContext } from './settings-help/tour-flow.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { isAbgAnalysisHidden } from './tendencias-lab-prefs.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { aid, tendStore } from './tendencias-state.mjs';
import {
  tendParsedHistoryDesc,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendUnitForSeries,
  tendRefFromLabSet,
  tendRefForSeries,
  closeTendHiddenModal,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
} from './tendencias-series.mjs';
import { openTendDetail } from './tendencias-ui-detail.mjs';
`;

const shellBody = [
  slice(uiLines, grpStart, destStart),
  slice(uiLines, destStart, dsStart),
  slice(uiLines, syncStart, detOpen),
].join('\n');

const shell = `${SHELL_IMPORTS}
${shellBody.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}
export {
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
  isTendGroupModalOpen,
};
`;

const uiAgg = `export {
  formatDMYDate,
  inferFechaLabSetFromId,
  closeTendDetail,
  openTendDetail,
} from './tendencias-ui-detail.mjs';
export {
  closeTendGroupModal,
  initTendGroupModal,
  openTendGroupModal,
  openTendGasoExtendedModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  tendSectionChartSvg,
  destroyTendCardSortables,
  ensureTendHiddenModalDelegation,
  ensureTendenciasClickDelegation,
  tendCardActivate,
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
  isTendGroupModalOpen,
} from './tendencias-ui-shell.mjs';
`;

fs.writeFileSync(path.join(dir, 'tendencias-catalog.mjs'), catalog);
fs.writeFileSync(path.join(dir, 'tendencias-sections.mjs'), sections);
fs.writeFileSync(path.join(dir, 'tendencias-hidden.mjs'), hidden);
fs.writeFileSync(path.join(dir, 'tendencias-series.mjs'), seriesAgg);
fs.writeFileSync(path.join(dir, 'tendencias-ui-detail.mjs'), detail);
fs.writeFileSync(path.join(dir, 'tendencias-ui-shell.mjs'), shell);
fs.writeFileSync(path.join(dir, 'tendencias-ui.mjs'), uiAgg);

// Update core imports from tendencias-ui
let core = fs.readFileSync(path.join(dir, 'tendencias-core.mjs'), 'utf8');
core = core.replace("} from './tendencias-ui.mjs';", "} from './tendencias-ui.mjs';\n// detail exports via ui aggregator");
fs.writeFileSync(path.join(dir, 'tendencias-core.mjs'), core);

// Update barrel bridge imports
let barrel = fs.readFileSync(path.join(dir, 'tendencias.mjs'), 'utf8');
barrel = barrel.replace(
  "import { mountTendCardSortables, syncTendHiddenModalIfOpen } from './tendencias-ui.mjs';",
  "import { mountTendCardSortables, syncTendHiddenModalIfOpen } from './tendencias-ui-shell.mjs';"
);
fs.writeFileSync(path.join(dir, 'tendencias.mjs'), barrel);

for (const f of [
  'tendencias-catalog.mjs',
  'tendencias-sections.mjs',
  'tendencias-hidden.mjs',
  'tendencias-ui-detail.mjs',
  'tendencias-ui-shell.mjs',
]) {
  console.log(f, fs.readFileSync(path.join(dir, f), 'utf8').split('\n').length);
}
