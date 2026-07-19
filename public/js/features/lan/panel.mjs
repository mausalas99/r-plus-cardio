/**
 * LAN connection panel UI (IM-11).
 */

import { LanSseClient } from '../../lan-sse-client.mjs';
import { createLanConnectionManager } from '../../lan-connection-manager.mjs';
import { lanNetworkProfile } from '../../lan-network-profile.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import { createPanelRankSections } from './panel-rank-sections.mjs';
import { createPanelDiagnostics } from './panel-diagnostics.mjs';
import { createPanelHostPin } from './panel-host-pin.mjs';
import { createPanelScanHosts, isLanAutoDiscoveryActive } from './panel-scan-hosts.mjs';
import {
  readLanKnownRooms,
  forgetLanRoomSession,
  rememberLanRoomJoined,
  updateLanConnectionBanner,
  patchLanPanelJoinButtons,
  dismissLanDisconnectBanner,
  setLanHideDisconnectBannerFromUi,
  wireLanPanelKnownSessionsChrome,
} from './panel-known-sessions.mjs';
import { createPanelInviteJoin } from './panel-invite-join.mjs';
import { createPanelRenderOnce } from './panel-render-once.mjs';
import { getLanRuntime } from './orchestrator-runtime.mjs';
import {
  wireClinicalOpsLanSyncEvents as wireClinicalOpsLanSyncEventsImpl,
  wireLanPanelDelegation as wireLanPanelDelegationImpl,
} from './panel-delegation.mjs';
import { getClinicalRank, getUserSala, getClinicalUserUserId } from './panel-clinical-context.mjs';
import { resolveAutoJoinRoomId, lanHubStatusCopy } from './panel-hub-status.mjs';
import {
  isLanConnectionDropdownOpen,
  captureConnectionDropdownScrollTop,
  restoreConnectionDropdownScrollTop,
  normalizeLanPanelRenderOpts,
  createPanelConnectionChrome,
} from './panel-connection-chrome.mjs';
import { createPanelRoomActions } from './panel-room-actions.mjs';
import {
  leaveLiveSyncRoom,
  resumeAutoHostDetectAndReconnect,
  syncLiveSyncStatusChrome,
} from './room.mjs';

import { esc } from '../../dom-escape.mjs';
import { isCardionotasLanUiEnabled } from '../cardio/cardionotas-gates.mjs';
var _lanPanelRenderGen = 0;
var _lanPanelRenderChain = Promise.resolve();
// Scan interval adapts to network profile — call getLanScanIntervalMs() where set.
var _lanLastPingAt = null;
var _lanLastPingStatus = 0;
var _lanLastPingRttMs = 0;
/** @type {ReturnType<typeof createLanConnectionManager> | null} */
var connectionManager = null;

function lanHostUrl() {
  return lanClient.baseUrl();
}

function getConnectionManager() {
  if (!connectionManager) {
    connectionManager = createLanConnectionManager({
      lanClient,
      sseClientFactory: function () {
        return new LanSseClient();
      },
    });
  }
  return connectionManager;
}

// Stop auto-discovery when network goes OFFLINE; restart timer when profile changes.

wireLanPanelKnownSessionsChrome({ lanClient, syncLiveSyncStatusChrome });

lanNetworkProfile.subscribeNetworkProfile(function (newProfile) {
  if (newProfile === 'offline') {
    stopLanAutoDiscovery();
    return;
  }
  if (isLanAutoDiscoveryActive()) {
    stopLanAutoDiscovery();
    startLanAutoDiscovery();
  }
});

/** @type {{ runtime?: object } | null} */
let panelRuntime = null;

export function registerLanSyncPanelRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  panelRuntime = Object.assign(panelRuntime || {}, ctx);
}

function runtime() {
  const fallbacks = {
    showToast() {},
    isMobileWeb() {
      return false;
    },
    renderPatientList() {},
    closeSettingsDropdown() {},
    appendLanConflictDraftsSection: null,
  };
  // Live orchestrator runtime wins over the wire-time snapshot (showToast is stub until registerLanRuntime).
  return Object.assign({}, fallbacks, panelRuntime || {}, getLanRuntime());
}

function bumpPanelRenderGen() {
  return ++_lanPanelRenderGen;
}

function buildPanelDelegationDeps() {
  return {
    runtime,
    renderLanPanel,
    refreshClinicalSessionTeams,
    joinLanFromInviteUi: function (btn) {
      return ensurePanelInviteJoin().joinLanFromInviteUi(btn);
    },
    saveLanSettingsFromUi,
    mintMobileLanPairingFromUi,
    mintSalaLanPairingFromUi,
    deleteLanRoom,
    reconnectFromOfflineUi,
  };
}

