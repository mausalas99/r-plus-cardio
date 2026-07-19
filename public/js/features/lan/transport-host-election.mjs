/**
 * LAN host election, pin override, promotion, and auto-join.
 */
import { storage } from '../../storage.js';
import { rememberPrimaryHostUrl, pingLanHostUrl, listLivePeerHostUrls } from '../../lan-surrogate-host.mjs';
import {
  clearPinnedHostUrl,
  getPinnedHostUrl,
  hasPinnedHostOverride,
  isPinnedHostLocal,
  isPinnedHostRemote,
  setPinnedHostUrl,
} from '../../lan-host-pin.mjs';
import { lanHostBasesSameMachine, normalizeLanHostBase } from '../../lan-host-subnet-discovery.mjs';
import { discoverLanHostsConcurrent } from '../../lan-discovery.mjs';
import {
  recordWardHostUrl,
  syncWardHostUrlToMainFile,
} from '../../lan-ward-host-registry.mjs';
import {
  recordAutoHostDetectSuccess,
  resumeAutoHostDetect,
} from '../../lan-host-detect-guard.mjs';
import { isWardTierHostMeta, markWardTierHostSeen } from '../../lan-host-escalation.mjs';
import { buildLocalLanHostMeta, prefersLanClientDiscoveryFirst } from '../../lan-host-rank.mjs';
import {
  canLocalMacBeLanHost,
  evaluatePeerHostAction,
  fetchLanHostRank,
  getLocalLanHostMeta,
  isClinicalRankConfiguredForLan,
  pickPreferredLanPeerHost,
  prefersLanHosting,
  resolveHostElection,
  syncLanHostClinicalMetaToDisk,
} from '../../lan-host-rank-policy.mjs';
import {
  pushBundleToHostUrl as pushBundleToHostUrlCore,
  runConsolidateIntoHost,
} from '../../lan-host-consolidation.mjs';
import {
  lanClient,
  clearActiveLiveSyncRoom,
  getLanClientId,
} from './runtime.mjs';
import { clearRoomMembership } from '../../live-sync-membership.mjs';
import { deps, runtime } from './transport-deps.mjs';
import {
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  persistLanClientConfig,
  syncLanSavedTeamCodeWithEffectiveHostCode,
  resolveHostBearerToken,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  maybeApplyLanHostUrlSwitch,
  ensureLanGuestBearerFileFromConfig,
} from './transport-session.mjs';
import {
  resolveLanShareBaseUrl,
  resolveLanHostUrlAuto,
  resolveOwnLanBaseForPin,
  refreshElectronLanCandidateUrl,
} from './transport-host-url.mjs';

const LAN_CONSOLIDATE_COOLDOWN_MS = 10 * 60 * 1000;
/** @type {Map<string, number>} */
const _lanDeclinedConsolidateUntil = new Map();
let _lanSplitBrainWarned = false;

function pinTargetsThisMac(pinned, ownBase) {
  const target = normalizeLanHostBase(pinned);
  const own = normalizeLanHostBase(ownBase || '');
  if (!target || !own) return false;
  return isPinnedHostLocal(own) || lanHostBasesSameMachine(target, own);
}

/**
 * Pin wins over rank election: local pin → promote this Mac; remote pin → join that URL.
 * @param {string} [teamCode]
 * @param {{ boot?: boolean, quiet?: boolean }} [opts]
 */
async function promotePinnedLocalHost(opts) {
  if (!canLocalMacBeLanHost()) {
    if (!opts.quiet) {
      runtime().showToast(
        'No puedes fijar esta Mac como anfitrión con tu rango todavía (escalada o R4/admin).',
        'info'
      );
    }
    return false;
  }
  if (isWardTierHostMeta(buildLocalLanHostMeta())) markWardTierHostSeen();
  const current = normalizeLanHostBase(lanClient.baseUrl() || '');
  const pinned = getPinnedHostUrl();
  const alreadyHost =
    !isLanRemoteJoinMode() &&
    current &&
    (pinTargetsThisMac(pinned, current) || lanHostBasesSameMachine(pinned, current));
  if (alreadyHost) {
    return ensureLanElectronHostReady({ forceLocal: true });
  }
  return promoteThisMacToLanHost({
    skipOtherHostCheck: true,
    skipToast: !!opts.quiet || !!opts.boot,
  });
}

