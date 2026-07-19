/**
 * Temporary equipos host promotion when ward host unreachable.
 */
import { rankPriority } from '../lan-host-escalation.mjs';
import { getLocalLanHostMeta } from '../lan-host-rank-policy.mjs';
import { resolveLanHostUrlAuto } from './lan/transport.mjs';

function dbApi() {
  return window.rplusDb || window.electronAPI || null;
}

/** @param {{ rank?: string, isProgramAdmin?: boolean }} peer */
export function shouldYieldEquiposToPeer(peer) {
  const self = getLocalLanHostMeta();
  return rankPriority(peer) > rankPriority(self);
}

/**
 * @param {{ showToast: (msg: string, kind?: string) => void, rememberedPrimaryUrl?: string, userId?: string, name?: string, rank?: string }} opts
 */
export async function promoteSelfToEquiposHost(opts) {
  const api = dbApi();
  if (!api?.dbEquiposPromoteTemporaryHost) return false;
  if (typeof window !== 'undefined' && window.electronAPI?.ensureLanServerReady) {
    await window.electronAPI.ensureLanServerReady();
  }
  const hostUrl = await resolveLanHostUrlAuto();
  if (!hostUrl) {
    opts.showToast('No se pudo resolver la URL del host local.', 'error');
    return false;
  }
  const meta = getLocalLanHostMeta();
  await api.dbEquiposPromoteTemporaryHost({
    hostUrl,
    userId: opts.userId,
    name: opts.name,
    rank: opts.rank || meta.rank,
    rememberedPrimaryUrl: opts.rememberedPrimaryUrl || '',
  });
  opts.showToast(
    'Anfitrión temporal de equipos activo en esta Mac hasta que vuelva un anfitrión de mayor rango.',
    'success'
  );
  return true;
}

/**
 * @param {string} primaryUrl
 * @param {object} snapshot
 */
export async function mergeEquiposToPrimary(primaryUrl, snapshot) {
  const api = dbApi();
  if (!api?.dbEquiposMergeSnapshot) return;
  await api.dbEquiposMergeSnapshot({ snapshot });
  const tokenRes = await api.dbEquiposAccessGet?.();
  const token = tokenRes?.row?.access_token;
  if (!token || !primaryUrl) return;
  try {
    await fetch(`${primaryUrl.replace(/\/+$/, '')}/api/equipos/v1/host/merge?t=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Equipos-Token': token },
      body: JSON.stringify({ snapshot }),
    });
  } catch (_e) {
    void _e;
  }
}
