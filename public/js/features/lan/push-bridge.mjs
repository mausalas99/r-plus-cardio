/**
 * LAN push bridge registry (avoids circular import with orchestrator).
 */
import {
  lanSyncPushBridgeGlobal,
  setLanSyncPushBridgeGlobal,
} from './lan-sync-bridge-globals.mjs';

/** @type {Record<string, unknown> | null} */
let pushBridge = null;

/** @type {Promise<void> | null} */
var pushBridgeWirePromise = null;

export function registerLanSyncPushBridge(deps) {
  pushBridge = deps && typeof deps === 'object' ? deps : null;
  if (pushBridge && typeof globalThis !== 'undefined') {
    setLanSyncPushBridgeGlobal(pushBridge);
  }
}

export function ensureLanSyncPushBridgeWired() {
  if (pushBridge) return Promise.resolve();
  if (typeof globalThis !== 'undefined') {
    var cached = lanSyncPushBridgeGlobal();
    if (cached && typeof cached === 'object') {
      pushBridge = cached;
      return Promise.resolve();
    }
  }
  if (!pushBridgeWirePromise) {
    pushBridgeWirePromise = import('./orchestrator.mjs').then(function () {
      if (!pushBridge && typeof globalThis !== 'undefined') {
        var g = lanSyncPushBridgeGlobal();
        if (g && typeof g === 'object') pushBridge = g;
      }
    });
  }
  return pushBridgeWirePromise;
}

export function bridge() {
  if (!pushBridge && typeof globalThis !== 'undefined') {
    var cached = lanSyncPushBridgeGlobal();
    if (cached && typeof cached === 'object') pushBridge = cached;
  }
  if (!pushBridge) {
    throw new Error('lan-sync-push: registerLanSyncPushBridge() not called');
  }
  return pushBridge;
}
