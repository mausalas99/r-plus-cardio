/**
 * LAN anfitrión: prioridad R4 / admin de programa; rangos menores buscan primero.
 */
import {
  needsClinicalLanProfileGate,
  readRpcSettings,
} from './clinical-settings.mjs';
import { clinicalSessionContext } from './clinical-session-context.mjs';
import { hasProgramAdminPrivileges } from './clinical-privileges.mjs';
import {
  canRankHostAtEscalationTier,
  getHostEscalationTier,
  isWardTierHostMeta,
} from './lan-host-escalation.mjs';
import {
  parseLanHostRankResponse,
  resolveHostElectionByStartedAt,
  resolveHostElectionByUrl,
} from './lan-host-rank-election.mjs';
import { pingLanHostUrl } from './lan-surrogate-host.mjs';

const RANK_PRIORITY = { R1: 1, R2: 2, R3: 3, R4: 4, Admin: 5 };

/** On-call residents outrank any off-call peer; rank breaks ties within each tier. */
export const LAN_ON_CALL_HOST_TIER = 1_000_000;

/** Program admin from rpc-settings or active clinical session (DB profile). */
export function resolveLocalProgramAdmin(settings = readRpcSettings()) {
  if (settings.clinicalProgramAdmin === true || settings.clinicalIsProgramAdmin === true) {
    return true;
  }
  return hasProgramAdminPrivileges(clinicalSessionContext?.user);
}

/** Rank + admin flag for LAN election (no startedAt). */
export function buildLocalLanHostMeta(settings = readRpcSettings()) {
  const rank = String(settings?.clinicalRank || '').trim();
  return {
    rank: rank || 'R1',
    isProgramAdmin: resolveLocalProgramAdmin(settings),
  };
}

/** User completed «Configura tu rotación» with an explicit rango (required before LAN election). */
export function isClinicalRankConfiguredForLan(settings = readRpcSettings()) {
  const rank = String(settings?.clinicalRank || '').trim();
  if (!rank) return false;
  if (needsClinicalLanProfileGate(settings)) return false;
  return true;
}

/** On-call, R4/admin, or R3/R2/R1 after 10 min steps if no ward-tier/on-call host on the LAN. */
export function canLocalMacBeLanHost(meta) {
  if (!isClinicalRankConfiguredForLan()) return false;
  const m = meta || buildLocalLanHostMeta();
  if (m.isOnCallGuardia) return true;
  if (isWardTierHostMeta(m)) return true;
  return canRankHostAtEscalationTier(m, getHostEscalationTier());
}

/** Clinical rank only (no on-call tier). */
export function lanHostRankPriority(meta) {
  if (!meta) return 0;
  if (meta.isProgramAdmin) return 1000;
  const rank = String(meta.rank || 'R1').trim();
  return RANK_PRIORITY[rank] || 0;
}

/** @param {{ rank?: string, isProgramAdmin?: boolean, isOnCallGuardia?: boolean }} meta */
export function lanHostPriority(meta) {
  if (!meta) return 0;
  const tier = meta.isOnCallGuardia ? LAN_ON_CALL_HOST_TIER : 0;
  return tier + lanHostRankPriority(meta);
}

/** R4/admin, or residente de guardia hoy — puede ser servidor del turno en su subred. */
export function prefersLanHosting(meta) {
  if (!meta) return false;
  if (meta.isOnCallGuardia) return true;
  if (meta.isProgramAdmin) return true;
  const rank = String(meta.rank || '').trim();
  if (!rank) return false;
  return (RANK_PRIORITY[rank] || 0) >= RANK_PRIORITY.R4;
}

/**
 * R4/admin should scan and join an existing host before auto-promoting this Mac.
 * On-call residents still prefer client discovery when ward-tier.
 */
export function prefersLanClientDiscoveryFirst(meta) {
  const m = meta || buildLocalLanHostMeta();
  return isWardTierHostMeta(m);
}

/** @param {{ rank?: string, isProgramAdmin?: boolean }} peer */
/** @param {{ rank?: string, isProgramAdmin?: boolean }} self */
export function shouldDeferToPeerHost(peer, self) {
  return lanHostPriority(peer) > lanHostPriority(self);
}

/**
 * Conectar como cliente al peer (sin confirmación en boot/scan).
 * @param {{ rank?: string, isProgramAdmin?: boolean }} peer
 * @param {{ rank?: string, isProgramAdmin?: boolean }} self
 */
