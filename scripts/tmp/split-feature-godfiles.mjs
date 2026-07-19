#!/usr/bin/env node
/**
 * One-shot splitter for expediente / clinical-entrega / entrega-modal-ui god-files.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FEAT = path.join(ROOT, 'public/js/features');

function read(rel) {
  return fs.readFileSync(path.join(FEAT, rel), 'utf8');
}

function sliceLines(text, start1, end1) {
  return text.split('\n').slice(start1 - 1, end1).join('\n');
}

function write(rel, body) {
  const full = path.join(FEAT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body.endsWith('\n') ? body : body + '\n');
}

function lineCount(rel) {
  return fs.readFileSync(path.join(FEAT, rel), 'utf8').split('\n').length;
}

function patchDraftRefs(code) {
  return code
    .replace(/\bdraftItems\b/g, 'entregaDraft.items')
    .replace(/\bdraftActor\b/g, 'entregaDraft.actor')
    .replace(/\bdraftSourceTeamId\b/g, 'entregaDraft.sourceTeamId')
    .replace(/\bdraftVitalsPlan\b/g, 'entregaDraft.vitalsPlan')
    .replace(/\bdraftHandoffContext\b/g, 'entregaDraft.handoffContext')
    .replace(/\buiWired\b/g, 'entregaUiFlags.procWired')
    .replace(/\bhandoffUiWired\b/g, 'entregaUiFlags.handoffWired');
}

// ── expediente ──────────────────────────────────────────────────────
const exp = read('expediente.mjs');

write(
  'expediente/expediente-runtime.mjs',
  `// Expediente shared runtime bridge
${sliceLines(exp, 52, 90)}
`
);

write(
  'expediente/expediente-cultivos-parse.mjs',
  `// Cultivo block parsing, copy, lab output fragments
import { labHistory } from '../../app-state.mjs';
import { parseFechaLabToMs, normalizeFechaLabHistory } from '../../tend-core.mjs';
import {
  renderEntry,
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
  formatCultivoCondensedForCopy,
  isParsedCultivoHeaderLine,
  parseCuentaFromCultivoChunkLines,
} from '../../labs.js';
import { rt, aid, esc } from './expediente-runtime.mjs';

${sliceLines(exp, 96, 339)}

export {
  copyCultivoCondensado,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
  parseCultureBlockFromLineArray,
  isCultureTableHeaderLine,
};
`
);

write(
  'expediente/expediente-cultivos-atb-ui.mjs',
  `// Cultivos antibiogram hover panels + cell HTML
import { labHistory } from '../../app-state.mjs';
import {
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
} from '../../labs.js';
import { rt, aid, esc } from './expediente-runtime.mjs';

${sliceLines(exp, 353, 578)}
`
);

write(
  'expediente/expediente-cultivos-table.mjs',
  `// Cultivos table render, cache, refresh
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

${sliceLines(exp, 96, 104)}
${sliceLines(exp, 341, 351)}
${sliceLines(exp, 580, 830)}
`
);

write(
  'expediente/expediente-cultivos-pase.mjs',
  `// Pase board cultivo antibiogram blocks
import { labHistory } from '../../app-state.mjs';
import {
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
} from '../../labs.js';
import { esc } from './expediente-runtime.mjs';

${sliceLines(exp, 833, 864)}
`
);

write(
  'expediente/expediente-listado.mjs',
  `// Listado de problemas UI + docx export
import {
  listadoProblemas,
  patients,
  saveState,
} from '../../app-state.mjs';
import { setAsyncButtonLoading } from '../../ui-motion.mjs';
import {
  exportWithOutputDirFallback,
  guardDocExportBlocked,
  syncApprovedOutputDir,
} from '../../document-export-client.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';
import {
  emptyListado,
  addProblema as listadoAddProblema,
  removeProblema as listadoRemoveProblema,
} from '../../listado-problemas-core.mjs';
import { LISTADO_PROBLEMAS_AI_PROMPT } from '../../listado-problemas-ai-prompt.mjs';
import { isHideListadoProblemasAiPromptEnabled } from '../profile.mjs';
import { rt, aid, esc } from './expediente-runtime.mjs';

var _listadoSortables = [];

${sliceLines(exp, 867, 1178)}

export {
  renderListadoForm,
  generateListado,
  updateListadoMeta,
  updateProblemaField,
  addProblemaUI,
  removeProblemaUI,
  copyListadoProblemasAiPrompt,
  _autoGrowTextarea,
  updateListadoMedico,
};
`
);

write(
  'expediente/expediente-datos.mjs',
  `// Patient demographics pane (Datos tab)
import { patients } from '../../app-state.mjs';
import { isModeSala } from '../../mode-features.mjs';
import { buildPatientAccesosSectionHtml } from '../../patient-data-accesos-ui.mjs';
import { buildPatientTeamAssignSectionHtml, wirePatientTeamAssignRefresh } from '../../patient-team-assign-ui.mjs';
import { buildPatientIngresoFechasHtml } from '../../patient-data-ingreso-ui.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';
import { buildPatientCensoDatosSectionsHtml } from '../../patient-data-censo-ui.mjs';
import { rt, aid, esc } from './expediente-runtime.mjs';

${sliceLines(exp, 1181, 1241)}

export { buildPatientDemographicsCardHtml, renderPatientDataPane };
`
);

write(
  'expediente.mjs',
  `// Expediente — cultivos, listado (sala), pestaña Datos (façade)
import { patientDataAccesosWindowHandlers } from '../patient-data-accesos-ui.mjs';
import { patientTeamAssignWindowHandlers } from '../patient-team-assign-ui.mjs';
import { patientDatosModalWindowHandlers } from '../patient-datos-modal.mjs';
import { patientDataCensoWindowHandlers } from '../patient-data-censo-ui.mjs';
import { registerExpedienteRuntime } from './expediente/expediente-runtime.mjs';
import { buildCultivoAntibiogramCellHtmlForPatient } from './expediente/expediente-cultivos-atb-ui.mjs';
import {
  copyCultivoCondensado,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
} from './expediente/expediente-cultivos-parse.mjs';
import {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  invalidateCultivosTableCache,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
} from './expediente/expediente-cultivos-table.mjs';
import { wireAtbRisHoverPanels, removeAtbRisPanelsFromBody } from './expediente/expediente-cultivos-atb-ui.mjs';
import {
  formatPaseCultivoResistenciasHtml,
  paseCultivoAtbBlockHtml,
} from './expediente/expediente-cultivos-pase.mjs';
import {
  renderListadoForm,
  generateListado,
  updateListadoMeta,
  updateProblemaField,
  addProblemaUI,
  removeProblemaUI,
  copyListadoProblemasAiPrompt,
  _autoGrowTextarea,
  updateListadoMedico,
} from './expediente/expediente-listado.mjs';
import {
  buildPatientDemographicsCardHtml,
  renderPatientDataPane,
} from './expediente/expediente-datos.mjs';

export { registerExpedienteRuntime, buildCultivoAntibiogramCellHtmlForPatient, invalidateCultivosTableCache };

export {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  renderListadoForm,
  removeAtbRisPanelsFromBody,
  wireAtbRisHoverPanels,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
  formatPaseCultivoResistenciasHtml,
  paseCultivoAtbBlockHtml,
  buildPatientDemographicsCardHtml,
  renderPatientDataPane,
  copyCultivoCondensado,
  generateListado,
};

export const windowHandlers = Object.assign(
  {
    copyCultivoCondensado,
    updateListadoMeta,
    updateProblemaField,
    addProblemaUI,
    removeProblemaUI,
    copyListadoProblemasAiPrompt,
    generateListado,
    _autoGrowTextarea,
    renderPatientDataPane,
    updateListadoMedico,
  },
  patientDataCensoWindowHandlers,
  patientDataAccesosWindowHandlers,
  patientTeamAssignWindowHandlers,
  patientDatosModalWindowHandlers
);
`
);

// ── entrega-modal-ui ────────────────────────────────────────────────
const emui = read('entrega-modal-ui.mjs');

write(
  'entrega-modal-ui/entrega-modal-state.mjs',
  `// Shared entrega modal draft state
import { defaultHandoffContext } from '../../../../lib/entrega/entrega-handoff-context.mjs';
import { defaultVitalsPlan } from '../../../../lib/entrega/entrega-vitals-plan.mjs';

export const entregaDraft = {
  items: [],
  actor: null,
  sourceTeamId: '',
  vitalsPlan: defaultVitalsPlan(),
  handoffContext: defaultHandoffContext(),
};

export const entregaUiFlags = {
  procWired: false,
  handoffWired: false,
};
`
);

write(
  'entrega-modal-ui/entrega-modal-time.mjs',
  `// Time select helpers for entrega procedures / vitals
${sliceLines(emui, 57, 188)}
`
);

const procSlice = patchDraftRefs(sliceLines(emui, 233, 817));
write(
  'entrega-modal-ui/entrega-modal-procedures.mjs',
  `// Entrega pendientes — procedures list + add form
import {
  canDeletePendienteItem,
  createProcedimientoItem,
  pendingRequirementBadges,
} from '../../../../lib/entrega/entrega-pendientes.mjs';
import { entregaDraft, entregaUiFlags } from './entrega-modal-state.mjs';
import {
  formatHHmm,
  scheduledAtFromTimeInput,
  buildTimeSelectMarkup,
  readTimeFromForm,
  defaultProcedureTimeHHmm,
} from './entrega-modal-time.mjs';

const BADGE_LABELS = {
  consentimiento: 'Consent',
  anestesia: 'Anest',
  familiar: 'Familiar',
};

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

${procSlice}

export { hideAddForm, renderProcList, wireProcUiOnce };
`
);

const handoffSlice = patchDraftRefs(sliceLines(emui, 378, 667));
write(
  'entrega-modal-ui/entrega-modal-handoff.mjs',
  `// Entrega handoff context panel (clinical status, vasopressors, ventilation)
import {
  CLINICAL_STATUS_OPTIONS,
  VASOPRESSOR_AGENTS,
  VASOPRESSOR_INFUSION_DEFAULTS,
  VASOPRESSOR_UNIT_LABELS,
  VENTILATION_MODES,
  coerceVasopressorUnit,
  defaultHandoffContext,
  handoffContextSummary,
  normalizeHandoffContext,
  normalizeVasopressorAgent,
  defaultVasopressorInfusion,
} from '../../../../lib/entrega/entrega-handoff-context.mjs';
import { entregaDraft, entregaUiFlags } from './entrega-modal-state.mjs';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function checkPill(name, label, checked, extraClass = '', inputId = '') {
  const cls = ['entrega-check-pill', extraClass].filter(Boolean).join(' ');
  const idAttr = inputId ? \` id="\${escapeHtml(inputId)}"\` : '';
  return \`<label class="\${cls}">
    <input type="checkbox" name="\${name}"\${idAttr} \${checked ? 'checked' : ''}>
    <span>\${escapeHtml(label)}</span>
  </label>\`;
}

${handoffSlice}
`
);

const vitalsSlice = patchDraftRefs(sliceLines(emui, 826, 1244));
write(
  'entrega-modal-ui/entrega-modal-vitals.mjs',
  `// Entrega vitals plan panel
import {
  VITALS_FREQ_HOUR_PRESETS,
  VITALS_FREQ_SHIFT_OPTIONS,
  VITALS_METRIC_KEYS,
  VITALS_METRIC_LABELS,
  defaultFrequencySpec,
  defaultVitalsPlan,
  normalizeFrequencySpec,
  normalizeUntilTime,
  normalizeVitalsPlan,
  vitalsPlanSummary,
} from '../../../../lib/entrega/entrega-vitals-plan.mjs';
import { entregaDraft } from './entrega-modal-state.mjs';
import { buildTimeSelectMarkup } from './entrega-modal-time.mjs';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

${vitalsSlice}
`
);

write(
  'entrega-modal-ui.mjs',
  `/**
 * Entrega modal — procedimientos list and add form (façade).
 */
