/**
 * LAN auto-discovery scan loop — extracted from panel.mjs scanLanHosts.
 */
import { storage } from '../../storage.js';
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import { listLivePeerHostUrls, pingLanHostUrl } from '../../lan-surrogate-host.mjs';
import {
  normalizeLanHostBase,
  resolveLocalLanSubnetPrefixes,
} from '../../lan-host-subnet-discovery.mjs';
import { discoverLanHostsConcurrent } from '../../lan-discovery.mjs';
import { listWardHostUrlsForProbe } from '../../lan-ward-host-registry.mjs';
import { getPinnedHostUrl } from '../../lan-host-pin.mjs';
import { canAttemptAutoHostDetect } from '../../lan-host-detect-guard.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import { updateLanHostEscalationFromPeerMetas } from '../../lan-host-escalation.mjs';
import {
  canLocalMacBeLanHost,
  isClinicalRankConfiguredForLan,
  prefersLanHosting,
  fetchLanHostRank,
} from '../../lan-host-rank-policy.mjs';
import {
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  getLanTeamCodeFromConfig,
  applyPinnedHostOverride,
  reactToDiscoveredLanHost,
  resolveLanShareBaseUrl,
  tryAutoJoinPreferredLanHost,
  initLanHostPlugAndPlay,
} from './transport.mjs';
import { probeLanPeerUrls_, collectSubnetScanMetas_ } from './panel-scan-peers.mjs';
import { fetchClinicalOpsFromAlternateHost } from './room.mjs';
import { ensureEffectiveLiveSyncRoomId } from './push.mjs';
import { getLanScanIntervalMs, getLanClientId } from './runtime.mjs';

const SUBNET_LAN_SCAN_MIN_MS = 45000;
const WS_PEER_PING_MIN_MS = 15000;
const PLUG_AND_PLAY_MIN_MS = 60000;
const LAN_PEER_OPS_PULL_MIN_MS = 30000;
const LAN_SPLIT_BRAIN_HINT_KEY = 'rpc-lan-split-brain-hint-shown';

var _lanScanInFlight = false;
var _lastWsPeerPingAt = 0;
var _lastPlugAndPlayAt = 0;
var _lastSubnetLanScanAt = 0;
/** @type {Map<string, number>} */
var _lanPeerOpsPullLastAt = new Map();
var _lanScanTimer = null;

export function isLanAutoDiscoveryActive() {
  return !!_lanScanTimer;
}

function makePeerProbeCtx(deps, teamCode, peerMetasForEscalation, addPeer) {
  return {
    pingLanHostUrl,
    fetchLanHostRank,
    reactToDiscoveredLanHost,
    addPeer,
    pushMeta: function (meta) {
      peerMetasForEscalation.push(meta);
    },
    onJoined: deps.requestRenderLanPanelAfterScan,
  };
}

async function scanPinnedOverride(deps, teamCode) {
  if (!getPinnedHostUrl()) return false;
  if (!(await applyPinnedHostOverride(teamCode, { quiet: true }))) return false;
  await deps.refreshLanPanelChromeInPlace();
  return true;
}

async function scanWsPeerBatch(deps, teamCode, wsPeers, peerMetasForEscalation, addPeer) {
  var ctx = makePeerProbeCtx(deps, teamCode, peerMetasForEscalation, addPeer);
  for (var wi = 0; wi < wsPeers.length; wi += 1) {
    if (await probeLanPeerUrls_([wsPeers[wi]], teamCode, ctx)) return true;
  }
  return false;
}

async function scanWardPeerBatch(deps, teamCode, wardProbeUrls, peerMetasForEscalation, addPeer) {
  return probeLanPeerUrls_(
    wardProbeUrls,
    teamCode,
    Object.assign(makePeerProbeCtx(deps, teamCode, peerMetasForEscalation, addPeer), {
      beaconFirst: true,
    })
  );
}

function subnetScanOptions() {
  if (
    !isLanRemoteJoinMode() &&
    typeof storage.getLanUiRole === 'function' &&
    storage.getLanUiRole() === 'host' &&
    canLocalMacBeLanHost()
  ) {
    return { skipSubnetScan: true };
  }
  return { subnetScanMode: 'beacon' };
}

