/**
 * Boot LAN client from persisted rpc-lan-config.
 */
import { storage } from '../../storage.js';
import { isMobileWeb } from '../../mobile-web.mjs';
import { restoreMobilePairingFromStorage } from '../../mobile-lan-query-persist.mjs';
import { liveSyncRoomLabel } from '../../lan-join-link.mjs';
import { lanClient } from './runtime.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { deps, ensureLanSyncTransportDepsWired } from './transport-deps.mjs';
import { persistLanClientConfig } from './transport-session.mjs';
import { fixMobileLanHostUrl } from './transport-mobile.mjs';

export function initLanClientFromStorage() {
  if (isMobileWeb()) restoreMobilePairingFromStorage();
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() : null;
  if (!cfg || !String(cfg.hostUrl || '').trim()) return;
  var hostUrl = fixMobileLanHostUrl(cfg.hostUrl);
  var teamCode = cfg.teamCode;
  if (hostUrl !== String(cfg.hostUrl || '').trim().replace(/\/+$/, '')) {
    storage.saveLanConfig({ hostUrl: hostUrl, teamCode: teamCode });
  }
  persistLanClientConfig(hostUrl, teamCode);
  if (isMobileWeb()) {
    return;
  }
  try {
    lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  setTimeout(function () {
    void ensureLanSyncTransportDepsWired().then(function () {
      var d = deps();
      var mem = getRoomMembership();
      if (mem && mem.roomId && typeof d.bootLanRoomMembership === 'function') {
        d.bootLanRoomMembership();
        return;
      }
      if (typeof d.resolveAutoJoinRoomId !== 'function' || typeof d.joinLanRoom !== 'function') return;
      var autoRoomId = d.resolveAutoJoinRoomId('');
      if (!autoRoomId) return;
      void d.joinLanRoom(autoRoomId, liveSyncRoomLabel(autoRoomId));
    });
  }, 500);
}