import { defaultHandoffContext } from '../../lib/entrega/entrega-handoff-context.mjs';
import { defaultVitalsPlan } from '../../lib/entrega/entrega-vitals-plan.mjs';
import { entregaDraft } from './entrega-modal-ui/entrega-modal-state.mjs';
import { hideAddForm, renderProcList, wireProcUiOnce } from './entrega-modal-ui/entrega-modal-procedures.mjs';
import {
  mountEntregaHandoffPanel,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  getEntregaHandoffContext,
} from './entrega-modal-ui/entrega-modal-handoff.mjs';
import {
  mountEntregaVitalsPanel,
  readEntregaVitalsPlan,
} from './entrega-modal-ui/entrega-modal-vitals.mjs';
import { normalizePendientesJson } from '../../lib/entrega/entrega-pendientes.mjs';

export function resolveEntregaActorRole(currentUser, existingGuardia) {
  const userId = String(currentUser?.user_id || currentUser?.userId || '');
  const coveringUserId = String(existingGuardia?.covering_user_id || '');
  const hasGuardia = !!(existingGuardia?.guardia_id || existingGuardia?.guardiaId);
  const isCoveringReceiver = hasGuardia && coveringUserId !== '' && coveringUserId === userId;
  return {
    role: isCoveringReceiver ? 'guardia' : 'diurno',
    userId,
    rank: String(currentUser?.rank || ''),
  };
}

