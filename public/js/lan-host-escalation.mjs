/**
 * When no R4/program-admin host is reachable, lower ranks may host on a timer:
 * 10 min → R3, +10 min → R2, +10 min → R1 (still prefer joining higher peers when seen).
 */

export const LAN_HOST_ESCALATION_STEP_MS = 10 * 60 * 1000;

const WARD_SEEN_KEY = 'rpc-lan-last-ward-host-seen-at';
const ESCALATION_ANCHOR_KEY = 'rpc-lan-host-escalation-anchor-at';
const R2_PLUS_SEEN_KEY = 'rpc-lan-last-r2plus-host-seen-at';

const RANK_PRIORITY = { R1: 1, R2: 2, R3: 3, R4: 4, Admin: 5 };

function readTs(key) {
  try {
    const n = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeTs(key, ms) {
  try {
    localStorage.setItem(key, String(ms));
  } catch (_e) { void _e; }
}

function clearKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (_e) { void _e; }
}

/** @param {{ rank?: string, isProgramAdmin?: boolean }|null|undefined} meta */
export function isWardTierHostMeta(meta) {
  if (!meta) return false;
  if (meta.isProgramAdmin) return true;
  const rank = String(meta.rank || '').trim();
  return (RANK_PRIORITY[rank] || 0) >= RANK_PRIORITY.R4;
}

/** @param {{ rank?: string, isProgramAdmin?: boolean }|null|undefined} meta */
export function rankPriority(meta) {
  if (!meta) return 0;
  if (meta.isProgramAdmin) return RANK_PRIORITY.Admin;
  return RANK_PRIORITY[String(meta.rank || '').trim()] || 0;
}

/** R4/admin peer or self was seen — reset escalation. */
export function markWardTierHostSeen(nowMs = Date.now()) {
  writeTs(WARD_SEEN_KEY, nowMs);
  clearKey(ESCALATION_ANCHOR_KEY);
}

/** R2+ peer responded on the LAN (for status copy during R2 search window). */
export function markR2PlusHostSeen(nowMs = Date.now()) {
  writeTs(R2_PLUS_SEEN_KEY, nowMs);
}

/** Begin counting when no ward-tier host is on the network. */
export function ensureEscalationAnchor(nowMs = Date.now()) {
  if (readTs(ESCALATION_ANCHOR_KEY)) return;
  writeTs(ESCALATION_ANCHOR_KEY, nowMs);
}

export function clearHostEscalation() {
  clearKey(ESCALATION_ANCHOR_KEY);
  clearKey(WARD_SEEN_KEY);
  clearKey(R2_PLUS_SEEN_KEY);
}

/**
 * 0 = R4+ only, 1 = R3+, 2 = R2+, 3 = R1+.
 * @param {number} [nowMs]
 */
export function getHostEscalationTier(nowMs = Date.now()) {
  const anchor = readTs(ESCALATION_ANCHOR_KEY);
  if (!anchor) return 0;
  const elapsed = Math.max(0, nowMs - anchor);
  if (elapsed < LAN_HOST_ESCALATION_STEP_MS) return 0;
  if (elapsed < 2 * LAN_HOST_ESCALATION_STEP_MS) return 1;
  if (elapsed < 3 * LAN_HOST_ESCALATION_STEP_MS) return 2;
  return 3;
}

/** Minimum clinical rank priority allowed to host at this tier. */
export function minHostRankPriorityForTier(tier) {
  const t = Math.max(0, Math.min(3, Number(tier) || 0));
  return [RANK_PRIORITY.R4, RANK_PRIORITY.R3, RANK_PRIORITY.R2, RANK_PRIORITY.R1][t];
}

/**
 * @param {{ rank?: string, isProgramAdmin?: boolean }|null|undefined} meta
 * @param {number} [tier]
 */
export function canRankHostAtEscalationTier(meta, tier = getHostEscalationTier()) {
  if (!meta) return false;
  if (isWardTierHostMeta(meta)) return true;
  return rankPriority(meta) >= minHostRankPriorityForTier(tier);
}

/**
 * @param {number} [nowMs]
 * @returns {{ tier: number, anchorAt: number, msUntilNext: number, minRankLabel: string }}
 */
export function getHostEscalationStatus(nowMs = Date.now()) {
  const tier = getHostEscalationTier(nowMs);
  const anchor = readTs(ESCALATION_ANCHOR_KEY);
  const labels = ['R4', 'R3', 'R2', 'R1'];
  let msUntilNext = 0;
  if (anchor && tier < 3) {
    msUntilNext = (tier + 1) * LAN_HOST_ESCALATION_STEP_MS - (nowMs - anchor);
    if (msUntilNext < 0) msUntilNext = 0;
  }
  return {
    tier,
    anchorAt: anchor,
    msUntilNext,
    minRankLabel: labels[tier] || 'R4',
    lastR2PlusSeenAt: readTs(R2_PLUS_SEEN_KEY),
  };
}

/** @param {number} ms */
export function formatEscalationCountdown(ms) {
  const sec = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min <= 0) return rem + ' s';
  return min + ' min' + (rem > 0 ? ' ' + rem + ' s' : '');
}

/**
 * @param {Array<{ rank?: string, isProgramAdmin?: boolean }|null|undefined>} peerMetas
 * @param {number} [nowMs]
 */
export function updateLanHostEscalationFromPeerMetas(peerMetas, nowMs = Date.now()) {
  let sawWard = false;
  let sawOnCallHost = false;
  for (const meta of peerMetas || []) {
    if (!meta) continue;
    if (meta.isOnCallGuardia) sawOnCallHost = true;
    if (isWardTierHostMeta(meta)) sawWard = true;
    if (rankPriority(meta) >= RANK_PRIORITY.R2) markR2PlusHostSeen(nowMs);
  }
  if (sawWard || sawOnCallHost) markWardTierHostSeen(nowMs);
  else ensureEscalationAnchor(nowMs);
}
