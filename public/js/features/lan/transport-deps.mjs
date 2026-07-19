/**
 * LAN transport DI wiring (esbuild may duplicate transport across chunks).
 */
import { esc } from '../../dom-escape.mjs';
import {
  lanSyncTransportDepsGlobal,
  setLanSyncTransportDepsGlobal,
} from './lan-sync-bridge-globals.mjs';

export { esc };

/** @type {{ runtime?: object, renderLanPanel?: () => void, joinLanRoom?: Function, resolveAutoJoinRoomId?: Function, openConnectionDropdown?: Function, bootLanRoomMembership?: Function } | null} */
let transportDeps = null;

/** @type {Promise<void> | null} */
var transportDepsWirePromise = null;

export function registerLanSyncTransportDeps(deps) {
  transportDeps = deps && typeof deps === 'object' ? deps : null;
  if (transportDeps && typeof globalThis !== 'undefined') {
    setLanSyncTransportDepsGlobal(transportDeps);
  }
}

/**
 * Ensures orchestrator boot wiring ran (esbuild may load transport before registerLanSyncTransportDeps).
 * @returns {Promise<void>}
 */
export function ensureLanSyncTransportDepsWired() {
  if (transportDeps) return Promise.resolve();
  if (typeof globalThis !== 'undefined') {
    var cached = lanSyncTransportDepsGlobal();
    if (cached && typeof cached === 'object') {
      transportDeps = cached;
      return Promise.resolve();
    }
  }
  if (!transportDepsWirePromise) {
    transportDepsWirePromise = import('./orchestrator.mjs').then(function () {
      if (!transportDeps && typeof globalThis !== 'undefined') {
        var g = lanSyncTransportDepsGlobal();
        if (g && typeof g === 'object') transportDeps = g;
      }
    });
  }
  return transportDepsWirePromise;
}

export function deps() {
  if (!transportDeps && typeof globalThis !== 'undefined') {
    var cached = lanSyncTransportDepsGlobal();
    if (cached && typeof cached === 'object') transportDeps = cached;
  }
  if (!transportDeps) throw new Error('lan-sync-transport: registerLanSyncTransportDeps() not called');
  return transportDeps;
}

export function runtime() {
  return deps().runtime || { showToast() {} };
}