export function wireClinicalOpsLanSyncEvents() {
  wireClinicalOpsLanSyncEventsImpl(buildPanelDelegationDeps());
}

export function wireLanPanelDelegation() {
  wireLanPanelDelegationImpl(buildPanelDelegationDeps());
}

/** @type {ReturnType<typeof createPanelRenderOnce>|null} */
let panelRenderOnce = null;

function ensurePanelRenderOnce() {
  if (!panelRenderOnce) {
    panelRenderOnce = createPanelRenderOnce({
      runtime,
      bumpRenderGen: bumpPanelRenderGen,
      isRenderStale: lanPanelRenderStale,
      refreshLanPanelChromeInPlace,
      lanPanelHasBuiltChrome,
      lanPanelNeedsFullRebuild,
      renderLanPreflightUx,
      appendLanShiftPinSection,
      appendLanHostAddressCopyButton,
      appendLanShiftPinClientConnectSection,
      appendLanTurnResetAlertStrip,
      appendLanMobileJoinSection,
      appendLanMobileSharerCard,
      appendLanJoinOtherMacSection,
      appendLanInviteShareCards,
      appendLanBackToLocalHostSection,
      canOfferMobileLanShare,
      buildR1Section,
      buildR2Section,
      buildR4Section,
      appendLanHostPinSection,
      appendLanSyncDiagnosticsSection,
      purgeDuplicateLanShiftPinCards,
    });
  }
  return panelRenderOnce;
}

async function renderLanPanelOnce(force) {
  return ensurePanelRenderOnce().renderLanPanelOnce(force);
}


function lanPanelRenderStale(gen) {
  return gen !== _lanPanelRenderGen;
}

/** Update diagnostics block without rebuilding the whole ⇄ panel (keeps <details> open). */
async function refreshLanSyncDiagnosticsInPlace() {
  return ensurePanelDiagnostics().refreshLanSyncDiagnosticsInPlace();
}

/**
 * @param {{ force?: boolean } | undefined} [opts] Pass `{ force: true }` after explicit user actions in ⇄.
 */
export function renderLanPanel(opts) {
  if (!isCardionotasLanUiEnabled()) {
    var root = document.getElementById('lan-connection-panel-root');
    if (root) root.innerHTML = '';
    return Promise.resolve();
  }
  var o = normalizeLanPanelRenderOpts(opts);
  if (!o.force && !isLanConnectionDropdownOpen()) {
    return _lanPanelRenderChain;
  }
  if (!o.force && isLanConnectionDropdownOpen()) {
    void refreshLanPanelChromeInPlace();
    patchLanPanelJoinButtons();
    return _lanPanelRenderChain;
  }
  _lanPanelRenderChain = _lanPanelRenderChain
    .catch(function () {})
    .then(function () {
      return renderLanPanelOnce(o.force);
    });
  return _lanPanelRenderChain;
}

/** @type {ReturnType<typeof createPanelHostPin>|null} */
let panelHostPin = null;

/** @type {ReturnType<typeof createPanelInviteJoin>|null} */
let panelInviteJoin = null;

/** @type {ReturnType<typeof createPanelConnectionChrome>|null} */
let panelConnectionChrome = null;

function ensurePanelConnectionChrome() {
  if (!panelConnectionChrome) {
    panelConnectionChrome = createPanelConnectionChrome({
      runtime,
      esc,
      renderLanPanel,
      refreshLanSyncDiagnosticsInPlace,
      renderLanPreflightUx,
      wireLanPanelDelegation,
      resumeAutoHostDetectAndReconnect,
      focusLanShiftPinInput: function () {
        return ensurePanelInviteJoin().focusLanShiftPinInput();
      },
    });
  }
  return panelConnectionChrome;
}

function purgeDuplicateLanShiftPinCards(root) {
  if (!root) return;
  var cards = root.querySelectorAll('[data-lan-shift-pin]');
  for (var i = 0; i < cards.length - 1; i += 1) {
    cards[i].remove();
  }
}

async function refreshLanPanelChromeInPlace() {
  return ensurePanelConnectionChrome().refreshLanPanelChromeInPlace();
}

function requestRenderLanPanelAfterScan() {
  return ensurePanelConnectionChrome().requestRenderLanPanelAfterScan();
}

function lanPanelHasBuiltChrome(root) {
  return ensurePanelConnectionChrome().lanPanelHasBuiltChrome(root);
}

function lanPanelNeedsFullRebuild(root) {
  return ensurePanelConnectionChrome().lanPanelNeedsFullRebuild(root);
}

/** @type {ReturnType<typeof createPanelRoomActions>|null} */
let panelRoomActions = null;

