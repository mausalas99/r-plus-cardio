'use strict';

const { verifyTeamCode } = require('./team-code.js');

function tryParseMessage(raw) {
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function handleAuthMessage(ws, raw, { getState, joinRoom, terminateUnauthenticated }) {
  const msg = tryParseMessage(raw);
  if (!msg || msg.type !== 'auth' || !msg.token) {
    terminateUnauthenticated(ws);
    return true;
  }
  let st;
  try {
    st = getState();
  } catch {
    terminateUnauthenticated(ws);
    return true;
  }
  if (!verifyTeamCode(msg.token, st.teamCodeHash)) {
    terminateUnauthenticated(ws);
    return true;
  }
  clearTimeout(ws.__authTimer);
  ws.__authTimer = null;
  ws.__authenticated = true;
  joinRoom(ws, ws.__channel || 'sync');
  return true;
}

function handleDeltaMessage(ws, msg, { deltaResolver, broadcast, channel }) {
  if (msg.type !== 'livesync:delta' || !msg.delta || !deltaResolver) return false;
  try {
    const out = deltaResolver.applyDelta({
      ...msg.delta,
      roomId: msg.roomId,
      clientId: msg.clientId || msg.delta.clientId,
    });
    const applied = {
      type: 'livesync:delta:applied',
      ...out,
    };
    broadcast(channel, applied);
    if (out.ok) {
      broadcast(channel, {
        type: 'livesync:revision',
        roomId: msg.roomId,
        revision: out.revision || 0,
        clientId: msg.clientId || 'host',
      });
    }
  } catch {
    ws.close();
  }
  return true;
}

function handlePatchMessage(ws, msg, { resolver, broadcast, channel }) {
  if (msg.type !== 'livesync:patch' || !msg.mutation || !resolver) return false;
  try {
    const out = resolver.applyMutation({
      ...msg.mutation,
      clientId: msg.clientId,
      roomId: msg.roomId,
    });
    const applied = {
      type: 'livesync:applied',
      roomId: msg.roomId,
      entityType: out.entityType,
      entityId: out.entityId,
      version: out.version,
      data: out.data,
      autoMerged: out.autoMerged,
      patientId: msg.mutation.patientId,
    };
    if (out.lwwApplied) applied.lwwApplied = true;
    if (Array.isArray(out.overwrittenKeys) && out.overwrittenKeys.length) {
      applied.overwrittenKeys = out.overwrittenKeys;
    }
    broadcast(channel, applied);
  } catch (e) {
    if (e.code === 'CONFLICT') {
      ws.send(
        JSON.stringify({
          type: 'livesync:conflict',
          roomId: msg.roomId,
          entityType: msg.mutation.entityType,
          entityId: msg.mutation.entityId,
          patientId: msg.mutation.patientId,
          conflictingKeys: e.conflictingKeys,
          server: { version: e.serverVersion, data: e.serverData },
          client: {
            version: e.expectedVersion,
            data: e.clientData,
            op: msg.mutation.op,
          },
          expectedVersion: e.expectedVersion,
        })
      );
      return true;
    }
    ws.close();
  }
  return true;
}

function handleLiveRelay(msg, { broadcast, channel }) {
  if (!channel.startsWith('live:')) return false;
  broadcast(channel, msg);
  return true;
}

function createMessageHandler(deps) {
  return function onWsMessage(ws, raw) {
    if (!ws.__authenticated) {
      handleAuthMessage(ws, raw, deps);
      return;
    }

    const msg = tryParseMessage(raw);
    if (!msg) return;

    const channel = ws.__channel || 'sync';
    if (msg.clientId && !ws.__clientId) ws.__clientId = msg.clientId;
    if (msg.capabilities && typeof msg.capabilities === 'object') {
      ws.__capabilities = msg.capabilities;
    }

    if (handleDeltaMessage(ws, msg, { ...deps, channel })) return;
    if (handlePatchMessage(ws, msg, { ...deps, channel })) return;
    handleLiveRelay(msg, { ...deps, channel });
  };
}

module.exports = {
  createMessageHandler,
  handleAuthMessage,
  handleDeltaMessage,
  handlePatchMessage,
};
