/**
 * Shared globalThis bridge slots for LAN sync (esbuild may duplicate modules across chunks).
 */

/** @param {string} key */
function createLanSyncBridgeGlobal(key) {
  return {
    get() {
      return globalThis[key];
    },
    set(value) {
      globalThis[key] = value;
    },
  };
}

export const LAN_SYNC_PUSH_BRIDGE_KEY = '__LAN_SYNC_PUSH_BRIDGE__';
export const LAN_SYNC_ROOM_BRIDGE_KEY = '__LAN_SYNC_ROOM_BRIDGE__';
export const LAN_SYNC_TRANSPORT_DEPS_KEY = '__LAN_SYNC_TRANSPORT_DEPS__';

const pushBridgeGlobal = createLanSyncBridgeGlobal(LAN_SYNC_PUSH_BRIDGE_KEY);
const roomBridgeGlobal = createLanSyncBridgeGlobal(LAN_SYNC_ROOM_BRIDGE_KEY);
const transportDepsGlobal = createLanSyncBridgeGlobal(LAN_SYNC_TRANSPORT_DEPS_KEY);

export const lanSyncPushBridgeGlobal = pushBridgeGlobal.get;
export const setLanSyncPushBridgeGlobal = pushBridgeGlobal.set;

export const lanSyncRoomBridgeGlobal = roomBridgeGlobal.get;
export const setLanSyncRoomBridgeGlobal = roomBridgeGlobal.set;

export const lanSyncTransportDepsGlobal = transportDepsGlobal.get;
export const setLanSyncTransportDepsGlobal = transportDepsGlobal.set;
