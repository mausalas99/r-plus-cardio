'use strict';

function createRoomRegistry() {
  const rooms = new Map();

  function joinRoom(ws, name) {
    if (!rooms.has(name)) rooms.set(name, new Set());
    rooms.get(name).add(ws);
    ws.__rooms = ws.__rooms || new Set();
    ws.__rooms.add(name);
  }

  function leaveAll(ws) {
    if (!ws.__rooms) return;
    for (const name of ws.__rooms) {
      const set = rooms.get(name);
      if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(name);
      }
    }
    ws.__rooms.clear();
  }

  function broadcast(name, obj) {
    const set = rooms.get(name);
    if (!set) return;
    const payload = JSON.stringify(obj);
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  return { joinRoom, leaveAll, broadcast };
}

function terminateUnauthenticated(ws) {
  try {
    clearTimeout(ws.__authTimer);
  } catch (_e) { void _e; }
  try {
    ws.terminate();
  } catch (_e) { void _e; }
}

module.exports = { createRoomRegistry, terminateUnauthenticated };