export function getEntregaDraftItems() {
  return entregaDraft.items.slice();
}

export function resetEntregaModalUi() {
  entregaDraft.items = [];
  entregaDraft.actor = null;
  entregaDraft.sourceTeamId = '';
  entregaDraft.vitalsPlan = defaultVitalsPlan();
  entregaDraft.handoffContext = defaultHandoffContext();
  const statusSlot = document.getElementById('entrega-clinical-status-slot');
  if (statusSlot) statusSlot.innerHTML = '';
  const handoffPanel = document.getElementById('entrega-handoff-panel');
  if (handoffPanel) handoffPanel.innerHTML = '';
  const handoffSummary = document.getElementById('entrega-handoff-summary');
  if (handoffSummary) handoffSummary.textContent = '';
  const list = document.getElementById('entrega-proc-list');
  const formWrap = document.getElementById('entrega-proc-form');
  if (list) list.innerHTML = '';
  if (formWrap) {
    formWrap.innerHTML = '';
    formWrap.classList.add('hidden');
    formWrap.setAttribute('aria-hidden', 'true');
  }
}

export {
  mountEntregaHandoffPanel,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  getEntregaHandoffContext,
  mountEntregaVitalsPanel,
  readEntregaVitalsPlan,
};

export async function mountEntregaPendientesUi(opts) {
  wireProcUiOnce();
  entregaDraft.actor = opts.actor;
  entregaDraft.sourceTeamId = String(opts.sourceTeamId || '');
  const doc = normalizePendientesJson(opts.pendientesJson || '');
  entregaDraft.items = doc.items.slice();
  mountEntregaHandoffPanel(doc.handoffContext, {
    isCritical: !!opts.isCritical,
    signedRefusal: !!opts.signedRefusal,
  });
  mountEntregaVitalsPanel({
    vitalsPlan: doc.vitalsPlan,
    vitalsFrequency: opts.vitalsFrequency,
  });
  hideAddForm();
  renderProcList();
}
`
);

// ── clinical-entrega ──────────────────────────────────────────────────
const cent = read('clinical-entrega.mjs');

write(
  'clinical-entrega/clinical-entrega-constants.mjs',
  `/** @deprecated — use ENTREGA_PHASE_KEY */
