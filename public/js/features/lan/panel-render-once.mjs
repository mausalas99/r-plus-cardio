/**
 * Full LAN ⇄ panel rebuild (renderLanPanelOnce) — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { hasElevatedTeamPrivileges, canManageInternoQr } from '../../clinical-privileges.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { appendLanHubStatusHero, appendLanHubRoomsCard } from '../lan-hub-panel-shell.mjs';
import { appendInternoQrPanel } from '../interno-qr-panel.mjs';
import { appendEquiposQrPanel } from '../equipos-qr-panel.mjs';
import { getEquiposCloudConfig } from '../../equipos-cloud-config.mjs';
import { LIVE_SYNC_SALA_DEFS } from '../../lan-join-link.mjs';
import { getPinnedHostUrl, isPinnedHostLocal } from '../../lan-host-pin.mjs';
import { canLocalMacBeLanHost, isClinicalRankConfiguredForLan } from '../../lan-host-rank-policy.mjs';
import {
  isLanSessionConfiguredForRest,
  isLanElectronDesktop,
  syncLanHostClinicalMetaToDisk,
  ensureLanElectronHostReady,
  applyPinnedHostOverride,
  getLanTeamCodeFromConfig,
  resolveLanHostUrlAuto,
  resolveOwnLanBaseForPin,
} from './transport.mjs';
import { activeLiveSyncRoomId } from './runtime.mjs';
import { appendLanPanelGuardCards_ } from './panel-render-guards.mjs';
import { lanHubStatusCopy, shouldOmitLanHubStatusHint } from './panel-hub-status.mjs';
import {
  patchLanPanelJoinButtons,
  wireLanLwwToastPref,
  syncLanLwwOverwriteToastPrefUi,
} from './panel-known-sessions.mjs';
import {
  isLanConnectionDropdownOpen,
  captureConnectionDropdownScrollTop,
  restoreConnectionDropdownScrollTop,
  captureLanPanelExpandState,
  restoreLanPanelExpandState,
} from './panel-connection-chrome.mjs';
import { lanNetworkProfile } from '../../lan-network-profile.mjs';
import { appendLanHostPatientsSection } from './host-patients-panel.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import {
  getClinicalRank,
  getUserSala,
  isClinicalRegistered,
  getClinicalUserUserId,
  isLanHostActive,
} from './panel-clinical-context.mjs';
import { appendLanConnectionStack, appendLanAdminStack } from './panel-group.mjs';
import { appendLanLwwToastRow } from './panel-lww-pref.mjs';

/** @param {ReturnType<typeof createPanelRenderOnce> extends never ? object : Parameters<typeof createPanelRenderOnce>[0]} deps */
function maybeAppendInternoQrPanel_(deps, root) {
  if (!isLanElectronDesktop() || !isLanHostActive()) return;
  if (!canManageInternoQr(clinicalSessionContext.user)) return;
  void resolveLanHostUrlAuto().then(function (hostBaseUrl) {
    void appendInternoQrPanel(root, {
      hostBaseUrl: hostBaseUrl,
      userId: getClinicalUserUserId(),
    });
  });
}