export function shouldAutoJoinPeerAsClient(peer, self) {
  if (!peer || !self) return false;
  if (shouldDeferToPeerHost(peer, self)) return true;
  const peerOn = !!peer.isOnCallGuardia;
  const selfOn = !!self.isOnCallGuardia;
  if (peerOn && !selfOn) return true;
  if (!peerOn && selfOn) return false;
  if (!prefersLanHosting(self) && prefersLanHosting(peer)) return true;
  const tier = getHostEscalationTier();
  if (!canRankHostAtEscalationTier(peer, tier)) return false;
  if (!canRankHostAtEscalationTier(self, tier)) return true;
  return lanHostPriority(peer) > lanHostPriority(self);
}

/**
 * @param {{ rank?: string, isProgramAdmin?: boolean, startedAt?: number }} selfMeta
 * @param {{ rank?: string, isProgramAdmin?: boolean, startedAt?: number }} peerMeta
 * @param {{ selfUrl?: string, peerUrl?: string }} [urls]
 * @returns {'self'|'peer'|'tie-self'|'tie-peer'}
 */
export function resolveHostElection(selfMeta, peerMeta, urls = {}) {
  const selfPri = lanHostPriority(selfMeta);
  const peerPri = lanHostPriority(peerMeta);
  if (peerPri > selfPri) return 'peer';
  if (selfPri > peerPri) return 'self';

  const byStarted = resolveHostElectionByStartedAt(
    Number(selfMeta?.startedAt) || 0,
    Number(peerMeta?.startedAt) || 0
  );
  if (byStarted) return byStarted;

  return resolveHostElectionByUrl(urls);
}

/** @deprecated use shouldDeferToPeerHost — rank string only */
export function shouldSupersedeRank(peerRank, myRank) {
  return (RANK_PRIORITY[String(peerRank || '').trim()] || 0) >
    (RANK_PRIORITY[String(myRank || '').trim()] || 0);
}

/**
 * @param {string} hostUrl
 * @param {string} teamCode
 * @param {{ skipPing?: boolean }} [opts]
 * @returns {Promise<{ rank: string, isProgramAdmin: boolean } | null>}
 */
export async function fetchLanHostRank(hostUrl, teamCode, opts = {}) {
  const base = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const code = String(teamCode || '').trim();
  if (!base || !code) return null;
  if (!opts.skipPing) {
    const alive = await pingLanHostUrl(base, code);
    if (!alive) return null;
  }
  try {
    const resp = await fetch(`${base}/api/lan/v1/host-rank`, {
      headers: { Authorization: `Bearer ${code}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return parseLanHostRankResponse(data);
  } catch {
    return null;
  }
}

/**
 * @param {string[]} peerUrls
 * @param {string} teamCode
 * @param {{ rank: string, isProgramAdmin: boolean }} selfMeta
 */
function peerBeatsSelfElection(election) {
  return election === 'peer' || election === 'tie-peer';
}

/** @returns {'silent-join'|'confirm-consolidate'|'stay-warn'|'noop'} */
export function evaluatePeerHostAction(selfMeta, peerMeta, election) {
  if (election === 'self' || election === 'tie-self') {
    if (prefersLanHosting(peerMeta) && prefersLanHosting(selfMeta)) return 'stay-warn';
    return 'noop';
  }
  if (shouldAutoJoinPeerAsClient(peerMeta, selfMeta)) return 'silent-join';
  if (
    prefersLanHosting(selfMeta) &&
    (election === 'peer' || election === 'tie-peer')
  ) {
    return 'confirm-consolidate';
  }
  return 'noop';
}

function comparePeerCandidates(a, b) {
  const priDiff = lanHostPriority(b.peer) - lanHostPriority(a.peer);
  if (priDiff !== 0) return priDiff;
  const aStarted = Number(a.peer?.startedAt) || 0;
  const bStarted = Number(b.peer?.startedAt) || 0;
  const aMissing = aStarted <= 0;
  const bMissing = bStarted <= 0;
  if (!aMissing && bMissing) return -1;
  if (aMissing && !bMissing) return 1;
  if (aStarted !== bStarted) return aStarted - bStarted;
  return String(a.url).localeCompare(String(b.url));
}

/**
 * @param {string[]} peerUrls
 * @param {string} teamCode
 * @param {{ rank: string, isProgramAdmin: boolean, startedAt?: number }} selfMeta
 * @param {string} [selfUrl]
 */
export async function pickPreferredLanPeerHost(peerUrls, teamCode, selfMeta, selfUrl = '') {
  let best = null;
  for (const url of peerUrls || []) {
    const peer = await fetchLanHostRank(url, teamCode);
    if (!peer || !shouldAutoJoinPeerAsClient(peer, selfMeta)) continue;
    const election = resolveHostElection(selfMeta, peer, { selfUrl, peerUrl: url });
    if (!peerBeatsSelfElection(election)) continue;
    if (!best || comparePeerCandidates({ url, peer }, { url: best.url, peer: best.peer }) < 0) {
      best = { url, peer, election };
    }
  }
  return best;
}
