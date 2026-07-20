/**
 * Registro de runtimes de features (inyección de dependencias al cargar).
 */
import { storage } from './storage.js';
import { patients, saveState } from './app-state.mjs';
import { migrateToV3 } from './mode-features.mjs';
import {
  splitResLabsByTipo,
  primaryTipoForLabSet,
  buildLabSetDateLine,
  dayKeyFromLabSet,
  labSetIsFromSome,
  formatLabHistoryListMeta,
  formatLabHistoryDateSelectLabel,
  rebuildEstudiosFromLabHistory,
  ensureParsedLabHistory,
  ensureParsedLabHistoryCached,
} from './lab-history-set.mjs';
import { normalizeFechaLabHistory } from './tend-core.mjs';
import {
  showToast,
  syncWorkContextChrome,
  setMedTabAttention,
  guardMobileDocExport,
  requestDocumentJson,
  handleDocumentGenerateResponse,
  launchConfetti,
  applyDefaultsToNewPatient,
  applyDefaultsToNewIndicaciones,
  rpcPrefersReducedMotion,
} from './app-shell.mjs';
import {
  registerChromeRuntime,
} from './features/chrome.mjs';
import {
  registerLanRuntime,
  registerLanSaveHooks,
  scheduleLiveSyncPush,
} from './features/lan-sync.mjs';
import {
  registerPatientsRuntime,
  filterPatientsForGuardiaCensus,
} from './features/patients.mjs';
import {
  registerLabBulkPreviewModalRuntime,
  getBulkLabPreviewSourceText,
  isBulkLabPreviewModalOpen,
  suspendLabBulkPreviewModal,
} from './features/lab-bulk-preview-modal.mjs';
import {
  registerLabHistoryBatchCopyRuntime,
} from './features/lab-history-batch-copy-modal.mjs';
import { buildBulkLabPreview } from './lab-bulk-paste.mjs';
import {
  registerTodosRuntime,
} from './features/todos.mjs';
import {
  registerPaseBoardRuntime,
} from './features/pase-board.mjs';
import {
  registerMedicationsRuntime,
  registerMedPharmProfileRuntime,
} from './features/medications.mjs';
import {
  registerProfileRuntime,
  openProfileModal,
  closeProfileModal,
} from './features/profile.mjs';
import {
  registerSoapEstadoRuntime,
} from './features/soap-estado.mjs';
import {
  registerEstadoActualPanelRuntime,
  navigateToEstadoActualPanel,
  applyEstadoActualParsedToForm,
  renderEstadoActualPanel,
  ensureEaRegistroModalForm,
  resetEaRegistroForm,
  syncEaRegistroGluMode,
  toDatetimeLocalValue,
} from './features/estado-actual-panel.mjs';
import {
  registerEstadoActualPasteModalRuntime,
  wireEstadoActualPasteModal,
} from './features/estado-actual-paste-modal.mjs';
import {
  registerDriveImportRuntime,
  wireDriveImportModal,
} from './features/drive-import-modal.mjs';
import {
  registerEstadoActualRegistroModalRuntime,
  openEstadoActualRegistroModal,
  wireEaModalDismiss,
} from './features/estado-actual-registro-modal.mjs';
import { getDefaultRegistroRecordedAt } from './features/estado-actual-registro-defaults.mjs';
import {
  registerProcedureAgendaRuntime,
} from './features/agenda.mjs';
import {
  registerExpedienteRuntime,
} from './features/expediente.mjs';
import {
  registerHistoriaClinicaRuntime,
} from './features/historia-clinica-panel.mjs';
import { registerEventualidadesRuntime } from './features/eventualidades-panel.mjs';
import {
  extractParsedValues,
  buildParsedBySectionFromResLabs,
  renderDiagramas,
  toggleLabDiagramsSection,
  syncLabDiagramsCollapseUI,
} from './features/diagrams.mjs';
import {
  registerProductivityRuntime,
  pushUndoSnapshot,
} from './features/productivity.mjs';
import { registerCensoRuntime, syncCensoExportButtonVisibility } from './censo-export.mjs';
import {
  bindLazyLabsRuntimeCtx,
  bindLazyChartsRuntimeCtx,
  bindLazyPlatformRuntimeCtx,
  bindLazySettingsRuntimeCtx,
  bindLazyEaVitalHistoryRuntimeCtx,
  chartsRuntimeProxies,
  labsRuntimeProxies,
  platformRuntimeProxies,
  settingsHelpRuntimeProxies,
  registerLazyFeatureRuntimes,
} from './lazy-feature-routes.mjs';
import {
  registerNotesIndicacionesRuntime,
  renderNoteForm,
  renderIndicaForm,
} from './features/notes-indicaciones.mjs';
import {
  scheduleLabHistoryPostSaveMaintenance,
  installLabHistoryAuditHook,
  registerLabHistoryMaintRuntime,
} from './lab-history-set.mjs';
import {
  renderPatientList,
  selectPatient,
  scrollActiveRondaCardIntoView,
  renderRoundOverviewPanels,
  openAddModal,
  openAddModalFromLabPatient,
  findPatientByRegistro,
  ensureUniquePatientName,
  buildPatientEntry,
  setRoundOverviewMode,
  getRoundOverviewMode,
} from './features/patients.mjs';
import { isMobileWeb } from './mobile-web.mjs';
import {
  refreshAllTodoUIs,
  refreshTodoUIsForPatient,
  refreshTodoUIsForPatients,
  renderTodoForm,
} from './features/todos.mjs';
import {
  registerVpoRuntime,
  renderVpo,
} from './features/vpo.mjs';
import {
  registerRecetaHuRuntime,
  renderRecetaHu,
} from './features/receta-hu.mjs';
import {
  renderPaseBoard,
  switchAppTab,
  openPaseSectionInNormal,
  switchInnerTab,
  switchConsolidatedTab,
  invalidateInnerTabRenderCache,
  refreshExpedienteAfterPatientSelect,
  renderInnerTabs,
  syncInnerTabVisualOnly,
} from './features/pase-board.mjs';
import { renderGuardiaBoard } from './features/guardia-board.mjs';
import {
  renderMedRecetaPanel,
} from './features/medications.mjs';
import { renderCardioManejoAppTab } from './features/cardio/manejo-app-tab.mjs';
import {
  renderEstadoActualBar,
  renderEstadoActualButton,
  copyToClipboardSafe,
} from './features/soap-estado.mjs';
import {
  renderProcedureAgendaPanel,
} from './features/agenda.mjs';
import {
  refreshTendenciasOrCultivosPanel,
  renderListadoForm,
  removeAtbRisPanelsFromBody,
  wireAtbRisHoverPanels,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
} from './features/expediente.mjs';
import {
  emitLiveSyncTodoUpsert,
  syncSettingsLanHostDiskSection,
} from './features/lan-sync.mjs';
import {
  renderPatientDataPane,
} from './features/expediente.mjs';
import {
  advanceRondaPatient,
} from './features/patients.mjs';
import {
  initChromeAppearance,
} from './features/chrome.mjs';

