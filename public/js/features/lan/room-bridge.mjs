/**
 * LAN room bridge registry (avoids circular import with orchestrator).
 */
import {
  shouldApplyCommandBroadcast,
  updateCommandSeqState,
} from '../../lan-command-room-order.mjs';
import {
  lanSyncRoomBridgeGlobal,
  setLanSyncRoomBridgeGlobal,
} from './lan-sync-bridge-globals.mjs';

/** @type {Record<string, unknown> | null} */
let roomBridge = null;

/** @type {Promise<void> | null} */
var roomBridgeWirePromise = null;

export function registerLanSyncRoomBridge(deps) {
  roomBridge = deps && typeof deps === 'object' ? deps : null;
  if (roomBridge && typeof globalThis !== 'undefined') {
    setLanSyncRoomBridgeGlobal(roomBridge);
  }
}

export function ensureLanSyncRoomBridgeWired() {
  if (roomBridge) return Promise.resolve();
  if (typeof globalThis !== 'undefined') {
    var cached = lanSyncRoomBridgeGlobal();
    if (cached && typeof cached === 'object') {
      roomBridge = cached;
      return Promise.resolve();
    }
  }
  if (!roomBridgeWirePromise) {
    roomBridgeWirePromise = import('./orchestrator.mjs').then(function () {
      if (!roomBridge && typeof globalThis !== 'undefined') {
        var g = lanSyncRoomBridgeGlobal();
        if (g && typeof g === 'object') roomBridge = g;
      }
    });
  }
  return roomBridgeWirePromise;
}

export function bridge() {
  if (!roomBridge && typeof globalThis !== 'undefined') {
    var cached = lanSyncRoomBridgeGlobal();
    if (cached && typeof cached === 'object') roomBridge = cached;
  }
  if (!roomBridge) throw new Error('lan-sync-room: registerLanSyncRoomBridge() not called');
  return roomBridge;
}

export function runtime() {
  return bridge().runtime || { showToast() {} };
}

/** Tracks last applied command broadcast sequence for gap detection. */
var commandSeqState = { lastAppliedSeq: 0, lastAckedCommandId: '' };

export function getCommandSeqState() {
  return commandSeqState;
}

export function setCommandSeqState(next) {
  commandSeqState = next;
}

export { shouldApplyCommandBroadcast, updateCommandSeqState };