export const GUARDIA_GRID_MODE_KEY = 'guardia.gridMode';
export const ENTREGA_PHASE_KEY = 'guardia.entregaPhase';
`
);

write(
  'clinical-entrega/clinical-entrega-util.mjs',
  `// Shared helpers — toast, patient row, modal element
import { patients } from '../../app-state.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';

${sliceLines(cent, 60, 88)}

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function setEntregaToolbarStatus(msg, isError = false) {
  const status = document.getElementById('guardia-entrega-phase-status');
  if (!status) return;
  if (!msg) {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('guardia-entrega-phase-status--error');
    return;
  }
  status.hidden = false;
  status.textContent = msg;
  status.classList.toggle('guardia-entrega-phase-status--error', isError);
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
    return;
  }
  setEntregaToolbarStatus(msg, type === 'error');
}

${sliceLines(cent, 247, 312)}

export {
  normalizeUsers,
  userOptionLabel,
  uniqueByUserId,
  dbApi,
  toast,
  setEntregaToolbarStatus,
  resolveEntregaPatientRow,
  clinicalDbApi,
  entregaModalEl,
};
`
);

write(
  'clinical-entrega/clinical-entrega-targets.mjs',
  `// Entrega target user lists by rank / scope
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import {
  getJoinedTeams,
  isOnCallToday,
  salaOnCallR1,
  salaOnCallR2,
} from '../../clinico-access.mjs';
import { mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import { normalizeUsers, uniqueByUserId } from './clinical-entrega-util.mjs';

${sliceLines(cent, 90, 218)}
`
);

let teamBody = `// Census / source team resolution for entrega
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { getJoinedTeams } from '../../clinico-access.mjs';
import { hasElevatedTeamPrivileges } from '../../clinical-privileges.mjs';
import { teamLabelById } from '../../patient-team-assign-ui.mjs';
import {
  patientForScopeEvaluate,
  resolvePatientCensusTeamId,
} from '../patients-clinical-filter.mjs';
import {
  clinicalDbApi,
  resolveEntregaPatientRow,
} from './clinical-entrega-util.mjs';

${sliceLines(cent, 283, 428)}
`;
teamBody = teamBody
  .replace('async function lookupEntregaCensusTeamId', 'export async function lookupEntregaCensusTeamId')
  .replace('function resolveDefaultSourceTeamIdForUser', 'function resolveDefaultSourceTeamIdForUser')
  .replace('function entregaTeamOptionLabel', 'export function entregaTeamOptionLabel')
  .replace('function findEntregaTeamById', 'export function findEntregaTeamById');
write('clinical-entrega/clinical-entrega-team.mjs', teamBody);

write(
  'clinical-entrega/clinical-entrega-phase.mjs',
  `// Entrega phase (handoff turn) lifecycle
import { clinicalSessionContext, fetchClinicalScopeContextFromDb } from '../../clinical-access-runtime.mjs';
import {
  getJoinedTeams,
  salaOnCallR1,
  userIsOnGuardiaCallToday,
} from '../../clinico-access.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { ensureGuardiaHoyBeforeEntrega, mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import {
  openEntregaRosterPanel,
  closeEntregaRosterPanel,
  isEntregaRosterOpen,
} from '../entrega-roster-panel.mjs';
import {
  normalizeUsers,
  userOptionLabel,
  toast,
  setEntregaToolbarStatus,
} from './clinical-entrega-util.mjs';
import { collectEntregaScopeUsers } from './clinical-entrega-targets.mjs';
import { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY } from './clinical-entrega-constants.mjs';

