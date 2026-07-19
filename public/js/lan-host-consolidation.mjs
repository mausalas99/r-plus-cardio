/**
 * Pure LAN host consolidation orchestration (node-testable; wired from transport.mjs).
 */
import { hostBundlePutBodyFromEnvelope } from './host-bundle-bases.mjs';

let _consolidating = false;

/**
 * @param {string} hostUrl
 * @param {string} teamCode
 * @param {string} roomId
 * @param {object} envelope
 */
export async function pushBundleToHostUrl(hostUrl, teamCode, roomId, envelope) {
  const base = String(hostUrl || '').trim().replace(/\/+$/, '');
  const code = String(teamCode || '').trim();
  const rid = String(roomId || '').trim();
  if (!base || !code || !rid || !envelope) return false;
  const url =
    base + '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/sync-bundle';
  const body = hostBundlePutBodyFromEnvelope(rid, envelope);
  if (envelope.clientId) body.uploadedByClientId = envelope.clientId;
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + code,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle: body }),
      signal: AbortSignal.timeout(15000),
    });
    return !!(resp && resp.ok);
  } catch {
    return false;
  }
}

/**
 * @param {{ winnerUrl: string, teamCode: string, requireConfirm?: boolean }} opts
 * @param {{
 *   getRoomId: () => string,
 *   buildBundle: (roomId: string) => Promise<object>,
 *   pushBundle: (url: string, code: string, roomId: string, env: object) => Promise<boolean>,
 *   broadcastHandoff: (url: string, code: string, roomId: string) => Promise<void>,
 *   switchToClient: (url: string, code: string) => Promise<void>,
 *   confirmYield?: () => Promise<boolean>,
 *   showToast?: (msg: string, kind: string) => void,
 * }} deps
 */
async function executeConsolidationPush(deps, winnerUrl, teamCode, roomId) {
  const envelope = await deps.buildBundle(roomId);
  const pushed = await deps.pushBundle(winnerUrl, teamCode, roomId, envelope);
  if (!pushed) {
    deps.showToast?.('No se pudo combinar con el anfitrión; sigues como servidor.', 'error');
    return false;
  }
  await deps.broadcastHandoff(winnerUrl, teamCode, roomId);
  await deps.switchToClient(winnerUrl, teamCode);
  deps.showToast?.('Servidores combinados — ahora conectado al anfitrión del turno.', 'success');
  return true;
}

export async function runConsolidateIntoHost(opts, deps) {
  if (_consolidating) return false;
  const winnerUrl = String(opts?.winnerUrl || '').trim().replace(/\/+$/, '');
  const teamCode = String(opts?.teamCode || '').trim();
  if (!winnerUrl || !teamCode) return false;
  if (opts?.requireConfirm && typeof deps.confirmYield === 'function') {
    if (!(await deps.confirmYield())) return false;
  }
  const roomId = typeof deps.getRoomId === 'function' ? deps.getRoomId() : '';
  if (!roomId) {
    deps.showToast?.('Únete primero a una sala ⇄ para combinar con el anfitrión.', 'warn');
    return false;
  }

  _consolidating = true;
  try {
    return await executeConsolidationPush(deps, winnerUrl, teamCode, roomId);
  } finally {
    _consolidating = false;
  }
}