function maybeAppendEquiposQrPanel_(deps, root) {
  if (!isLanElectronDesktop()) return;
  if (!canManageInternoQr(clinicalSessionContext.user)) return;
  const cloud = getEquiposCloudConfig();
  if (!cloud.enabled && !isLanHostActive()) return;
  void resolveLanHostUrlAuto().then(function (hostBaseUrl) {
    void appendEquiposQrPanel(root, {
      hostBaseUrl: hostBaseUrl,
      userId: getClinicalUserUserId(),
    });
  });
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
async function syncLanHostBeforeRender_(deps, rankConfigured) {
  if (!rankConfigured) return;
  try {
    await syncLanHostClinicalMetaToDisk();
    var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
    var pinned = getPinnedHostUrl();
    if (pinned) {
      if (uiRole === 'host') {
        var ownUrl = await resolveOwnLanBaseForPin();
        if (isPinnedHostLocal(ownUrl)) {
          await applyPinnedHostOverride(getLanTeamCodeFromConfig(), { quiet: true, boot: true });
        }
      } else {
        await applyPinnedHostOverride(getLanTeamCodeFromConfig(), { quiet: true, boot: true });
      }
    } else if (uiRole === 'host' && canLocalMacBeLanHost()) {
      await ensureLanElectronHostReady();
    }
  } catch {
    // Non-fatal — still render panel so ⇄ stays usable offline.
  }
}

/**
 * @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps
 * @returns {Promise<boolean>} true when render should stop after in-place refresh
 */
async function tryRefreshChromeInPlace_(deps, root, _gen, force) {
  if (
    !force &&
    isLanConnectionDropdownOpen() &&
    deps.lanPanelHasBuiltChrome(root) &&
    !deps.lanPanelNeedsFullRebuild(root)
  ) {
    await deps.refreshLanPanelChromeInPlace();
    patchLanPanelJoinButtons();
    return true;
  }
  return false;
}

function appendOfflineBanner_(root) {
  if (lanNetworkProfile.getNetworkProfile() !== 'offline') return;
  var strip = document.createElement('div');
  strip.className = 'lan-alert-strip lan-alert-strip--offline';

  var copy = document.createElement('div');
  copy.className = 'lan-alert-strip__copy';
  copy.innerHTML =
    '<span class="lan-hub-status-dot lan-hub-status-dot--offline"></span> ' +
    'Sin conexión al anfitrión · LiveSync en pausa' +
    '<div class="lan-alert-strip__hint">Los cambios se guardan localmente y se sincronizarán al reconectar.</div>';
  strip.appendChild(copy);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-settings-row';
  btn.setAttribute('data-lan-action', 'reconnect-from-offline');
  btn.textContent = 'Reconectar';
  strip.appendChild(btn);

  root.appendChild(strip);
}

function resolveVisibleSalaDefs_(isElevated, userSala, registered, clinicalUserId) {
  var salaDefs = LIVE_SYNC_SALA_DEFS;
  if (isElevated) return salaDefs;
  if (userSala) {
    var filtered = salaDefs.filter(function (d) {
      return d.key === userSala;
    });
    return filtered.length ? filtered : salaDefs;
  }
  if (!registered && clinicalUserId) return salaDefs;
  return [];
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
function appendHubStatusHeroSection_(deps, heroHost, hubStatus, needsInvitePaste) {
  appendLanHubStatusHero(heroHost, {
    connected: hubStatus.connected,
    statusLine: hubStatus.line,
    statusHint: hubStatus.hint,
    showStatusHint: !shouldOmitLanHubStatusHint(hubStatus),
    isElectronDesktop: isLanElectronDesktop(),
    showBecomeHost: canLocalMacBeLanHost(),
    showConnectTurn: needsInvitePaste && isLanElectronDesktop() && isLanSkipShiftPin(),
    showInvitePaste: needsInvitePaste && deps.runtime().isMobileWeb(),
  });
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
async function appendHeroPinSections_(deps, root, heroHost, gen) {
  await deps.renderLanPreflightUx(root);
  if (deps.isRenderStale(gen)) return;
  await deps.appendLanShiftPinSection(heroHost, gen);
  if (deps.isRenderStale(gen)) return;
  deps.appendLanHostAddressCopyButton(heroHost, gen);
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
function appendMobileLanSections_(deps, root, hubStatus) {
  if (!deps.runtime().isMobileWeb()) return;
  if (!hubStatus.connected) {
    deps.appendLanMobileJoinSection(root);
    return;
  }
  deps.appendLanMobileSharerCard(root);
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
function appendElectronDesktopSections_(deps, root, needsInvitePaste) {
  if (!isLanElectronDesktop()) return;
  var canShare = deps.canOfferMobileLanShare();
  if (!needsInvitePaste && canShare) {
    deps.appendLanInviteShareCards(root);
  }
  deps.appendLanJoinOtherMacSection(root, {
    open: needsInvitePaste || !canShare,
  });
  if (needsInvitePaste && canShare) {
    deps.appendLanInviteShareCards(root);
  }
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
function appendRoomsAndRankSections_(deps, root, hubStatus, visibleSalaDefs, rank, isElevated) {
  if (!deps.runtime().isMobileWeb() || !hubStatus.connected) {
    appendLanHubRoomsCard(root, {
      visibleSalaDefs: visibleSalaDefs,
      activeRoomId: activeLiveSyncRoomId,
    });
  }
  if (rank === 'R1') {
    deps.buildR1Section(root);
  } else if (rank === 'R2') {
    deps.buildR2Section(root);
  } else if (isElevated) {
    deps.buildR4Section(root);
  }
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
async function appendPanelFooterSections_(deps, root, gen, expandState, dropdownScrollTop) {
  var appendConflictDrafts = deps.runtime().appendLanConflictDraftsSection;
  if (typeof appendConflictDrafts === 'function') {
    void appendConflictDrafts(root);
  }
  await deps.appendLanSyncDiagnosticsSection(root);
  await appendLanHostPatientsSection(root, {
    showToast: function (msg, kind) {
      deps.runtime().showToast(msg, kind);
    },
    onChanged: function () {
      if (typeof deps.runtime().renderPatientList === 'function') deps.runtime().renderPatientList();
    },
  });
  if (deps.isRenderStale(gen)) return;
  deps.purgeDuplicateLanShiftPinCards(root);
  restoreLanPanelExpandState(root, expandState);
  restoreConnectionDropdownScrollTop(dropdownScrollTop);
  maybeAppendInternoQrPanel_(deps, root);
  maybeAppendEquiposQrPanel_(deps, root);
}

/** @param {Parameters<typeof maybeAppendInternoQrPanel_>[0]} deps */
async function renderLanPanelOnce_(deps, force) {
  var gen = deps.bumpRenderGen();
  var root = document.getElementById('lan-connection-panel-root');
  if (!root) return;

  var registered = isClinicalRegistered();
  var userSala = getUserSala();
  var rank = getClinicalRank();
  var clinicalUserId = getClinicalUserUserId();
  var rankConfigured = isClinicalRankConfiguredForLan();

  await syncLanHostBeforeRender_(deps, rankConfigured);
  if (deps.isRenderStale(gen)) return;
  if (await tryRefreshChromeInPlace_(deps, root, gen, force)) return;

  var expandState = captureLanPanelExpandState(root);
  var dropdownScrollTop = captureConnectionDropdownScrollTop();
  root.innerHTML = '';

  if (
    appendLanPanelGuardCards_(root, {
      registered,
      clinicalUserId,
      userSala,
      rankConfigured,
      isElevated: hasElevatedTeamPrivileges(clinicalSessionContext.user),
    })
  ) {
    return;
  }

  var isElevated = hasElevatedTeamPrivileges(clinicalSessionContext.user);
  appendOfflineBanner_(root);

  var hubStatus = lanHubStatusCopy();
  var needsInvitePaste = !deps.runtime().isMobileWeb() && !isLanSessionConfiguredForRest();
  var visibleSalaDefs = resolveVisibleSalaDefs_(isElevated, userSala, registered, clinicalUserId);

  var heroHost = document.createElement('div');
  heroHost.className = 'lan-connection-hero';
  root.appendChild(heroHost);

  appendHubStatusHeroSection_(deps, heroHost, hubStatus, needsInvitePaste);
  if (deps.isRenderStale(gen)) return;

  await appendHeroPinSections_(deps, root, heroHost, gen);
  if (deps.isRenderStale(gen)) return;

  await deps.appendLanTurnResetAlertStrip(root, gen);
  if (deps.isRenderStale(gen)) return;

  var mainStack = appendLanConnectionStack(root);
  await deps.appendLanShiftPinClientConnectSection(mainStack, gen);
  if (deps.isRenderStale(gen)) return;

  appendMobileLanSections_(deps, mainStack, hubStatus);
  deps.appendLanBackToLocalHostSection(mainStack);
  appendElectronDesktopSections_(deps, mainStack, needsInvitePaste);
  appendRoomsAndRankSections_(deps, mainStack, hubStatus, visibleSalaDefs, rank, isElevated);
  deps.appendLanHostPinSection(mainStack);
  await appendPanelFooterSections_(deps, mainStack, gen, expandState, dropdownScrollTop);
  appendLanLwwToastRow(mainStack);
  wireLanLwwToastPref();
  syncLanLwwOverwriteToastPrefUi();
}

/** @param {{
 *   runtime: () => object,
 *   bumpRenderGen: () => number,
 *   isRenderStale: (gen: number) => boolean,
 *   refreshLanPanelChromeInPlace: () => Promise<void>,
 *   lanPanelHasBuiltChrome: (root: HTMLElement) => boolean,
 *   lanPanelNeedsFullRebuild: (root: HTMLElement) => boolean,
 *   renderLanPreflightUx: (root: HTMLElement) => Promise<unknown>,
 *   appendLanShiftPinSection: (root: HTMLElement, gen: number) => Promise<void>,
 *   appendLanHostAddressCopyButton: (root: HTMLElement, gen: number) => void,
 *   appendLanShiftPinClientConnectSection: (root: HTMLElement, gen: number) => Promise<void>,
 *   appendLanTurnResetAlertStrip: (root: HTMLElement, gen: number) => Promise<void>,
 *   appendLanMobileJoinSection: (root: HTMLElement) => void,
 *   appendLanMobileSharerCard: (root: HTMLElement) => void,
 *   appendLanJoinOtherMacSection: (root: HTMLElement, opts?: object) => void,
 *   appendLanInviteShareCards: (root: HTMLElement) => void,
 *   appendLanBackToLocalHostSection: (root: HTMLElement) => void,
 *   canOfferMobileLanShare: () => boolean,
 *   buildR1Section: (root: HTMLElement) => void,
 *   buildR2Section: (root: HTMLElement) => void,
 *   buildR4Section: (root: HTMLElement) => void,
 *   appendLanHostPinSection: (root: HTMLElement) => void,
 *   appendLanSyncDiagnosticsSection: (root: HTMLElement) => Promise<void>,
 *   purgeDuplicateLanShiftPinCards: (root: HTMLElement) => void,
 * }} deps */
export function createPanelRenderOnce(deps) {
  async function renderLanPanelOnce(force) {
    await renderLanPanelOnce_(deps, !!force);
  }
  return { renderLanPanelOnce };
}