${sliceLines(cent, 1018, 1272)}
`
);

write(
  'clinical-entrega/clinical-entrega-submit.mjs',
  `// Persist entrega assignment + form payload
import {
  clinicalSessionContext,
  refreshGuardiaCensusFromDb,
  signOutgoingLiveSyncMutation,
  getClinicalScopeContextForEvaluate,
} from '../../clinical-access-runtime.mjs';
import {
  buildEntregaPatientCensus,
  serializePendientesJson,
} from '../../../lib/entrega/entrega-pendientes.mjs';
import { vitalsFrequencyForDb } from '../../../lib/entrega/entrega-vitals-plan.mjs';
import {
  getEntregaDraftItems,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  readEntregaVitalsPlan,
} from '../entrega-modal-ui.mjs';
import { dbApi, toast, resolveEntregaPatientRow } from './clinical-entrega-util.mjs';
import { resolveEntregaSourceTeamId } from './clinical-entrega-team.mjs';
import { getEntregaPhaseCoveringUserId } from './clinical-entrega-phase.mjs';

${sliceLines(cent, 441, 581)}
`
);

write(
  'clinical-entrega/clinical-entrega-modal.mjs',
  `// Entrega modal open/close + form wiring
import {
  clinicalSessionContext,
  fetchClinicalScopeContextFromDb,
  refreshGuardiaCensusFromDb,
  getClinicalScopeContextForEvaluate,
} from '../../clinical-access-runtime.mjs';
import { computeSalaAbcdefDeficitWrite, effectiveClinicalRank } from '../../clinico-access.mjs';
import { closeModalAnimated } from '../../ui-motion.mjs';
import {
  mountEntregaPendientesUi,
  resetEntregaModalUi,
  resolveEntregaActorRole,
} from '../entrega-modal-ui.mjs';
import { mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import {
  entregaModalEl,
  resolveEntregaPatientRow,
  toast,
  userOptionLabel,
} from './clinical-entrega-util.mjs';
import {
  collectEntregaScopeUsers,
  ensureEntregaTargetUser,
  listEntregaTargets,
} from './clinical-entrega-targets.mjs';
import {
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
  findEntregaTeamById,
  lookupEntregaCensusTeamId,
  resolveEntregaSourceTeamId,
  entregaTeamOptionLabel,
} from './clinical-entrega-team.mjs';
import { persistEntregaFormState } from './clinical-entrega-submit.mjs';
import {
  getEntregaPhase,
  getEntregaPhaseCoveringUserId,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
} from './clinical-entrega-phase.mjs';

let entregaFormWired = false;
let entregaNavBusy = false;

${sliceLines(cent, 586, 1007)}
`
);

write(
  'clinical-entrega.mjs',
  `/**
 * Entrega (handoff) modal — assign active_guardias with rank-based eligibility (façade).
 */
import { resolveEntregaActorRole as resolveEntregaActorRoleImpl } from './entrega-modal-ui.mjs';
import { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY } from './clinical-entrega/clinical-entrega-constants.mjs';
import {
  ensureEntregaTargetUser,
  collectEntregaScopeUsers,
  listEntregaTargets,
} from './clinical-entrega/clinical-entrega-targets.mjs';
import {
  resolveEntregaSourceTeamId,
  resolveEntregaCensusTeamId,
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
} from './clinical-entrega/clinical-entrega-team.mjs';
import {
  submitEntregaAssignment,
  collectEntregaFormPayload,
  persistEntregaFormState,
} from './clinical-entrega/clinical-entrega-submit.mjs';
import { openEntregaModal, closeEntregaModal } from './clinical-entrega/clinical-entrega-modal.mjs';
import {
  resolveR1GuardiaCovering,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
  getEntregaPhase,
  isEntregaPhaseActive,
  getEntregaPhaseCoveringUserId,
  startEntregaPhase,
  endEntregaPhase,
  endEntregaPhaseFlow,
  beginEntregaPhaseFlow,
  toggleEntregaPhase,
  loadGuardiaGridViewContext,
  saveGuardiaGridMode,
} from './clinical-entrega/clinical-entrega-phase.mjs';

export function resolveEntregaActorRole(currentUser, existingGuardia) {
  return resolveEntregaActorRoleImpl(currentUser, existingGuardia);
}

export { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY };
export {
  ensureEntregaTargetUser,
  collectEntregaScopeUsers,
  listEntregaTargets,
  resolveEntregaSourceTeamId,
  resolveEntregaCensusTeamId,
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
  submitEntregaAssignment,
  collectEntregaFormPayload,
  persistEntregaFormState,
  openEntregaModal,
  closeEntregaModal,
  resolveR1GuardiaCovering,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
  getEntregaPhase,
  isEntregaPhaseActive,
  getEntregaPhaseCoveringUserId,
  startEntregaPhase,
  endEntregaPhase,
  endEntregaPhaseFlow,
  beginEntregaPhaseFlow,
  toggleEntregaPhase,
  loadGuardiaGridViewContext,
  saveGuardiaGridMode,
};
`
);

// Add exports to expediente submodules
const atbBody = read('expediente/expediente-cultivos-atb-ui.mjs');
if (!atbBody.includes('export function buildCultivoAntibiogramCellHtmlForPatient')) {
  write(
    'expediente/expediente-cultivos-atb-ui.mjs',
    atbBody.replace(
      'export function buildCultivoAntibiogramCellHtmlForPatient',
      'export function buildCultivoAntibiogramCellHtmlForPatient'
    )
  );
}

const tableBody = read('expediente/expediente-cultivos-table.mjs');
write(
  'expediente/expediente-cultivos-table.mjs',
  `${tableBody.trim()}

export {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  invalidateCultivosTableCache,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
};
`
);

const paseBody = read('expediente/expediente-cultivos-pase.mjs');
write(
  'expediente/expediente-cultivos-pase.mjs',
  `${paseBody.trim()}

export { formatPaseCultivoResistenciasHtml, paseCultivoAtbBlockHtml };
`
);

const atb2 = read('expediente/expediente-cultivos-atb-ui.mjs');
write(
  'expediente/expediente-cultivos-atb-ui.mjs',
  `${atb2.trim()}

export { wireAtbRisHoverPanels, removeAtbRisPanelsFromBody };
`
);

console.log('Split complete. Line counts:');
const files = [
  'expediente.mjs',
  'expediente/expediente-runtime.mjs',
  'expediente/expediente-cultivos-parse.mjs',
  'expediente/expediente-cultivos-atb-ui.mjs',
  'expediente/expediente-cultivos-table.mjs',
  'expediente/expediente-cultivos-pase.mjs',
  'expediente/expediente-listado.mjs',
  'expediente/expediente-datos.mjs',
  'clinical-entrega.mjs',
  'clinical-entrega/clinical-entrega-constants.mjs',
  'clinical-entrega/clinical-entrega-util.mjs',
  'clinical-entrega/clinical-entrega-targets.mjs',
  'clinical-entrega/clinical-entrega-team.mjs',
  'clinical-entrega/clinical-entrega-submit.mjs',
  'clinical-entrega/clinical-entrega-modal.mjs',
  'clinical-entrega/clinical-entrega-phase.mjs',
  'entrega-modal-ui.mjs',
  'entrega-modal-ui/entrega-modal-state.mjs',
  'entrega-modal-ui/entrega-modal-time.mjs',
  'entrega-modal-ui/entrega-modal-procedures.mjs',
  'entrega-modal-ui/entrega-modal-handoff.mjs',
  'entrega-modal-ui/entrega-modal-vitals.mjs',
];
let max = 0;
for (const f of files) {
  const n = lineCount(f);
  if (n > max) max = n;
  console.log(`  ${n}\t${f}`);
}
console.log(`Max lines: ${max}`);
