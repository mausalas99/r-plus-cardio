/**
 * Renderer policy helpers: local meta + peer pick (uses lan-host-rank.mjs).
 */
import { readRpcSettings } from './clinical-settings.mjs';
import { clinicalSessionContext } from './clinical-session-context.mjs';
import { userIsOnCallForLanHost } from './clinico-access.mjs';
import { mergeSalaGuardiaTodayRows } from './features/guardia-hoy-modal.mjs';
import { pickPreferredLanPeerHost as pickPeer, isClinicalRankConfiguredForLan, buildLocalLanHostMeta } from './lan-host-rank.mjs';

export {
  prefersLanHosting,
  fetchLanHostRank,
  shouldAutoJoinPeerAsClient,
  evaluatePeerHostAction,
  resolveHostElection,
  isClinicalRankConfiguredForLan,
  canLocalMacBeLanHost,
} from './lan-host-rank.mjs';

/** @type {{ rank?: string, isProgramAdmin?: boolean, startedAt?: number } | null} */
let _diskHostMeta = null;

/** @returns {boolean} */
export function resolveLocalOnCallGuardia() {
  try {
    const user = clinicalSessionContext?.user;
    const uid = String(user?.user_id || '').trim();
    if (!uid) return false;
    const teams = clinicalSessionContext?.teams || [];
    const salaGuardiaToday = mergeSalaGuardiaTodayRows(
      teams,
      clinicalSessionContext?.salaGuardiaToday || []
    );
    const rank = String(user?.rank || readRpcSettings()?.clinicalRank || '').trim();
    return userIsOnCallForLanHost(uid, rank, teams, new Date(), salaGuardiaToday);
  } catch {
    return false;
  }
}

/** @returns {{ rank: string, isProgramAdmin: boolean, isOnCallGuardia: boolean, rankConfigured: boolean, startedAt: number }} */
export function getLocalLanHostMeta() {
  try {
    const settings = readRpcSettings();
    const rankConfigured = isClinicalRankConfiguredForLan(settings);
    const startedAt = Number(_diskHostMeta?.startedAt) || 0;
    if (!rankConfigured) {
      return {
        rank: '',
        isProgramAdmin: false,
        isOnCallGuardia: false,
        rankConfigured: false,
        startedAt,
      };
    }
    const { rank, isProgramAdmin } = buildLocalLanHostMeta(settings);
    const isOnCallGuardia = resolveLocalOnCallGuardia();
    return {
      rank: rank || 'R1',
      isProgramAdmin: !!isProgramAdmin,
      isOnCallGuardia,
      rankConfigured: true,
      startedAt,
    };
  } catch {
    return {
      rank: '',
      isProgramAdmin: false,
      isOnCallGuardia: false,
      rankConfigured: false,
      startedAt: 0,
    };
  }
}

export async function syncLanHostClinicalMetaToDisk() {
  if (!isClinicalRankConfiguredForLan()) return false;
  if (
    typeof window === 'undefined' ||
    !window.electronAPI ||
    typeof window.electronAPI.syncLanHostClinicalMeta !== 'function'
  ) {
    return false;
  }
  const meta = { ...getLocalLanHostMeta() };
  delete meta.startedAt;
  delete meta.rankConfigured;
  meta.isOnCallGuardia = !!meta.isOnCallGuardia;
  try {
    const res = await window.electronAPI.syncLanHostClinicalMeta(meta);
    if (res?.ok && res.meta && typeof res.meta === 'object') {
      _diskHostMeta = res.meta;
    }
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

/**
 * @param {string[]} peerUrls
 * @param {string} teamCode
 */
export async function pickPreferredLanPeerHost(peerUrls, teamCode, selfUrl = '') {
  if (!isClinicalRankConfiguredForLan()) return null;
  return pickPeer(peerUrls, teamCode, getLocalLanHostMeta(), selfUrl);
}
