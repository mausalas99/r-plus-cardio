'use strict';

const internoRooms = new Map();

function internoRoomKey(sala) {
  return `interno:${sala}`;
}

function broadcastInterno(sala, obj) {
  const set = internoRooms.get(internoRoomKey(sala));
  if (!set) return;
  const payload = JSON.stringify(obj);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

function addInternoRoomClient(sala, ws) {
  const key = internoRoomKey(sala);
  if (!internoRooms.has(key)) internoRooms.set(key, new Set());
  internoRooms.get(key).add(ws);
}

function removeInternoRoomClient(sala, ws) {
  const set = internoRooms.get(internoRoomKey(sala));
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) internoRooms.delete(internoRoomKey(sala));
}

module.exports = {
  internoRoomKey,
  broadcastInterno,
  addInternoRoomClient,
  removeInternoRoomClient,
};
