/**
 * LAN HTTP transport, pairing, and host URL resolution (IM-11) — public façade.
 */
export { registerLanSyncTransportDeps, ensureLanSyncTransportDepsWired } from './transport-deps.mjs';

export {
  trimStoredLanBearer,
  isLanSessionConfiguredForRest,
  persistLanClientConfig,
  ensureLanClientTeamCodeAligned,
  ensureLanGuestBearerFileFromConfig,
  syncLanGuestBearerFromDisk,
  lanFetchAuthed,
  resolveHostBearerToken,
  syncLanSavedTeamCodeWithEffectiveHostCode,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  maybeApplyLanHostUrlSwitch,
} from './transport-session.mjs';

export {
  isLanRestHostOwnMachine,
  shouldShowLanShiftPinClientConnect,
  shouldShowLanShiftPinHostDisplay,
  resolveLanShareBaseUrl,
  buildShareJoinUrl,
  resolveLanHostUrlAuto,
  resolveOwnLanBaseForPin,
  resolveLanTeamCodeForShare,
  resolveLanHostUrlForShare,
} from './transport-host-url.mjs';

export {
  mintLanPairingTicket,
  maybeShowLanMigrationNotice,
  exchangeLanJoinFromInvite,
  formatLanTicketExpiryLabel,
  lanTicketExpirySoon,
  ensureLanPairingForShare,
  getLastLanPairing,
  updateLanPairingDisplay,
  mintLanPairingFromUi,
} from './transport-pairing.mjs';

export {
  syncMobileWithSharedInvite,
  resumeMobileLanRoomJoin,
  configureLanFromMobileJoin,
} from './transport-mobile.mjs';

export {
  applyPinnedHostOverride,
  ensureLanElectronHostReady,
  pushBundleToHostUrl,
  consolidateIntoHost,
  reactToDiscoveredLanHost,
  promoteThisMacToLanHost,
  syncLanHostClinicalMetaToDisk,
  tryConnectToPinnedHost,
  tryAutoJoinPreferredLanHost,
  joinRemoteLanHostAsClient,
  initLanHostPlugAndPlay,
} from './transport-host-election.mjs';

export { initLanClientFromStorage } from './transport-init.mjs';
