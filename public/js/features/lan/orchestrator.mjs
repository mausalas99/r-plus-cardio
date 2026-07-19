// Built from app.js refactor — LAN / LiveSync façade (IM-11)
import {
  toggleConnectionDropdown,
  closeConnectionDropdown,
  openConnectionDropdown,
  openTeamSyncFromHeader,
  saveLanSettingsFromUi,
  joinLanFromInviteUi,
  createLanRoomFromUi,
  deleteLanRoom,
  copyLanInviteLinkFromUi,
  copyMobileLanLinkFromUi,
  saveLanHostTeamCodeFromUi,
  resetLanSquadHostStateFromUi,
  resetLanTurnConnectionFromUi,
  dismissLanHostFirstTimeHint,
  dismissLanDisconnectBanner,
  setLanHideDisconnectBannerFromUi,
  syncSettingsLanHostDiskSection,
  syncLanHostTeamCodeSettingsInput,
  renderLanPanel,
  focusLanShiftPinInput,
} from './panel.mjs';
import {
  isLanSessionConfiguredForRest,
  persistLanClientConfig,
  configureLanFromMobileJoin,
} from './transport.mjs';
import {
  joinLanRoom,
  getActiveLiveSyncRoomId,
  refreshLanClinicalDirectoryFromRoom,
  fetchAndApplyClinicalOpsFromHost,
} from './room.mjs';
import {
  pushClinicalOpsLanNow,
  scheduleLiveSyncPush,
} from './push.mjs';
import {
  emitLiveSyncAgendaUpsert,
  emitLiveSyncAgendaDelete,
  emitLiveSyncTodoUpsert,
  emitLiveSyncTodoDelete,
  emitLiveSyncPatientDelete,
} from './live-sync-emit.mjs';
import { appendLanConflictDraftsSection } from './conflicts.mjs';
import { touchPatientLanUpdatedAt } from './patient-entries.mjs';
import { wireLanSyncBridges } from './orchestrator-wire.mjs';
import { wireInternoHostSyncBridge } from './orchestrator-interno.mjs';
import { ensureLanSyncRuntimeStarted } from './orchestrator-boot.mjs';

export {
  registerLanRuntime,
  profiledMergeLiveSyncFullBundles,
  getLanRuntime,
} from './orchestrator-runtime.mjs';
export { hydrateLocalPatientMonitoreoFromHost, wireInternoHostSyncBridge } from './orchestrator-interno.mjs';
export { wireLanSyncBridges } from './orchestrator-wire.mjs';
export { ensureLanSyncRuntimeStarted } from './orchestrator-boot.mjs';
export {
  buildEstadoActualCommand,
  buildEventualidadAddCommand,
  buildPendienteCommand,
  registerLanSaveHooks,
} from './orchestrator-commands.mjs';

export { lanPushHistoriaClinica, lanPushHistoriaClinicaDelta, lanSyncPatientArchivedFlag, lanFetchHistoriaClinica } from './historia-sync.mjs';
export { acceptServerBundleConflict, acceptServerClinicalOpsConflict } from './conflicts.mjs';
export { rememberPatientDeleteTombstone, clearPatientDeleteTombstoneForAdmit, listPatientDeleteTombstones, clearPatientDeleteTombstones } from './entity-versions.mjs';
export { purgeLanPatientFromHost, removePatientLocally } from './patient-delete.mjs';
export {
  lanFetchHostPatientRow,
  lanPushPatientVersioned,
  restoreLanPatientFromHost,
} from './host-patient-http.mjs';

export {
  appendLanConflictDraftsSection,
  pushClinicalOpsLanNow,
  refreshLanClinicalDirectoryFromRoom,
  fetchAndApplyClinicalOpsFromHost,
  emitLiveSyncAgendaUpsert,
  emitLiveSyncAgendaDelete,
  emitLiveSyncTodoUpsert,
  emitLiveSyncTodoDelete,
  emitLiveSyncPatientDelete,
  scheduleLiveSyncPush,
  touchPatientLanUpdatedAt,
  renderLanPanel,
  configureLanFromMobileJoin,
  syncLanHostTeamCodeSettingsInput,
  closeConnectionDropdown,
  openConnectionDropdown,
  focusLanShiftPinInput,
  isLanSessionConfiguredForRest,
  joinLanRoom,
  getActiveLiveSyncRoomId,
  persistLanClientConfig,
  syncSettingsLanHostDiskSection,
};

wireLanSyncBridges();

if (typeof document !== 'undefined') {
  queueMicrotask(() => {
    wireInternoHostSyncBridge();
    ensureLanSyncRuntimeStarted();
  });
}

export const windowHandlers = {
  toggleConnectionDropdown,
  closeConnectionDropdown,
  openConnectionDropdown,
  openTeamSyncFromHeader,
  saveLanSettingsFromUi,
  saveLanHostTeamCodeFromUi,
  resetLanSquadHostStateFromUi,
  resetLanTurnConnectionFromUi,
  dismissLanHostFirstTimeHint,
  dismissLanDisconnectBanner,
  setLanHideDisconnectBannerFromUi,
  joinLanRoom,
  joinLanFromInviteUi,
  createLanRoomFromUi,
  deleteLanRoom,
  copyLanInviteLinkFromUi,
  copyMobileLanLinkFromUi,
};