function ensurePanelRoomActions() {
  if (!panelRoomActions) {
    panelRoomActions = createPanelRoomActions({
      runtime,
      renderLanPanel,
      getConnectionManager,
      copyLanInviteLinkFromUi: function (opts) {
        return ensurePanelInviteJoin().copyLanInviteLinkFromUi(opts);
      },
      readPingState: function () {
        return { at: _lanLastPingAt, status: _lanLastPingStatus, rttMs: _lanLastPingRttMs };
      },
      writePingState: function (patch) {
        if (patch.at !== undefined) _lanLastPingAt = patch.at;
        if (patch.status !== undefined) _lanLastPingStatus = patch.status;
        if (patch.rttMs !== undefined) _lanLastPingRttMs = patch.rttMs;
      },
      startLanAutoDiscovery: function () {
        return ensurePanelScanHosts().startLanAutoDiscovery();
      },
    });
  }
  return panelRoomActions;
}

export async function saveLanHostTeamCodeFromUi() {
  return ensurePanelRoomActions().saveLanHostTeamCodeFromUi();
}

export async function resetLanSquadHostStateFromUi() {
  return ensurePanelRoomActions().resetLanSquadHostStateFromUi();
}

export async function saveLanSettingsFromUi(opts) {
  return ensurePanelRoomActions().saveLanSettingsFromUi(opts);
}

export async function createLanRoomFromUi() {
  return ensurePanelRoomActions().createLanRoomFromUi();
}

export async function deleteLanRoom(roomId) {
  return ensurePanelRoomActions().deleteLanRoom(roomId);
}

export function dismissLanHostFirstTimeHint() {
  return ensurePanelRoomActions().dismissLanHostFirstTimeHint();
}

export async function reconnectFromOfflineUi() {
  return ensurePanelRoomActions().reconnectFromOfflineUi();
}

export function syncSettingsLanHostDiskSection() {
  return ensurePanelRoomActions().syncSettingsLanHostDiskSection();
}

export async function syncLanHostTeamCodeSettingsInput() {
  return ensurePanelRoomActions().syncLanHostTeamCodeSettingsInput();
}

export function closeConnectionDropdown() {
  return ensurePanelConnectionChrome().closeConnectionDropdown();
}

export function openConnectionDropdown() {
  if (!isCardionotasLanUiEnabled()) return;
  return ensurePanelConnectionChrome().openConnectionDropdown();
}

export function toggleConnectionDropdown(ev) {
  if (!isCardionotasLanUiEnabled()) return;
  return ensurePanelConnectionChrome().toggleConnectionDropdown(ev);
}

export function openTeamSyncFromHeader() {
  return ensurePanelConnectionChrome().openTeamSyncFromHeader();
}


function ensurePanelInviteJoin() {
  if (!panelInviteJoin) {
    panelInviteJoin = createPanelInviteJoin({
      runtime,
      esc,
      renderLanPanel,
    });
  }
  return panelInviteJoin;
}

function canOfferMobileLanShare() {
  return ensurePanelInviteJoin().canOfferMobileLanShare();
}

function appendLanMobileSharerCard(root) {
  ensurePanelInviteJoin().appendLanMobileSharerCard(root);
}

function appendLanMobileJoinSection(root) {
  ensurePanelInviteJoin().appendLanMobileJoinSection(root);
}

function appendLanJoinOtherMacSection(root, opts) {
  ensurePanelInviteJoin().appendLanJoinOtherMacSection(root, opts);
}

function appendLanInviteShareCards(root) {
  ensurePanelInviteJoin().appendLanInviteShareCards(root);
}

function appendLanBackToLocalHostSection(root) {
  ensurePanelInviteJoin().appendLanBackToLocalHostSection(root);
}

export async function mintMobileLanPairingFromUi() {
  return ensurePanelInviteJoin().mintMobileLanPairingFromUi();
}

export function mintSalaLanPairingFromUi() {
  return ensurePanelInviteJoin().mintSalaLanPairingFromUi();
}

export async function copyMobileLanLinkFromUi(opts) {
  return ensurePanelInviteJoin().copyMobileLanLinkFromUi(opts);
}

export async function copyLanInviteLinkFromUi(opts) {
  return ensurePanelInviteJoin().copyLanInviteLinkFromUi(opts);
}

export function readLanInviteInputValue(nearEl) {
  return ensurePanelInviteJoin().readLanInviteInputValue(nearEl);
}

export function joinLanFromInviteUi(fromBtn) {
  return ensurePanelInviteJoin().joinLanFromInviteUi(fromBtn);
}

