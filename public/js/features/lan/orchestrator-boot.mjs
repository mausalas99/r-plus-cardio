/** LAN orchestrator cold-start boot (IM-11). */
import { upsertHost, evictStale } from '../../lan-host-registry.mjs';
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import {
  isLanElectronDesktop,
  initLanClientFromStorage,
} from './transport.mjs';
import {
  wireClinicalOpsLanSyncEvents,
  wireLanPanelDelegation,
  startLanAutoDiscovery,
} from './panel.mjs';
import { wireLanSyncBridges } from './orchestrator-wire.mjs';
import { scheduleTierALanServerWarm } from './orchestrator-runtime.mjs';

let _lanRuntimeStarted = false;
let _lanRegistryEvictionStarted = false;

function wireLanHostRegistryDiscovery() {
  if (typeof window === 'undefined') return;
  if (window.electronAPI?.onLanMdnsPeers) {
    window.electronAPI.onLanMdnsPeers((peers) => {
      if (!Array.isArray(peers)) return;
      peers.forEach((peer) => {
        if (!peer?.clientId || !peer?.startedAt) return;
        upsertHost({
          fingerprint: `${peer.clientId}:${peer.startedAt}`,
          clientId: peer.clientId,
          startedAt: peer.startedAt,
          currentUrl: peer.url,
          rank: peer.rank || '',
          dbUnlocked: false,
          shiftPinActive: false,
          rttMs: 0,
          lastSeenAt: Date.now(),
          source: 'mdns',
        });
      });
    });
  }
  if (!_lanRegistryEvictionStarted) {
    _lanRegistryEvictionStarted = true;
    setInterval(() => evictStale(90_000), 30_000);
  }
}

export function ensureLanSyncRuntimeStarted() {
  if (typeof document === 'undefined') return;
  if (isClinicalLocalOnlyMode(readRpcSettings())) return;
  if (_lanRuntimeStarted) return;
  _lanRuntimeStarted = true;
  wireLanSyncBridges();
  initLanClientFromStorage();
  wireClinicalOpsLanSyncEvents();
  wireLanPanelDelegation();
  wireLanHostRegistryDiscovery();
  if (isLanElectronDesktop()) {
    scheduleTierALanServerWarm();
    startLanAutoDiscovery();
  }
}
