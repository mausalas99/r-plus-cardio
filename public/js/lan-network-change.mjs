/**
 * React to Electron main-process LAN network changes (Wi‑Fi / VLAN roam).
 */
import { lanNetworkProfile } from './lan-network-profile.mjs';
import { resumeAutoHostDetect } from './lan-host-detect-guard.mjs';
import { resetShiftPinBackoff } from './lan-shift-pin-connect.mjs';
import { storage } from './storage.js';
import { applyLanNetworkRoaming, applyLanNetworkRoamingWithFingerprint } from './lan-network-roam.mjs';
import { isLanElectronDesktop, isLanRemoteJoinMode } from './features/lan/transport.mjs';
import {
  recordWardHostUrl,
  syncWardHostUrlToMainFile,
  seedBundledWardConnectionPoints,
} from './lan-ward-host-registry.mjs';
import { isClinicalLocalOnlyMode, readRpcSettings } from './clinical-settings.mjs';

/** @type {ReturnType<typeof setTimeout> | null} */
let _networkChangeDebounceTimer = null;
/** @type {{ prefixes?: string[], candidateBaseUrl?: string } | null} */
let _networkChangePending = null;

async function restartLanDiscoveryAfterNetworkChange() {
  resumeAutoHostDetect();
  lanNetworkProfile.resetProfile();
  seedBundledWardConnectionPoints();

  const room = await import('./features/lan/room.mjs');
  if (typeof room.resumeAutoHostDetectAndReconnect === 'function') {
    room.resumeAutoHostDetectAndReconnect();
  }

  const panel = await import('./features/lan/panel.mjs');
  if (typeof panel.stopLanAutoDiscovery === 'function') panel.stopLanAutoDiscovery();
  if (typeof panel.startLanAutoDiscovery === 'function') panel.startLanAutoDiscovery();

  const transport = await import('./features/lan/transport.mjs');
  const pin = await import('./lan-shift-pin-connect.mjs');
  if (
    typeof transport.isLanSessionConfiguredForRest === 'function' &&
    !transport.isLanSessionConfiguredForRest() &&
    typeof pin.tryEasyLanShiftPinConnect === 'function'
  ) {
    const easy = await pin.tryEasyLanShiftPinConnect({
      silent: true,
      force: true,
      skipCooldown: true,
    });
    if (easy.ok) return;
  }
  if (typeof transport.initLanHostPlugAndPlay === 'function') {
    await transport.initLanHostPlugAndPlay();
  }
  if (isLanRemoteJoinMode()) {
    if (typeof pin.tryEasyLanShiftPinConnect === 'function') {
      await pin.tryEasyLanShiftPinConnect({ silent: true, force: true, skipCooldown: true });
    }
  } else {
    if (typeof transport.tryAutoJoinPreferredLanHost === 'function') {
      await transport.tryAutoJoinPreferredLanHost({ quiet: true });
    }
    if (typeof transport.ensureLanElectronHostReady === 'function') {
      await transport.ensureLanElectronHostReady();
    }
  }
}

/** @param {{ prefixes?: string[], candidateBaseUrl?: string }} payload */
async function handleLanNetworkChangedNow(payload) {
  if (!isLanElectronDesktop()) return;
  if (isClinicalLocalOnlyMode(readRpcSettings())) return;
  resetShiftPinBackoff();

  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const roamResult = await applyLanNetworkRoamingWithFingerprint(payload || {}, {
    savedHostUrl: cfg.hostUrl,
    teamCode: cfg.teamCode,
  });

  if (roamResult.shortcut) {
    const transport = await import('./features/lan/transport.mjs');
    if (typeof transport.persistLanClientConfig === 'function') {
      transport.persistLanClientConfig(roamResult.newUrl, cfg.teamCode);
    }
    return;
  }

  applyLanNetworkRoaming(payload || {});
  if (!isLanRemoteJoinMode()) {
    const candidate = String(payload?.candidateBaseUrl || '').trim();
    if (candidate) {
      recordWardHostUrl(candidate, { source: 'host' });
      syncWardHostUrlToMainFile(candidate, { source: 'host' });
    }
  }
  await restartLanDiscoveryAfterNetworkChange();
}

/** @param {{ prefixes?: string[], candidateBaseUrl?: string }} payload */
export function handleLanNetworkChanged(payload) {
  if (!isLanElectronDesktop()) return;
  if (isClinicalLocalOnlyMode(readRpcSettings())) return;
  _networkChangePending = payload || {};
  if (_networkChangeDebounceTimer) return;
  _networkChangeDebounceTimer = setTimeout(function () {
    _networkChangeDebounceTimer = null;
    const pending = _networkChangePending;
    _networkChangePending = null;
    void handleLanNetworkChangedNow(pending || {});
  }, 3000);
}
