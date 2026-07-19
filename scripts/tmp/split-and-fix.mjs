#!/usr/bin/env node
/** Split med-pharm + tend-group-modal; apply mp-state and fix known artifacts. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const w = (rel, s) => fs.writeFileSync(path.join(root, rel), s.endsWith('\n') ? s : s + '\n');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const slice = (rel, a, b) => read(rel).split('\n').slice(a, b).join('\n');

const MP = 'public/js/features/med-pharm-profile-panel.mjs';
const TG = 'public/js/tend-group-modal.mjs';

import { spawnSync } from 'node:child_process';
spawnSync('node', ['scripts/tmp/split-god-files-v2.mjs'], { cwd: root, stdio: 'inherit' });

// ── med-pharm state fixes ──
let state = read('public/js/features/med-pharm-profile-state.mjs');
state = state
  .replace(/if \(listFilter ===/g, 'if (mp.listFilter ===')
  .replace(/=== listFilter/g, '=== mp.listFilter')
  .replace(/if \(showHiddenMedRows\)/g, 'if (mp.showHiddenMedRows)')
  .replace(/if \(!showHiddenMedRows\)/g, 'if (!mp.showHiddenMedRows)')
  .replace(/filtro\.value = listFilter/g, 'filtro.value = mp.listFilter')
  .replace(/function countHiddenInCategoryFilter/g, 'export function countHiddenInCategoryFilter')
  .replace(/function isMedPharmGroupHidden/g, 'export function isMedPharmGroupHidden')
  .replace(/function groupMatchesCategoryFilter/g, 'export function groupMatchesCategoryFilter')
  .replace(/function displayRowsForWindow/g, 'export function displayRowsForWindow')
  .replace(/function displayGroupsForWindow/g, 'export function displayGroupsForWindow')
  .replace(/function countHiddenGroups/g, 'export function countHiddenGroups')
  .replace(/function renderFilterSelect/g, 'export function renderFilterSelect');
state = state.replace(/function setMedPharmMedGroupHidden[\s\S]*?\/\* modal via bridge \*\/;\n\}/, '');
w('public/js/features/med-pharm-profile-state.mjs', state);

// modals fixes
let modals = read('public/js/features/med-pharm-profile-modals.mjs');
modals = modals.replace(/\nexport function closeMedPharmModals\(\) \{\n  closeModals\(\);\n\}\n\nexport function closeMedPharmModals/, '\nexport function closeMedPharmModals');
if (!modals.includes('document.addEventListener(')) {
  modals = modals.replace(
    'mp.dismissWired = true;\n    \'keydown\',',
    'mp.dismissWired = true;\n  document.addEventListener(\n    \'keydown\','
  );
}
w('public/js/features/med-pharm-profile-modals.mjs', modals);

// grid export
let grid = read('public/js/features/med-pharm-profile-grid.mjs');
grid = grid.replace('function mountSomeGrid(', 'export function mountSomeGrid(');
if (!grid.includes('export function buildMedGroupModalSubtitle')) {
  grid += `
export function buildMedGroupModalSubtitle(profile, window, variantRows) {
  var rowKeys = variantRows.map(function (r) { return r.rowKey; });
  var stats = adherenceStatsForRowKeys(profile, rowKeys, window.columns);
  var parts = [window.label];
  if (variantRows.length > 1) {
    parts.push(variantRows.length + ' regímenes (dosis distintas)');
  } else {
    var row = variantRows[0];
    if (row.dosis) parts.push(row.dosis);
    parts.push(formatFreqShort(row.freq) + ' · ' + formatViaShort(row.via));
  }
  parts.push(stats.effective + ' d efectivos');
  return parts.join(' · ');
}
`;
}
w('public/js/features/med-pharm-profile-grid.mjs', grid);

// render fixes
let render = read('public/js/features/med-pharm-profile-render.mjs');
const r1 = render.indexOf('export function renderMedPharmProfilePanel()');
const r2 = render.indexOf('export function renderMedPharmProfilePanel()', r1 + 10);
if (r2 > 0) {
  const onReceta = render.indexOf('export function onRecetaMergedToProfile', r2);
  render = render.slice(0, r2) + render.slice(onReceta);
}
render = render.replace('cb.checked = showHiddenMedRows;', 'cb.checked = mp.showHiddenMedRows;');
w('public/js/features/med-pharm-profile-render.mjs', render);

// adh mp refs
let adh = read('public/js/features/med-pharm-profile-adh.mjs');
adh = adh.replace(/monthLabel\(viewYear, viewMonthIndex\)/g, 'monthLabel(mp.viewYear, mp.viewMonthIndex)');
w('public/js/features/med-pharm-profile-adh.mjs', adh);

// tend charts - strip leaked modal helpers
let charts = read('public/js/tend-group-charts.mjs');
if (charts.includes('function closeModal()')) {
  charts = charts.replace(
    /\n  function backdropEl\(\)[\s\S]*?function isAbnormal[\s\S]*?return val < ref\[0\] \|\| val > ref\[1\];\n  \}\n  function persistLegendVisible\(sectionKey\) \{\n    var vis = \[\];\n    document\.querySelectorAll\('#tend-group-backdrop \.tend-group-legend-check:checked'\)[\s\S]*?state\.visibleFields = vis\.slice\(\);\n    \}\n  \}/,
    ''
  );
  w('public/js/tend-group-charts.mjs', charts);
}

// tend table from orig if broken
const tablePath = path.join(root, 'public/js/tend-group-table.mjs');
const table = read('public/js/tend-group-table.mjs');
if (!table.includes('export function createTendGroupTableApi') || table.split('{').length !== table.split('}').length) {
  const orig = fs.readFileSync('/tmp/tend-group-modal.orig.mjs', 'utf8').split('\n');
  w('public/js/tend-group-table.mjs', `import {
  getSetTrendValueForSeries,
  buildSectionTableModel,
  formatTrendColumnHeader,
  formatTendSeriesLabel,
} from './tend-core.mjs';
import { readGroupTableHidden, writeGroupTableHidden } from './tend-prefs.mjs';
import { formatTrendDisplayValue, colKeyForSet } from './tend-group-chart-helpers.mjs';

export function createTendGroupTableApi(deps, state) {
${orig.slice(347, 638).join('\n')}
  return { renderTable, buildTableExportModel, formatCellValue, columnHeader, legendLabelForSpec };
}
`);
}

// gaso return
let gaso = read('public/js/tend-group-gaso.mjs');
if (!gaso.includes('return { openGasoExtended')) {
  gaso = gaso.replace(/\n}\s*$/, '\n  return { openGasoExtended, closeGasoExtended };\n}\n');
  w('public/js/tend-group-gaso.mjs', gaso);
}

console.log('split+fix done');
console.log('med-pharm panel:', read(MP).split('\n').length, 'lines (barrel)');
['state','adh','grid','modals','render','subview','stash','bridge'].forEach((n) => {
  const p = `public/js/features/med-pharm-profile-${n}.mjs`;
  if (fs.existsSync(path.join(root, p))) console.log(n, read(p).split('\n').length);
});
['modal','table','charts','gaso','chart-helpers'].forEach((n) => {
  const p = `public/js/tend-group-${n}.mjs`;
  if (fs.existsSync(path.join(root, p))) console.log('tend-'+n, read(p).split('\n').length);
});
