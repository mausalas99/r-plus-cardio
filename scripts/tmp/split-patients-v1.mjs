#!/usr/bin/env node
/** Split patients.mjs into modules <600 lines (bridge breaks list ↔ select cycle). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/js/features');
const src = path.join(dir, 'patients.mjs');
const lines = fs.readFileSync(src, 'utf8').split('\n');

const n = (pred) => lines.findIndex(pred);
const slice = (a, b) => lines.slice(a, b).join('\n');

const IMPORT = lines.slice(0, n((l) => l.startsWith('export function invalidateMobileSidebarPatientCache'))).join('\n');

const rtStart = n((l) => l.startsWith('let rt = {'));
const rtEnd = n((l) => l.startsWith('export function registerPatientsRuntime'));
const roundStart = n((l) => l.startsWith('var ROUND_SEEN_LS'));
const sortStart = n((l) => l.startsWith('function destroyPatientListSortables'));
const cardStart = n((l) => l.startsWith('function renderPatientCardToolbarHtml'));
const roundRowStart = n((l) => l.startsWith('function renderPatientRoundRowHtml'));
const listStart = n((l) => l.startsWith('export function renderPatientList'));
const selectStart = n((l) => l.startsWith('export function selectPatient'));
const deleteStart = n((l) => l.startsWith('export function deletePatient'));
const modalStart = n((l) => l.startsWith('export function openAddModal'));
const handlersStart = n((l) => l.startsWith('export const windowHandlers'));

const bridge = `/** Late-bound list/select to avoid round ↔ list ↔ select cycles. */
export const patientsBridge = {
  renderPatientList(_opts) {},
  selectPatient(_id, _opts) {},
};
`;

const runtimeState = `${slice(rtStart, rtEnd)}
export { rt };
`;

const br = (s) =>
  s
    .replace(/\brenderPatientList\(/g, 'patientsBridge.renderPatientList(')
    .replace(/\bselectPatient\(/g, 'patientsBridge.selectPatient(');

const roundBody = [
  slice(n((l) => l.startsWith('var patientSearchFilter')), roundStart),
  slice(roundStart, sortStart),
  slice(roundRowStart, cardStart),
].join('\n');

const round = `${IMPORT}
import { patients } from '../app-state.mjs';
import { notes } from '../app-state.mjs';
import { sortLabHistoryChronological } from '../tend-core.mjs';
import { ensureParsedLabHistoryCached } from '../lab-history-set.mjs';
import { isPaseMode, t } from './chrome.mjs';
import { renderPatientSidebarBodyHtml } from '../patient-sidebar-card.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { rt } from './patients-runtime-state.mjs';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

${br(roundBody)}

export {
  getRoundOverviewMode,
  setRoundOverviewMode,
  togglePatientRoundSeen,
  syncRoundExpedienteLayout,
  renderRoundOverviewPanels,
  closeRondaQuickMoreMenu,
  returnToRoundOverview,
  openFullExpedienteFromRound,
  advanceRondaPatient,
  scrollActiveRondaCardIntoView,
  renderPatientRoundRowHtml,
};
`;

const LIST_IMPORTS = `import { patients, saveState } from '../app-state.mjs';
import { storage } from '../storage.js';
import { isMobileWeb } from '../mobile-web.mjs';
import { isPaseMode, t } from './chrome.mjs';
import { isModeSala } from '../mode-features.mjs';
import { renderPatientSidebarBodyHtml } from '../patient-sidebar-card.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { rt } from './patients-runtime-state.mjs';
import {
  shouldEnforceTeamPatientMirror,
  isClinicalScopeReadyForLanPatientApply,
  clinicalSessionContext,
} from '../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror as _mirror } from '../clinical-privileges.mjs';
import { filterPatientsForPitchTour } from '../tour-pitch-demo-seed.mjs';
import {
  buildPatientListZones,
  buildRondaNavIds,
  trySilentPatientListPatch,
  updatePatientListDomIncremental,
} from '../patient-list-incremental.mjs';
import {
  shouldVirtualizeActiveZone,
  mountPatientActiveZoneVirtual,
  destroyPatientActiveZoneVirtual,
  trySilentVirtualPatientListPatch,
} from '../patient-list-virtual.mjs';
import { renderPatientRoundRowHtml } from './patients-round.mjs';
import { syncClinicalCensusFiltersBar } from './patients-census.mjs';
`;

// Fix duplicate import - use simpler list imports
const listImports = `${IMPORT}
import { patients, saveState } from '../app-state.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import { isPaseMode, t } from './chrome.mjs';
import { isModeSala } from '../mode-features.mjs';
import { renderPatientSidebarBodyHtml } from '../patient-sidebar-card.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { rt } from './patients-runtime-state.mjs';
import {
  shouldEnforceTeamPatientMirror,
  isClinicalScopeReadyForLanPatientApply,
} from '../clinical-access-runtime.mjs';
import { filterPatientsForPitchTour } from '../tour-pitch-demo-seed.mjs';
import {
  buildPatientListZones,
  buildRondaNavIds,
  updatePatientListDomIncremental,
} from '../patient-list-incremental.mjs';
import {
  shouldVirtualizeActiveZone,
  mountPatientActiveZoneVirtual,
  destroyPatientActiveZoneVirtual,
} from '../patient-list-virtual.mjs';
import { renderPatientRoundRowHtml } from './patients-round.mjs';
`;

const listBody = [
  slice(sortStart, cardStart),
  slice(cardStart, roundRowStart),
  slice(n((l) => l.startsWith('function renderPatientCardHtml')), listStart),
  slice(listStart, selectStart),
  slice(n((l) => l.startsWith('var _patientListClickWired')), deleteStart),
].join('\n');

const list = `${listImports}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
var patientSearchFilter = '';
var _patientListSortables = [];