const rt = {
  getActiveId() { return null; },
  setActiveId(_id) {},
  getActiveAppTab() { return 'lab'; },
  setActiveAppTab(_v) {},
  getActiveInner() { return 'todo'; },
  setActiveInner(_v) {},
  getSettings() { return {}; },
  setSettingsRef(_s) {},
};

let v3MigratedThisBoot = false;

export function wasV3MigratedThisBoot() {
  return v3MigratedThisBoot;
}

export function getAppRuntimeContext() {
  return rt;
}

export function registerAppRuntimeContext(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function buildRuntimeContextUiDeps() {
  return {
    showToast,
    navigateToEstadoActualPanel,
    refreshMedPanel: function refreshMedPanel() {
      if (!renderCardioManejoAppTab()) renderMedRecetaPanel();
    },
    syncWorkContextChrome,
    renderMedRecetaPanel,
    renderProcedureAgendaPanel,
    setMedTabAttention,
    ensureParsedLabHistory,
    ensureParsedLabHistoryCached,
    splitResLabsByTipo,
    primaryTipoForLabSet,
    formatLabHistoryListMeta: function (set) {
      return formatLabHistoryListMeta(set, chartsRuntimeProxies.inferFechaLabSetFromId);
    },
    formatLabHistoryDateSelectLabel: function (set) {
      return formatLabHistoryDateSelectLabel(
        set,
        chartsRuntimeProxies.inferFechaLabSetFromId,
        primaryTipoForLabSet
      );
    },
    switchAppTab,
    renderPatientList,
    scrollActiveRondaCardIntoView,
    renderGuardiaBoard: function () {
      return renderGuardiaBoard(rt.getSettings());
    },
    setRoundOverviewMode,
    renderPaseBoard,
    renderInnerTabs,
    invalidateInnerTabRenderCache,
    refreshExpedienteAfterPatientSelect,
    renderEstadoActualButton,
    renderEstadoActualPanel,
    renderPatientDataPane,
    renderNoteForm,
    renderIndicaForm,
    renderListadoForm,
    refreshTendenciasOrCultivosPanel,
    switchInnerTab,
    syncInnerTabVisualOnly,
    renderTodoForm,
    rpcPrefersReducedMotion,
    refreshAllTodoUIs,
    refreshTodoUIsForPatient,
    refreshTodoUIsForPatients,
    renderVpo,
    renderRecetaHu,
    pushUndoSnapshot,
    ...platformRuntimeProxies,
    applyDefaultsToNewPatient,
    applyDefaultsToNewIndicaciones,
    normalizeFechaLabHistory,
    buildLabSetDateLine,
    getRoundOverviewMode,
    saveState,
    emitLiveSyncTodoUpsert,
    requestDocumentJson,
    handleDocumentGenerateResponse,
    guardMobileDocExport,
    syncSettingsLanHostDiskSection,
    closeProfileModal,
    openProfileModal,
    openAddModalFromLabPatient,
    copyToClipboardSafe,
    ...chartsRuntimeProxies,
    renderRoundOverviewPanels,
    switchConsolidatedTab,
  };
}

function applyRuntimeParsedToForm(parsed, opts) {
  opts = opts || {};
  if (opts.fromNestedPaste) {
    applyEstadoActualParsedToForm(parsed);
    var recorded = document.getElementById('ea-recorded-at');
    if (recorded && 'value' in recorded) {
      recorded.value = toDatetimeLocalValue(getDefaultRegistroRecordedAt());
    }
    return;
  }
  navigateToEstadoActualPanel();
  renderEstadoActualPanel({
    onReady: function () {
      openEstadoActualRegistroModal({ preserveForm: true });
      applyEstadoActualParsedToForm(parsed);
      var recordedInner = document.getElementById('ea-recorded-at');
      if (recordedInner && 'value' in recordedInner) {
        recordedInner.value = toDatetimeLocalValue(getDefaultRegistroRecordedAt());
      }
    },
  });
}

function buildRuntimeContextFeatureDeps() {
  return {
    getActivePatient: function () {
      var id = rt.getActiveId();
      if (!id) return null;
      return (
        patients.find(function (p) {
          return String(p.id) === String(id);
        }) || null
      );
    },
    applyParsed: applyRuntimeParsedToForm,
    ensureForm: ensureEaRegistroModalForm,
    syncGluMode: syncEaRegistroGluMode,
    resetForm: function () {
      var activeId = rt.getActiveId();
      var patient =
        activeId &&
        patients.find(function (p) {
          return p.id === activeId;
        });
  resetEaRegistroForm(patient || null, { prefill: true });
    },
    selectPatient,
    ...settingsHelpRuntimeProxies,
    findPatientByRegistro,
    openPaseSectionInNormal,
    renderDiagramas,
    toggleLabDiagramsSection,
    syncLabDiagramsCollapseUI,
    extractParsedValues,
    ...labsRuntimeProxies,
    buildParsedBySectionFromResLabs,
    rebuildEstudiosFromLabHistory,
    dayKeyFromLabSet,
    labSetIsFromSome,
    removeAtbRisPanelsFromBody,
    wireAtbRisHoverPanels,
    isResLabChunkPureCultivo,
    buildCultivoOutputHtmlFragments,
    rebuildBulkLabPreviewBlocks: function (text) {
      return buildBulkLabPreview(text, { findPatientByRegistro });
    },
    getBulkLabPreviewSourceText,
    isBulkLabPreviewModalOpen,
    suspendLabBulkPreviewModal,
    openAddModal,
    advanceRondaPatient,
    isMobileWeb,
    ensureUniquePatientName,
    buildPatientEntry,
    onMedicionRegistered: function () {
      settingsHelpRuntimeProxies.guidedTourAdvanceAfter('estado_actual_registro');
      scheduleLiveSyncPush();
    },
    launchConfetti,
    renderEstadoActualBar,
  };
}

function installAppRuntimeContextDeps() {
  bindLazyPlatformRuntimeCtx(rt);
  bindLazySettingsRuntimeCtx(rt);
  Object.assign(rt, buildRuntimeContextUiDeps(), buildRuntimeContextFeatureDeps());
}

export async function registerAllFeatureRuntimes() {
  installAppRuntimeContextDeps();
  var ctx = getAppRuntimeContext();

  registerMedicationsRuntime(ctx);
  registerMedPharmProfileRuntime(ctx);
  registerProfileRuntime(ctx);
  registerPaseBoardRuntime(ctx);
  registerChromeRuntime(ctx);
  registerPatientsRuntime(ctx);
  bindLazyLabsRuntimeCtx(ctx);
  bindLazyChartsRuntimeCtx(ctx);
  bindLazyEaVitalHistoryRuntimeCtx(ctx);

  v3MigratedThisBoot = migrateToV3(rt.getSettings());
  if (v3MigratedThisBoot) storage.saveSettings(rt.getSettings());

  await registerLazyFeatureRuntimes(ctx);

  registerLabHistoryMaintRuntime(ctx);
  installLabHistoryAuditHook();
  registerLanSaveHooks({ scheduleLabHistoryPostSaveMaintenance });

  registerTodosRuntime(ctx);
  const reminderScheduler = await import('./todos-reminder-scheduler.mjs');
  reminderScheduler.configureTodoReminderScheduler({
    getPatientLabel: function (pid) {
      var p = patients.find(function (row) {
        return row.id === pid;
      });
      return p && p.name ? String(p.name) : String(pid || '');
    },
    showToast: showToast,
  });
  reminderScheduler.rescheduleAllTodos();
  registerVpoRuntime(ctx);
  registerRecetaHuRuntime(ctx);
  registerCensoRuntime(
    Object.assign({}, ctx, {
      getCensusPatients: function () {
        return filterPatientsForGuardiaCensus(patients);
      },
    })
  );
  registerHistoriaClinicaRuntime(ctx);
  registerEventualidadesRuntime(ctx);
  registerExpedienteRuntime(ctx);
  registerNotesIndicacionesRuntime(ctx);
  registerProcedureAgendaRuntime(ctx);
  registerSoapEstadoRuntime(ctx);
  registerEstadoActualPanelRuntime(ctx);
  registerDriveImportRuntime(ctx);
  registerEstadoActualPasteModalRuntime(ctx);
  registerEstadoActualRegistroModalRuntime(ctx);
  registerLabBulkPreviewModalRuntime(ctx);
  registerLabHistoryBatchCopyRuntime(ctx);
  registerProductivityRuntime(ctx);
  registerLanRuntime(ctx);
}

export function runInitialFeatureBoot() {
  initChromeAppearance();
  wireEstadoActualPasteModal();
  wireDriveImportModal();
  wireEaModalDismiss();
  syncCensoExportButtonVisibility();
}