async function reactToSubnetPeer(deps, url, teamCode) {
  if (typeof reactToDiscoveredLanHost !== 'function') return false;
  if (!(await reactToDiscoveredLanHost(url, teamCode))) return false;
  deps.requestRenderLanPanelAfterScan();
  return true;
}

async function scanSubnetPeers(deps, teamCode, ownUrl, wsPeers, peerMetasForEscalation, addPeer) {
  if (Date.now() - _lastSubnetLanScanAt < SUBNET_LAN_SCAN_MIN_MS) return false;
  _lastSubnetLanScanAt = Date.now();
  var scanned = await discoverLanHostsConcurrent(teamCode, ownUrl, subnetScanOptions());
  var subnetMeta = await collectSubnetScanMetas_(scanned, teamCode, {
    pingLanHostUrl,
    fetchLanHostRank,
    prefersLanHosting,
    wsPeerCount: wsPeers.length,
    showSplitBrainHint: function (hostUrl) {
      if (sessionStorage.getItem(LAN_SPLIT_BRAIN_HINT_KEY)) return;
      try {
        sessionStorage.setItem(LAN_SPLIT_BRAIN_HINT_KEY, '1');
      } catch (_e) { void _e; }
      deps.runtime().showToast(
        'Otra R+ en la red (' +
          hostUrl +
          '). Para ver el directorio juntos, una Mac debe ser anfitrión.',
        'warning'
      );
    },
  });
  peerMetasForEscalation.push.apply(peerMetasForEscalation, subnetMeta.peerMetas);
  for (var si = 0; si < scanned.length; si += 1) {
    addPeer(scanned[si]);
    if (await reactToSubnetPeer(deps, scanned[si], teamCode)) return true;
  }
  return false;
}

async function pullClinicalOpsFromPeers(deps, peers, roomIdForPeerOps) {
  if (!roomIdForPeerOps || !peers.length) return;
  if (typeof fetchClinicalOpsFromAlternateHost !== 'function') return;
  var ownPeerBase = normalizeLanHostBase(
    deps.lanHostUrl() || (await resolveLanShareBaseUrl()) || ''
  );
  var nowPeerOps = Date.now();
  for (var ppi = 0; ppi < peers.length; ppi += 1) {
    var peerOpsUrl = normalizeLanHostBase(peers[ppi]);
    if (!peerOpsUrl || peerOpsUrl === ownPeerBase) continue;
    var peerOpsLast = _lanPeerOpsPullLastAt.get(peerOpsUrl) || 0;
    if (nowPeerOps - peerOpsLast < LAN_PEER_OPS_PULL_MIN_MS) continue;
    _lanPeerOpsPullLastAt.set(peerOpsUrl, nowPeerOps);
    await fetchClinicalOpsFromAlternateHost(peerOpsUrl, roomIdForPeerOps, {
      skipGossipPush: true,
      quiet: true,
    });
  }
}

async function maybeRunPlugAndPlay(now) {
  if (!canLocalMacBeLanHost() || isLanRemoteJoinMode()) return;
  if (now - _lastPlugAndPlayAt < PLUG_AND_PLAY_MIN_MS) return;
  _lastPlugAndPlayAt = now;
  void initLanHostPlugAndPlay();
}

/** Ward endpoints ship in the build; exchange without bearer when shift PIN is off. */
async function tryBundledWardAutoConnect(deps) {
  if (!isLanSkipShiftPin()) return false;
  const pinMod = await import('../../lan-shift-pin-connect.mjs');
  const result = await pinMod.tryEasyLanShiftPinConnect({
    silent: true,
    skipCooldown: true,
  });
  if (result.ok) {
    deps.requestRenderLanPanelAfterScan();
    return true;
  }
  return false;
}