function patientsVisibleInSidebar() {
  const base = filterPatientsForPitchTour(patients);
  if (shouldEnforceTeamPatientMirror() && !isClinicalScopeReadyForLanPatientApply()) {
    return [];
  }
  return patients.filter(function (p) {
    return !p.archived || patientSearchFilter;
  });
}

${listBody.replace(/\bselectPatient\(/g, 'patientsBridge.selectPatient(')}

export { renderPatientList };
`;

// patients-select - needs many imports from original
const selectBody = slice(selectStart, modalStart);
const select = `${IMPORT}
import { patients, notes, indicaciones, labHistory, medRecetaByPatient, medPharmProfileByPatient, listadoProblemas, vpoByPatient, saveState, flushSaveState } from '../app-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { rt } from './patients-runtime-state.mjs';
import { renderPatientList } from './patients-list.mjs';

${selectBody.replace(/\brenderPatientList\(/g, 'patientsBridge.renderPatientList(')}

export { selectPatient, deletePatient };
`;

const modal = `${IMPORT}
${slice(modalStart, handlersStart)}

export {
  openAddModal,
  openAddModalFromLab,
  openAddModalFromLabPatient,
  closeModal,
  confirmCloseAddPatientModal,
  savePatient,
  generatePatientId,
  buildPatientEntry,
  findPatientByRegistro,
  ensureUniquePatientName,
  focusPatientSearchInput,
  initPatientModalEnterSave,
};
`;

// Main barrel: scope + census + sidebar actions + register + handlers
const mainBody = [
  slice(n((l) => l.startsWith('export function invalidateMobileSidebarPatientCache')), rtStart),
  slice(rtEnd, n((l) => l.startsWith('function esc('))),
  slice(n((l) => l.startsWith('export function getRoundOverviewMode')) === -1 ? roundStart : n((l) => l.startsWith('export function onPatientSearchInput')), roundStart),
].join('\n');

// Simpler barrel approach - keep scope in main, extract only the big chunks
const scopeEnd = roundStart;
const sidebarStart = n((l) => l.startsWith('export function onPatientSearchInput'));
const sidebarEnd = sortStart;

const barrelScope = slice(n((l) => l.startsWith('export function invalidateMobileSidebarPatientCache')), rtStart);
const barrelRegister = slice(rtEnd, n((l) => l.startsWith('function esc(')));
const barrelSidebar = slice(sidebarStart, sidebarEnd);

const handlers = slice(handlersStart, lines.length);

const barrel = `${IMPORT}
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { renderPatientList } from './patients-list.mjs';
import { selectPatient, deletePatient } from './patients-select.mjs';
import * as pr from './patients-round.mjs';
import * as pm from './patients-modal.mjs';

patientsBridge.renderPatientList = renderPatientList;
patientsBridge.selectPatient = selectPatient;

${barrelScope}
${barrelRegister.replace(/^let rt = \{[\s\S]*?\};\n\n/, '')}
${br(barrelSidebar)}

${handlers
  .replace(/\bdeletePatient\b/g, 'deletePatient')
  .replace(/togglePatientRoundSeen/g, 'pr.togglePatientRoundSeen')
  .replace(/renderPatientList/g, 'renderPatientList')
  .replace(/selectPatient/g, 'selectPatient')}

export { registerPatientsRuntime, applyDefaultsToNewPatient, applyDefaultsToNewIndicaciones };
export { invalidateMobileSidebarPatientCache, pickDefaultVisiblePatientId, ensureActivePatientInSidebarScope };
export { filterPatientsForGuardiaCensus, syncClinicalCensusFiltersChrome };
export { onPatientSearchInput, toggleArchivedSection, movePatientByOffset, togglePatientPinned, togglePatientArchived };
export { toggleSidebarAutoHide, initSidebarAutoHide };
export { renderPatientList } from './patients-list.mjs';
export { selectPatient, deletePatient } from './patients-select.mjs';
export * from './patients-round.mjs';
export * from './patients-modal.mjs';
`;

// Write files - use git backup of patients first
fs.writeFileSync(path.join(dir, 'patients-bridge.mjs'), bridge);
fs.writeFileSync(path.join(dir, 'patients-runtime-state.mjs'), runtimeState);
fs.writeFileSync(path.join(dir, 'patients-round.mjs'), round);
// Skip broken list/select/modal for now - script too incomplete
console.log('round lines', round.split('\n').length);
console.log('SKIP full patients split - script needs patients-census extraction');