function isExplicitLanHostUiRole() {
  return typeof storage.getLanUiRole === 'function' && storage.getLanUiRole() === 'host';
}

export async function applyPinnedHostOverride(teamCode, opts) {
  opts = opts || {};
  const pinned = getPinnedHostUrl();
  const code = String(teamCode || getLanTeamCodeFromConfig() || '').trim();
  if (!pinned || !code) return false;
  if (!isClinicalRankConfiguredForLan()) return false;

  const ownUrl = await resolveOwnLanBaseForPin();
  if (pinTargetsThisMac(pinned, ownUrl)) {
    return promotePinnedLocalHost(opts);
  }

  // Host role must not auto-yield to a stale remote pin (scan/boot/render).
  if (isExplicitLanHostUiRole() && canLocalMacBeLanHost()) {
    await repinLocalHostAfterPromotion();
    return promotePinnedLocalHost(opts);
  }

  return tryConnectToPinnedHost(code, opts);
}

/** Corrige rol «cliente» en escritorio sin URL guardada (UI antigua con pestañas). */
function migrateLanElectronStaleClientRole() {
  if (!isLanElectronDesktop() || !isLanRemoteJoinMode()) return;
  if (!canLocalMacBeLanHost()) return;
  if (prefersLanClientDiscoveryFirst()) return;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() : null;
  if (cfg && String(cfg.hostUrl || '').trim()) return;
  if (typeof storage.saveLanUiRole === 'function') storage.saveLanUiRole('host');
}

/** Subnet scan only when this Mac already acts as turn host (not while discovering peers). */
function shouldSkipSubnetScanForDiscovery() {
  if (isLanRemoteJoinMode()) return false;
  if (typeof storage.getLanUiRole === 'function' && storage.getLanUiRole() !== 'host') return false;
  return canLocalMacBeLanHost();
}

/** Escritorio: detecta IP, alinea código y deja lista la URL del servidor embebido. */
function demoteIneligibleLanHostUiRole() {
  if (!isLanElectronDesktop() || !isClinicalRankConfiguredForLan()) return;
  if (hasPinnedHostOverride()) return;
  if (canLocalMacBeLanHost()) return;
  if (typeof storage.getLanUiRole !== 'function' || storage.getLanUiRole() !== 'host') return;
  if (typeof storage.saveLanUiRole === 'function') storage.saveLanUiRole('client');
}

function shouldSaveLanHostUiRole(opts) {
  if (opts.forceLocal) return true;
  if (isLanRemoteJoinMode()) return false;
  return true;
}

async function resolveReachableLanHostUrl(cfg, opts, autoUrl, bearer) {
  var url = opts.forceLocal
    ? ''
    : String(cfg.hostUrl || '')
        .trim()
        .replace(/\/+$/, '');
  if (url && !(autoUrl && url === autoUrl) && !isLocalLoopbackLanUrl(url)) {
    if (!(await pingLanHostUrl(url, cfg.teamCode || bearer))) url = '';
  }
  if (url && !isLocalLoopbackLanUrl(url)) return url;
  var shareUrl = await resolveLanShareBaseUrl();
  if (shareUrl) return shareUrl;
  url = autoUrl || 'http://127.0.0.1:3738';
  if (!isLocalLoopbackLanUrl(url)) return url;
  var retried = await refreshElectronLanCandidateUrl({ ensureServer: true, tries: 6, delayMs: 400 });
  return retried || url;
}

