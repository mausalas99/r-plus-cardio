#!/usr/bin/env node
/** Safe tendencias split: bridge + core + render + barrel. Does NOT touch lab-prefs/ constants. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(ROOT, 'public/js/features');
const filePath = path.join(dir, 'tendencias.mjs');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

const regStart = lines.findIndex((l) => l.startsWith('export function registerTendenciasRuntime'));
let regEnd = regStart;
while (regEnd < lines.length && !lines[regEnd].startsWith('function aid()')) regEnd += 1;
const renderStart = lines.findIndex((l) => l.startsWith('function renderTendencias(opts)'));
const downsampleStart = lines.findIndex((l) => l.startsWith('function downsampleTrendChartSeries'));
const exportStart = lines.findIndex((l) => l === 'export {');

const CORE_IMPORTS = `import { notes } from '../app-state.mjs';
import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
  buildTendChartLabels,
  sortLabHistoryChronological,
  parseFechaLabToMs,
  normalizeFechaLabHistory,
  normalizeHoraLabHistory,
  tendEligibleSectionKey,
} from '../tend-core.mjs';
import { createTendGroupModal } from '../tend-group-modal.mjs';
import { scheduleAfterPaint, scheduleIdle } from '../deferred-work.mjs';
import { cancelOverlayClose, closeOverlayAnimated } from '../ui-motion.mjs';
import {
  buildTrendSeriesIndexCached,
  getLabHistoryRevision,
  getTrendRenderWindow,
  TREND_DETAIL_DOWNSAMPLE,
  TREND_SPARK_WINDOW,
  trendCatalogSeriesKey,
} from '../lab-history-cache.mjs';
import { readTendCardOrder, writeTendCardOrder } from '../tend-prefs.mjs';
import {
  formatBhExtrasDisplayLine,
  parseBhTrendValuesFromResLab,
  bhTrendDisplayTitle,
  sortTrendSpecsBySomeOrder,
} from '../labs.js';
import { safeAttrJsString } from './lab-panel.mjs';
import { guidedTourAdvanceAfter, getGuidedTourContext } from './settings-help/tour-flow.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import {
  TEND_UNITS,
  TEND_REF,
  TEND_REF_GASES,
  TEND_SECTION_LABELS,
  TEND_SECTION_ORDER,
  TEND_SERIES_CATALOG,
} from './tendencias-constants.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import {
  isAbgAnalysisHidden,
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
} from './tendencias-lab-prefs.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
`;

const coreBody = [
  lines.slice(regEnd, renderStart).join('\n'),
  lines.slice(downsampleStart, exportStart).join('\n'),
]
  .filter(Boolean)
  .join('\n')
  .replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')
  .replace(/\nvar LAB_OUTPUT_PREFS_KEY = 'rpc-lab-output-prefs-v1';\n/, '\n');

const CORE_EXPORTS = `export {
  aid,
  esc,
  destroyTendCardSortables,
  destroySparkChartEntry,
  tendParsedHistoryDesc,
  buildMergedTrendSeriesCatalog,
  getTendSectionLabel,
  tendRefForSeries,
  tendSeriesIsUserHidden,
  tendCatalogSeriesKey,
  tendAbnormalOnlyRead,
  tendHiddenChipDescriptors,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  tendSectionIsExpanded,
  orderTrendSeriesBySaved,
  tendCardLabelParts,
  trendSparkDomId,
  tendEyeHideSvg,
  tendSectionChartSvg,
  buildTendRenderKey,
  tendPrefsHash,
  tendExpandedSectionsKey,
  patchTendCardsFromIndex,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  buildSparkJobsFromIndex,
  toTrendAscendingSets,
  syncTendHiddenModalIfOpen,
  ensureTendenciasClickDelegation,
  initTendGroupModal,
  ensureTendHiddenModalDelegation,
  inferFechaLabSetFromId,
  formatDMYDate,
  seedTendHiddenDefaults,
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
  openTendDetail,
  tendCardActivate,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
  _tendRenderState,
  sparkCharts,
};
`;

const core = `${CORE_IMPORTS}\n${coreBody}\n${CORE_EXPORTS}\n`;

const TC_NAMES = [
  'aid',
  'esc',
  'destroyTendCardSortables',
  'destroySparkChartEntry',
  'closeTendHiddenModal',
  'tendParsedHistoryDesc',
  'buildMergedTrendSeriesCatalog',
  'tendRefForSeries',
  'tendSeriesIsUserHidden',
  'tendCatalogSeriesKey',
  'tendAbnormalOnlyRead',
  'tendHiddenChipDescriptors',
  'buildTendInlineControlsHtml',
  'historyHasGasoForExtended',
  'tendSectionIsExpanded',
  'orderTrendSeriesBySaved',
  'tendCardLabelParts',
  'trendSparkDomId',
  'tendEyeHideSvg',
  'tendSectionChartSvg',
  'buildTendRenderKey',
  'tendPrefsHash',
  'tendExpandedSectionsKey',
  'patchTendCardsFromIndex',
  'sparkChartAnim',
  'updateSparkChartsFromJobs',
  'buildSparkJobsFromIndex',
  'toTrendAscendingSets',
  'syncTendHiddenModalIfOpen',
  'ensureTendenciasClickDelegation',
];

let renderBody = lines.slice(renderStart, downsampleStart).join('\n');
for (const n of TC_NAMES) {
  renderBody = renderBody.replace(new RegExp(`\\b${n}\\(`, 'g'), `tc.${n}(`);
}
renderBody = renderBody.replace(/\b_?tendRenderState\b/g, 'tc._tendRenderState');
renderBody = renderBody.replace(/\bsparkCharts\b/g, 'tc.sparkCharts');
renderBody = renderBody.replace(/\btc\.tc\./g, 'tc.');

const RENDER_IMPORTS = `import { scheduleAfterPaint } from '../deferred-work.mjs';
import { buildTextSkeletonPanel } from '../ui-skeleton.mjs';
import {
  buildTrendSeriesIndexCached,
  getLabHistoryRevision,
  getTrendRenderWindow,
  TREND_SPARK_WINDOW,
} from '../lab-history-cache.mjs';
import { readTendCardOrder } from '../tend-prefs.mjs';
import { getSetTrendValueForSeries, buildTendChartLabels } from '../tend-core.mjs';
import { TEND_SECTION_LABELS, TEND_SECTION_ORDER } from './tendencias-constants.mjs';
import { syncAbgLabPrefRowVisibility, isAbgAnalysisHidden } from './tendencias-lab-prefs.mjs';
import * as tc from './tendencias-core.mjs';
`;

const render = `${RENDER_IMPORTS}\n${renderBody}\n\nexport { renderTendencias };\n`;

const registerBlock = lines.slice(regStart, regEnd).join('\n');

const barrel = `// Tendencias — barrel: runtime registration + re-exports
import { patients } from '../app-state.mjs';
import { TEND_UNITS } from './tendencias-constants.mjs';
import { registerSesionIngresoTrendsRuntime } from '../sesion-ingreso-trends-export.mjs';
import {
  closeSesionIngresoTrendsSendModal,
  openSesionIngresoTrendsSendModal,
  registerSesionIngresoTrendsSendRuntime,
} from './sesion-ingreso-trends-send-modal.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import * as tc from './tendencias-core.mjs';
import { renderTendencias } from './tendencias-render.mjs';

tendenciasBridge.renderTendencias = renderTendencias;

${registerBlock
  .replace(/^export function registerTendenciasRuntime/, 'export function registerTendenciasRuntime')
  .replace(/\binitTendGroupModal\(\)/g, 'tc.initTendGroupModal()')
  .replace(/\bensureTendHiddenModalDelegation\(\)/g, 'tc.ensureTendHiddenModalDelegation()')
  .replace(/\bensureTendenciasClickDelegation\(\)/g, 'tc.ensureTendenciasClickDelegation()')
  .replace(/\bbuildMergedTrendSeriesCatalog\b/g, 'tc.buildMergedTrendSeriesCatalog')
  .replace(/\bgetTendSectionLabel\b/g, 'tc.getTendSectionLabel')
  .replace(/\btendRefForSeries\b/g, 'tc.tendRefForSeries')
  .replace(/\btendParsedHistoryDesc\(/g, 'tc.tendParsedHistoryDesc(')
  .replace(/\baid\(\)/g, 'tc.aid()')}

export { renderTendencias } from './tendencias-render.mjs';
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
} from './tendencias-lab-prefs.mjs';
export {
  inferFechaLabSetFromId,
  formatDMYDate,
  seedTendHiddenDefaults,
  isTendGroupModalOpen,
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
} from './tendencias-core.mjs';

export const tendenciasWindowHandlers = {
  openSesionIngresoTrendsSendModal,
  closeSesionIngresoTrendsSendModal,
  closeTendDetail: tc.closeTendDetail,
  openTendGroupModal: tc.openTendGroupModal,
  openTendGasoExtendedModal: tc.openTendGasoExtendedModal,
  closeTendGroupModal: tc.closeTendGroupModal,
  setTendGroupTab: tc.setTendGroupTab,
  copyTendGroupTablePng: tc.copyTendGroupTablePng,
  copyTendGroupTableText: tc.copyTendGroupTableText,
  toggleTendSection: tc.toggleTendSection,
  toggleTendAbnormalOnlyFilter: tc.toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard: tc.tendHideSeriesFromCard,
  tendUnhideSeries: tc.tendUnhideSeries,
  tendResetAllHiddenSeries: tc.tendResetAllHiddenSeries,
  openTendHiddenModal: tc.openTendHiddenModal,
  closeTendHiddenModal: tc.closeTendHiddenModal,
  openTendDetail: tc.openTendDetail,
  tendCardActivate: tc.tendCardActivate,
  openLabDisplayPrefsModal: tc.openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal: tc.closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged: tc.onLabDisplayPrefsChanged,
};
`;

fs.writeFileSync(path.join(dir, 'tendencias-bridge.mjs'), `/** Late-bound render to avoid core ↔ render cycle. */
export const tendenciasBridge = { renderTendencias(_opts) {} };
`);
fs.writeFileSync(path.join(dir, 'tendencias-core.mjs'), core);
fs.writeFileSync(path.join(dir, 'tendencias-render.mjs'), render);
fs.writeFileSync(filePath, barrel);

// Fix lab-prefs constant if missing
const labPrefsPath = path.join(dir, 'tendencias-lab-prefs.mjs');
let labPrefs = fs.readFileSync(labPrefsPath, 'utf8');
if (!labPrefs.includes('LAB_OUTPUT_PREFS_KEY =')) {
  labPrefs = labPrefs.replace(
    "import { rt } from './tendencias-runtime-state.mjs';",
    "import { rt } from './tendencias-runtime-state.mjs';\n\nconst LAB_OUTPUT_PREFS_KEY = 'rpc-lab-output-prefs-v1';"
  );
  fs.writeFileSync(labPrefsPath, labPrefs);
}

console.log(
  'split done — core',
  core.split('\n').length,
  'render',
  render.split('\n').length,
  'barrel',
  barrel.split('\n').length
);