export function focusLanShiftPinInput() {
  return ensurePanelInviteJoin().focusLanShiftPinInput();
}

export function prefillLanShiftPinHostUrl(hostUrl) {
  return ensurePanelInviteJoin().prefillLanShiftPinHostUrl(hostUrl);
}

export {
  readLanKnownRooms,
  forgetLanRoomSession,
  rememberLanRoomJoined,
  updateLanConnectionBanner,
  dismissLanDisconnectBanner,
  setLanHideDisconnectBannerFromUi,
  patchLanPanelJoinButtons,
  lanHubStatusCopy,
  resolveAutoJoinRoomId,
};

export { bootLanRoomMembership } from './room.mjs';


function ensurePanelHostPin() {
  if (!panelHostPin) {
    panelHostPin = createPanelHostPin({
      runtime,
      renderLanPanel,
      lanHostUrl,
      lanPanelRenderStale,
      getLanClient: function () {
        return lanClient;
      },
      leaveLiveSyncRoom,
      resumeAutoHostDetectAndReconnect,
      focusLanShiftPinInput,
    });
  }
  return panelHostPin;
}

function appendLanHostPinSection(root) {
  ensurePanelHostPin().appendLanHostPinSection(root);
}

async function appendLanTurnResetAlertStrip(root, gen) {
  return ensurePanelHostPin().appendLanTurnResetAlertStrip(root, gen);
}

export async function resetLanTurnConnectionFromUi() {
  return ensurePanelHostPin().resetLanTurnConnectionFromUi();
}

async function appendLanShiftPinClientConnectSection(root, gen) {
  return ensurePanelHostPin().appendLanShiftPinClientConnectSection(root, gen);
}

function appendLanHostAddressCopyButton(root, gen) {
  ensurePanelHostPin().appendLanHostAddressCopyButton(root, gen);
}

async function appendLanShiftPinSection(root, gen) {
  return ensurePanelHostPin().appendLanShiftPinSection(root, gen);
}

/** @type {ReturnType<typeof createPanelDiagnostics>|null} */
let panelDiagnostics = null;

function ensurePanelDiagnostics() {
  if (!panelDiagnostics) {
    panelDiagnostics = createPanelDiagnostics({
      runtime,
      renderLanPanel,
      esc,
      getConnectionManager,
      lanHostUrl,
      getActiveLiveSyncRoomId: function () {
        return activeLiveSyncRoomId;
      },
      getLanClient: function () {
        return lanClient;
      },
      getLastPing: function () {
        return { at: _lanLastPingAt, status: _lanLastPingStatus, rttMs: _lanLastPingRttMs };
      },
      isLanConnectionDropdownOpen,
      captureConnectionDropdownScrollTop,
      restoreConnectionDropdownScrollTop,
    });
  }
  return panelDiagnostics;
}

async function renderLanPreflightUx(root) {
  return ensurePanelDiagnostics().renderLanPreflightUx(root);
}

async function appendLanSyncDiagnosticsSection(root) {
  return ensurePanelDiagnostics().appendLanSyncDiagnosticsSection(root);
}

/** @type {ReturnType<typeof createPanelRankSections>|null} */
let panelRankSections = null;

function ensurePanelRankSections() {
  if (!panelRankSections) {
    panelRankSections = createPanelRankSections({
      runtime,
      getUserSala,
      getClinicalRank,
      getClinicalUserUserId,
      renderLanPanel,
    });
  }
  return panelRankSections;
}

function buildR1Section(root) {
  ensurePanelRankSections().buildR1Section(root);
}

function buildR2Section(root) {
  ensurePanelRankSections().buildR2Section(root);
}

function buildR4Section(root) {
  ensurePanelRankSections().buildR4Section(root);
}

export { classifyAutoJoinSource, hasLanAutoJoinConfirmed, setLanAutoJoinConfirmed } from './panel-hub-status.mjs';

export async function refreshClinicalSessionTeams() {
  return ensurePanelRankSections().refreshClinicalSessionTeams();
}

/** @type {ReturnType<typeof createPanelScanHosts>|null} */
let panelScanHosts = null;

function ensurePanelScanHosts() {
  if (!panelScanHosts) {
    panelScanHosts = createPanelScanHosts({
      runtime,
      lanHostUrl,
      refreshLanPanelChromeInPlace,
      requestRenderLanPanelAfterScan,
    });
  }
  return panelScanHosts;
}

function startLanAutoDiscovery() {
  return ensurePanelScanHosts().startLanAutoDiscovery();
}

function stopLanAutoDiscovery() {
  return ensurePanelScanHosts().stopLanAutoDiscovery();
}

export { startLanAutoDiscovery, stopLanAutoDiscovery };