export async function ensureLanElectronHostReady(opts) {
  opts = opts || {};
  demoteIneligibleLanHostUiRole();
  migrateLanElectronStaleClientRole();
  if (!isLanElectronDesktop()) return false;
  if (!opts.forceLocal && !canLocalMacBeLanHost()) return false;
  if (opts.forceLocal && !canLocalMacBeLanHost()) return false;
  if (!opts.forceLocal && isLanRemoteJoinMode()) return false;
  if (shouldSaveLanHostUiRole(opts) && typeof storage.saveLanUiRole === 'function') {
    storage.saveLanUiRole('host');
  }
  await syncLanSavedTeamCodeWithEffectiveHostCode();
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var autoUrl = await resolveLanHostUrlAuto();
  var bearer = await resolveHostBearerToken();
  if (!bearer) return false;
  var url = await resolveReachableLanHostUrl(cfg, opts, autoUrl, bearer);
  persistLanClientConfig(url, bearer);
  recordWardHostUrl(url, { source: 'host' });
  syncWardHostUrlToMainFile(url, { source: 'host' });
  try {
    lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  return true;
}

export async function pushBundleToHostUrl(winnerUrl, teamCode, roomId, envelope) {
  return pushBundleToHostUrlCore(winnerUrl, teamCode, roomId, envelope);
}

export async function consolidateIntoHost(winnerUrl, teamCode, opts) {
  opts = opts || {};
  const room = await import('./room.mjs');
  const roomId =
    typeof room.getActiveLiveSyncRoomId === 'function' ? room.getActiveLiveSyncRoomId() : '';
  return runConsolidateIntoHost(
    { winnerUrl, teamCode, requireConfirm: !!opts.requireConfirm },
    {
      getRoomId: () => roomId,
      buildBundle: (rid) => room.buildLiveSyncBundleEnvelope(rid),
      pushBundle: (url, code, rid, env) => pushBundleToHostUrl(url, code, rid, env),
      broadcastHandoff: async (url) => {
        const handoff = await room.enrichLiveSyncHelloPayload(
          room.buildLiveSyncHelloPayload(roomId)
        );
        handoff.type = 'livesync:host-handoff';
        handoff.newHostUrl = url;
        handoff.reason = 'consolidate-rank';
        lanClient.sendLive(handoff);
      },
      switchToClient: async (url, code) => {
        applyLanHostUrlSwitch(url, code, { skipRememberPrimary: false });
        if (typeof storage.saveLanUiRole === 'function') storage.saveLanUiRole('client');
        persistLanClientConfig(url, code);
        rememberPrimaryHostUrl(url);
        await room.tryReconnectLanToHostUrl?.(url, code);
      },
      confirmYield: () => {
        if (typeof confirm !== 'function') return true;
        const yes = confirm(
          opts.confirmMessage ||
            'Un anfitrión de mayor rango ya está activo. ¿Combinar y conectar como cliente?'
        );
        if (!yes) {
          _lanDeclinedConsolidateUntil.set(
            normalizeLanHostBase(winnerUrl),
            Date.now() + LAN_CONSOLIDATE_COOLDOWN_MS
          );
        }
        return yes;
      },
      showToast: (msg, kind) => runtime().showToast(msg, kind),
    }
  );
}

function lanConsolidateCooldownActive(peerUrl) {
  const until = _lanDeclinedConsolidateUntil.get(peerUrl) || 0;
  return Date.now() < until;
}

/**
 * Apply election matrix for one discovered peer host URL.
 * @returns {Promise<boolean>} true if role/connection changed
 */
async function handlePinnedDiscoveredHost(url, code, pinned, ownUrl) {
  if (pinTargetsThisMac(pinned, ownUrl)) return false;
  if (normalizeLanHostBase(pinned) !== url) return false;
  return joinRemoteLanHostAsClient(url, code, {
    requireConfirm: false,
    toastLabel: 'fijado',
  });
}

function warnSplitBrainOnce(url) {
  if (_lanSplitBrainWarned) return;
  _lanSplitBrainWarned = true;
  runtime().showToast(
    'Otro servidor R+ activo en ' + url + '. Solo debe haber un anfitrión en el turno.',
    'warning'
  );
}

async function applyPeerHostElectionAction(action, url, code, peer) {
  if (action === 'stay-warn') {
    warnSplitBrainOnce(url);
    return false;
  }
  if (action === 'noop') return false;
  if (action === 'silent-join') {
    return joinRemoteLanHostAsClient(url, code, {
      requireConfirm: false,
      toastLabel: peer.rank || 'R4',
    });
  }
  if (action === 'confirm-consolidate') {
    if (lanConsolidateCooldownActive(url)) return false;
    return consolidateIntoHost(url, code, {
      requireConfirm: true,
      confirmMessage:
        'Un anfitrión de mayor rango (' +
        (peer.rank || 'R4') +
        ') está en ' +
        url +
        '. ¿Combinar servidores y conectar como cliente?',
    });
  }
  return false;
}

export async function reactToDiscoveredLanHost(peerUrl, teamCode, _opts) {
  _opts = _opts || {};
  const url = normalizeLanHostBase(peerUrl);
  const code = String(teamCode || '').trim();
  if (!url || !code) return false;
  if (!isClinicalRankConfiguredForLan()) return false;

  const pinned = getPinnedHostUrl();
  const ownUrl = await resolveOwnLanBaseForPin();
  if (pinned) {
    return handlePinnedDiscoveredHost(url, code, pinned, ownUrl);
  }

  if (!ownUrl || lanHostBasesSameMachine(url, ownUrl)) return false;

  const peer = await fetchLanHostRank(url, code);
  if (!peer) return false;
  const selfMeta = getLocalLanHostMeta();
  const election = resolveHostElection(selfMeta, peer, { selfUrl: ownUrl, peerUrl: url });
  const action = evaluatePeerHostAction(selfMeta, peer, election);
  return applyPeerHostElectionAction(action, url, code, peer);
}

/** Sin red o host remoto caído: usar el servidor embebido de esta Mac. */
async function showCannotHostYetToast() {
  const { getHostEscalationStatus, formatEscalationCountdown } = await import(
    '../../lan-host-escalation.mjs'
  );
  const esc = getHostEscalationStatus();
  const nextRank = ['R3', 'R2', 'R1'][esc.tier] || 'R1';
  const msg =
    esc.tier < 3 && esc.msUntilNext > 0
      ? 'Sin R4 en la red: en ' +
        formatEscalationCountdown(esc.msUntilNext) +
        ' podrá anfitrionar ' +
        nextRank +
        ' (escalada 10 min por nivel).'
      : 'Aún no puedes ser anfitrión en esta Mac. Busca al R4 o espera la escalada automática.';
  runtime().showToast(msg, 'info');
}

async function confirmPromoteDespiteActivePeers(opts) {
  if (opts.skipOtherHostCheck) return true;
  const teamCode = getLanTeamCodeFromConfig();
  const ownUrl = (await resolveLanShareBaseUrl()) || '';
  if (!teamCode || !ownUrl) return true;
  const scanned = await discoverLanHostsConcurrent(teamCode, ownUrl, {
    subnetScanMode: 'beacon',
  });
  for (const url of scanned) {
    const peerMeta = await fetchLanHostRank(url, teamCode);
    if (!peerMeta || !prefersLanHosting(peerMeta)) continue;
    const msg =
      'Ya hay un servidor R+ activo en ' + url + '. ¿Activar otro servidor en esta Mac de todos modos?';
    if (typeof confirm === 'function' && !confirm(msg)) return false;
    break;
  }
  return true;
}

/** Remote pin would undo explicit promotion on the next ⇄ panel render. */
export async function repinLocalHostAfterPromotion() {
  const ownUrl = await resolveOwnLanBaseForPin();
  if (!getPinnedHostUrl() || !isPinnedHostRemote(ownUrl)) return;
  if (ownUrl) setPinnedHostUrl(ownUrl);
  else clearPinnedHostUrl();
}

async function finalizePromotedLanHost(opts) {
  var ok = await ensureLanElectronHostReady({ forceLocal: true });
  if (ok) {
    resumeAutoHostDetect();
    recordAutoHostDetectSuccess();
    const shareUrl = await resolveLanShareBaseUrl();
    if (shareUrl) {
      recordWardHostUrl(shareUrl, { source: 'host' });
      syncWardHostUrlToMainFile(shareUrl, { source: 'host' });
    }
  }
  deps().renderLanPanel();
  if (ok && !opts.skipToast) {
    runtime().showToast('Esta Mac ahora es el servidor del turno.', 'success');
  }
  if (!ok) {
    runtime().showToast('No se pudo activar el servidor local. Reinicia R+ e inténtalo de nuevo.', 'error');
  }
  return ok;
}

export async function promoteThisMacToLanHost(opts) {
  opts = opts || {};
  if (!isLanElectronDesktop()) {
    runtime().showToast('Solo disponible en la app de escritorio.', 'info');
    return false;
  }
  if (!isClinicalRankConfiguredForLan()) {
    runtime().showToast(
      'Completa «Configura tu rotación» (rango y sala) antes de usar la red del turno.',
      'info'
    );
    return false;
  }
  if (!canLocalMacBeLanHost()) {
    await showCannotHostYetToast();
    return false;
  }
  if (!(await confirmPromoteDespiteActivePeers(opts))) return false;
  var wasRemoteClient = isLanRemoteJoinMode();
  if (typeof storage.saveLanUiRole === 'function') storage.saveLanUiRole('host');
  storage.saveLanConfig(null);
  lanClient.disconnect();
  if (wasRemoteClient) {
    clearActiveLiveSyncRoom();
    clearRoomMembership();
  }
  await repinLocalHostAfterPromotion();
  return finalizePromotedLanHost(opts);
}

/**
 * Descubre anfitrión de mayor prioridad (R4 / admin) y conecta como cliente.
 * @param {{ boot?: boolean }} [opts]
 */
export { syncLanHostClinicalMetaToDisk } from '../../lan-host-rank-policy.mjs';

/**
 * When pin targets a remote host, connect as client (IM-08 client-side pin).
 * @param {{ boot?: boolean, quiet?: boolean }} [opts]
 */
function isAlreadyOnPinnedHost(target, ownUrl) {
  const current = normalizeLanHostBase(
    isLanRemoteJoinMode() ? lanClient.baseUrl() || '' : ownUrl
  );
  return !!(current && (current === target || lanHostBasesSameMachine(current, target)));
}

export async function tryConnectToPinnedHost(teamCode, opts) {
  opts = opts || {};
  const pinned = getPinnedHostUrl();
  const code = String(teamCode || '').trim();
  if (!pinned || !code) return false;

  const ownUrl = await resolveOwnLanBaseForPin();
  if (pinTargetsThisMac(pinned, ownUrl)) {
    return applyPinnedHostOverride(code, opts);
  }

  const target = normalizeLanHostBase(pinned);
  if (isAlreadyOnPinnedHost(target, ownUrl)) return false;

  const alive = await pingLanHostUrl(target, code);
  if (!alive) {
    if (!opts.quiet && !opts.boot) {
      runtime().showToast(
        'Anfitrión fijado no responde (' + target + '). Verifica la red o el enlace.',
        'warning'
      );
    }
    return false;
  }

  const joined = await joinRemoteLanHostAsClient(target, code, {
    requireConfirm: false,
    toastLabel: 'fijado',
  });
  if (joined && !opts.boot) {
    deps().renderLanPanel?.();
  }
  return joined;
}

async function collectAutoJoinPeers(teamCode, ownUrl) {
  let peers = listLivePeerHostUrls(getLanClientId());
  const subnetPeers = await discoverLanHostsConcurrent(teamCode, ownUrl, {
    skipSubnetScan: shouldSkipSubnetScanForDiscovery(),
  });
  const seen = new Set();
  return [...peers, ...subnetPeers].filter((u) => {
    const n = normalizeLanHostBase(u);
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

async function tryReactToDiscoveredPeers(peers, teamCode, opts) {
  for (const peerUrl of peers) {
    if (!(await reactToDiscoveredLanHost(peerUrl, teamCode))) continue;
    if (!opts.boot) deps().renderLanPanel?.();
    return true;
  }
  return false;
}

async function joinPreferredLanPeer(peers, teamCode, ownUrl, opts) {
  const pick = await pickPreferredLanPeerHost(peers, teamCode, ownUrl);
  if (!pick || !pick.url) return false;
  const joined = await joinRemoteLanHostAsClient(pick.url, teamCode, {
    requireConfirm: false,
    toastLabel: pick.peer?.rank || 'R4',
  });
  if (joined && !opts.boot) deps().renderLanPanel?.();
  return joined;
}

export async function tryAutoJoinPreferredLanHost(opts) {
  opts = opts || {};
  if (!isLanElectronDesktop() || !isClinicalRankConfiguredForLan()) return false;
  const teamCode = getLanTeamCodeFromConfig();
  if (!teamCode) return false;

  await syncLanHostClinicalMetaToDisk();
  if (getPinnedHostUrl()) return applyPinnedHostOverride(teamCode, opts);
  if (isLanRemoteJoinMode()) return false;

  const ownUrl = normalizeLanHostBase((await resolveLanShareBaseUrl()) || '');
  const peers = await collectAutoJoinPeers(teamCode, ownUrl);
  if (!peers.length) return false;
  if (await tryReactToDiscoveredPeers(peers, teamCode, opts)) return true;
  return joinPreferredLanPeer(peers, teamCode, ownUrl, opts);
}

/** Cambia a cliente y apunta al anfitrión remoto. */
export async function joinRemoteLanHostAsClient(hostUrl, teamCode, opts) {
  opts = opts || {};
  const url = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!url) return false;
  const ownUrl = (await resolveOwnLanBaseForPin()) || '';
  if (ownUrl && (url === ownUrl.replace(/\/+$/, '') || lanHostBasesSameMachine(url, ownUrl))) {
    return false;
  }

  if (isLanElectronDesktop() && typeof storage.saveLanUiRole === 'function') {
    storage.saveLanUiRole('client');
  }
  const switched = maybeApplyLanHostUrlSwitch(url, teamCode, {
    skipRememberPrimary: true,
    requireConfirm: !!opts.requireConfirm,
    confirmMessage: opts.confirmMessage,
  });
  if (!switched) return false;
  try {
    const room = await import('./room.mjs');
    if (typeof room.tryReconnectLanToHostUrl === 'function') {
      await room.tryReconnectLanToHostUrl(url, teamCode);
    }
  } catch (_e) { void _e; }
  recordAutoHostDetectSuccess();
  recordWardHostUrl(url, { source: 'client' });
  const label = String(opts.toastLabel || '').trim();
  runtime().showToast(
    label
      ? 'Conectado al anfitrión del turno (' + label + ').'
      : 'Conectado al anfitrión del turno.',
    'success'
  );
  return true;
}

export async function initLanHostPlugAndPlay() {
  if (!isLanElectronDesktop()) return;
  const { seedBundledWardConnectionPoints } = await import('../../lan-ward-host-registry.mjs');
  seedBundledWardConnectionPoints();
  if (isLanRemoteJoinMode()) {
    await ensureLanGuestBearerFileFromConfig();
  }
  demoteIneligibleLanHostUiRole();
  if (!isClinicalRankConfiguredForLan()) return;
  try {
    const pinMod = await import('../../lan-shift-pin-connect.mjs');
    if (typeof pinMod.tryEasyLanShiftPinConnect === 'function') {
      const easy = await pinMod.tryEasyLanShiftPinConnect({ silent: true });
      if (easy.ok) return;
    }
  } catch (_e) { void _e; }
  await syncLanHostClinicalMetaToDisk();
  if (getPinnedHostUrl()) {
    if (await applyPinnedHostOverride(getLanTeamCodeFromConfig(), { boot: true })) return;
  }
  if (isLanRemoteJoinMode()) return;
  const joined = await tryAutoJoinPreferredLanHost({ boot: true });
  if (joined) return;
  if (canLocalMacBeLanHost()) {
    await ensureLanElectronHostReady();
  }
}