async function scanLanHosts_(deps) {
  if (_lanScanInFlight) return;
  if (!isLanElectronDesktop()) return;
  if (!isClinicalRankConfiguredForLan()) return;
  if (!canAttemptAutoHostDetect()) return;

  var teamCode = getLanTeamCodeFromConfig();
  if (!teamCode && isLanSkipShiftPin()) {
    if (await tryBundledWardAutoConnect(deps)) return;
    teamCode = getLanTeamCodeFromConfig();
    if (!teamCode) return;
  }
  if (!teamCode) return;

  _lanScanInFlight = true;
  try {
    if (await scanPinnedOverride(deps, teamCode)) return;
    if (isLanRemoteJoinMode()) return;
    await runLanHostDiscoveryPass(deps, teamCode);
  } catch {
    // scan errors are non-fatal
  } finally {
    _lanScanInFlight = false;
  }
}

async function runLanHostDiscoveryPass(deps, teamCode) {
  var clientId = typeof getLanClientId === 'function' ? getLanClientId() : '';
  var wsPeers =
    typeof listLivePeerHostUrls === 'function' ? listLivePeerHostUrls(clientId) : [];
  var seen = new Set();
  var peers = [];
  var peerMetasForEscalation = [];

  function addPeer(url) {
    var u = String(url || '')
      .trim()
      .replace(/\/+$/, '');
    if (!u || seen.has(u)) return;
    seen.add(u);
    peers.push(u);
  }

  var now = Date.now();
  var runWsPeerPing = now - _lastWsPeerPingAt >= WS_PEER_PING_MIN_MS;
  if (runWsPeerPing) _lastWsPeerPingAt = now;

  if (runWsPeerPing && (await scanWsPeerBatch(deps, teamCode, wsPeers, peerMetasForEscalation, addPeer))) {
    return;
  }

  var ownUrlForWard = deps.lanHostUrl() || (await resolveLanShareBaseUrl());
  var localWardPrefixes = await resolveLocalLanSubnetPrefixes(ownUrlForWard);
  var wardProbeUrls = listWardHostUrlsForProbe(undefined, {
    localSubnetPrefixes: localWardPrefixes,
  });
  if (await scanWardPeerBatch(deps, teamCode, wardProbeUrls, peerMetasForEscalation, addPeer)) {
    return;
  }

  var ownUrl = deps.lanHostUrl() || (await resolveLanShareBaseUrl());
  if (await scanSubnetPeers(deps, teamCode, ownUrl, wsPeers, peerMetasForEscalation, addPeer)) {
    return;
  }

  updateLanHostEscalationFromPeerMetas(peerMetasForEscalation);

  if (peers.length && typeof tryAutoJoinPreferredLanHost === 'function') {
    var joined = await tryAutoJoinPreferredLanHost();
    if (joined) {
      deps.requestRenderLanPanelAfterScan();
      return;
    }
  }

  if (document.body.classList.contains('clinical-lan-directory-open')) {
    void deps.refreshLanPanelChromeInPlace();
    return;
  }

  var roomIdForPeerOps =
    typeof ensureEffectiveLiveSyncRoomId === 'function' ? ensureEffectiveLiveSyncRoomId() : '';
  await pullClinicalOpsFromPeers(deps, peers, roomIdForPeerOps);
  await maybeRunPlugAndPlay(now);
  void deps.refreshLanPanelChromeInPlace();
}

/** @param {{
 *   runtime: () => object,
 *   lanHostUrl: () => string,
 *   refreshLanPanelChromeInPlace: () => Promise<void>,
 *   requestRenderLanPanelAfterScan: () => void,
 * }} deps */
export function createPanelScanHosts(deps) {
  function scanLanHosts() {
    return scanLanHosts_(deps);
  }

  function startLanAutoDiscovery() {
    if (isClinicalLocalOnlyMode(readRpcSettings())) return;
    if (_lanScanTimer) return;
    _lanScanTimer = setInterval(function () {
      void scanLanHosts();
    }, getLanScanIntervalMs());
    void scanLanHosts();
  }

  function stopLanAutoDiscovery() {
    if (_lanScanTimer) {
      clearInterval(_lanScanTimer);
      _lanScanTimer = null;
    }
  }

  return { scanLanHosts, startLanAutoDiscovery, stopLanAutoDiscovery };
}
