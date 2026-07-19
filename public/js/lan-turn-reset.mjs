/**
 * Reset LAN turn connection (split-brain recovery): leave room, clear pinned host,
 * stop using this Mac as REST host, reconnect via PIN or invite.
 */
import { storage } from './storage.js';
import { clearPinnedHostUrl } from './lan-host-pin.mjs';
import {
  clearWardHostRegistry as clearLocalWardHostRegistry,
  seedBundledWardConnectionPoints,
} from './lan-ward-host-registry.mjs';

export const LAN_TURN_RESET_CLIENT_CONFIRM =
  'Saldrás de la sala ⇄, se quitará el anfitrión fijado y esta Mac dejará de actuar como servidor del turno. Tu base clínica y equipos no se borran. Después buscaremos al anfitrión del turno en la Wi‑Fi. ¿Restablecer?';

const SPLIT_BRAIN_HINT_KEY = 'rpc-lan-split-brain-hint-shown';

/**
 * @param {{ leaveLiveSyncRoom: (opts?: object) => void, lanClient: { disconnect?: () => void } }} deps
 */
export async function performLanTurnClientReset(deps) {
  if (typeof deps.leaveLiveSyncRoom === 'function') {
    deps.leaveLiveSyncRoom({ silentLeave: true });
  }
  clearPinnedHostUrl();
  clearLocalWardHostRegistry();
  seedBundledWardConnectionPoints();
  if (typeof storage.saveLanUiRole === 'function') storage.saveLanUiRole('client');
  if (typeof storage.saveLanConfig === 'function') storage.saveLanConfig(null);
  try {
    if (deps.lanClient && typeof deps.lanClient.disconnect === 'function') {
      deps.lanClient.disconnect();
    }
  } catch (_e) { void _e; }
  try {
    sessionStorage.removeItem(SPLIT_BRAIN_HINT_KEY);
  } catch (_e) { void _e; }
  return { mode: 'client' };
}
