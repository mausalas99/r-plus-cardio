#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const filePath = path.join(ROOT, 'public/js/features/tendencias.mjs');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
const IMPORT_BLOCK = lines.slice(0, 41).join('\n');

const regStart = lines.findIndex((l) => l.startsWith('export function registerTendenciasRuntime'));
let regEnd = regStart;
while (regEnd < lines.length && !lines[regEnd].startsWith('function aid()')) regEnd += 1;
const renderStart = lines.findIndex((l) => l.startsWith('function renderTendencias(opts)'));
const downsampleStart = lines.findIndex((l) => l.startsWith('function downsampleTrendChartSeries'));
const exportStart = lines.findIndex((l) => l === 'export {');
const winStart = lines.findIndex((l) => l.startsWith('export const tendenciasWindowHandlers'));

const isAbg = lines.slice(42, 45).join('\n');
const labBody = lines.slice(433, 545).join('\n');

const labPrefs = `${IMPORT_BLOCK}
export var rt = {
  getActiveId() { return null; },
  ensureParsedLabHistory() { return []; },
  ensureParsedLabHistoryCached() { return []; },
  rerenderParsedLabOutputAfterPrefsChange() {},
  rpcPrefersReducedMotion() { return false; },
  showToast() {},
  buildLabSetDateLine() { return ''; },
};
${isAbg}
${labBody}
export {
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
};
`;

const corePieces = [
  lines.slice(regEnd, 433).join('\n'),
  lines.slice(545, renderStart).join('\n'),
  lines.slice(downsampleStart, exportStart).join('\n'),
]
  .filter(Boolean)
  .join('\n');

const core = `${IMPORT_BLOCK}
import {
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
  isAbgAnalysisHidden,
  rt,
} from './tendencias-lab-prefs.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';

${corePieces.replace(/\brenderTendencias\(/g, 'tendenciasBridge.renderTendencias(')}

export {
  inferFechaLabSetFromId,
  formatDMYDate,
  seedTendHiddenDefaults,
  openTendGroupModal,
  openTendGasoExtendedModal,
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
  initTendGroupModal,
  ensureTendHiddenModalDelegation,
  ensureTendenciasClickDelegation,
  buildMergedTrendSeriesCatalog,
  getTendSectionLabel,
  tendRefForSeries,
  tendParsedHistoryDesc,
  aid,
  esc,
  destroyTendCardSortables,
  destroySparkChartEntry,
  buildTendRenderKey,
  tendPrefsHash,
  tendExpandedSectionsKey,
  patchTendCardsFromIndex,
  sparkChartAnim,
  updateSparkChartsFromJobs,
  buildSparkJobsFromIndex,
  tendSectionIsExpanded,
  tendCatalogSeriesKey,
  tendAbnormalOnlyRead,
  tendHiddenChipDescriptors,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  orderTrendSeriesBySaved,
  tendCardLabelParts,
  trendSparkDomId,
  tendEyeHideSvg,
  tendSectionChartSvg,
  toTrendAscendingSets,
  syncTendHiddenModalIfOpen,
  tendSeriesIsUserHidden,
  _tendRenderState,
  sparkCharts,
};
`;

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
  '_tendRenderState',
  'sparkCharts',
];

let rb = lines.slice(renderStart, downsampleStart).join('\n');
for (const n of TC_NAMES) {
  rb = rb.replace(new RegExp(`\\b${n}\\(`, 'g'), `tc.${n}(`);
}
rb = rb.replace(/\b_?tendRenderState\b/g, 'tc._tendRenderState');
rb = rb.replace(/\bsparkCharts\b/g, 'tc.sparkCharts');
rb = rb.replace(/\btc\.tc\./g, 'tc.');

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

const renderFinal = `${RENDER_IMPORTS}

${rb}
`;

const registerBlock = lines.slice(regStart, regEnd).join('\n');

const main = `// Tendencias — barrel: runtime registration + re-exports
import { patients } from '../app-state.mjs';
import { TEND_UNITS } from './tendencias-constants.mjs';
import { TEND_UNITS } from './tendencias-constants.mjs';
import { registerSesionIngresoTrendsRuntime } from '../sesion-ingreso-trends-export.mjs';
import {
  closeSesionIngresoTrendsSendModal,
  openSesionIngresoTrendsSendModal,
  registerSesionIngresoTrendsSendRuntime,
} from './sesion-ingreso-trends-send-modal.mjs';
import { rt } from './tendencias-lab-prefs.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import * as tc from './tendencias-core.mjs';
import { renderTendencias } from './tendencias-render.mjs';

tendenciasBridge.renderTendencias = renderTendencias;

${registerBlock
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

const dir = path.join(ROOT, 'public/js/features');
fs.writeFileSync(path.join(dir, 'tendencias-bridge.mjs'), 'export const tendenciasBridge = { renderTendencias(_opts) {} };\n');
fs.writeFileSync(path.join(dir, 'tendencias-lab-prefs.mjs'), labPrefs);
fs.writeFileSync(path.join(dir, 'tendencias-core.mjs'), core);
fs.writeFileSync(path.join(dir, 'tendencias-render.mjs'), renderFinal);
fs.writeFileSync(filePath, main);
console.log('core', core.split('\n').length, 'render', renderFinal.split('\n').length, 'main', main.split('\n').length);
