'use strict';

const { createCommandRegistry } = require('./command-registry.js');

function createCommandResolver(store, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const registry = opts.registry || createCommandRegistry();
  const nowIso = typeof opts.nowIso === 'function' ? opts.nowIso : () => new Date().toISOString();
  function applyCommand(command) {
    const roomId = String(command && command.roomId || '').trim();
    const commandId = String(command && command.commandId || '').trim();
    const existing = store.getAppliedCommand(roomId, commandId);
    if (existing) {
      return {
        ok: true,
        status: 'duplicate_ignored',
        commandId,
        deltaSeq: existing.deltaSeq,
        revision: existing.revision,
      };
    }

    const latestDeltaSeq = Number(store.getRoomSyncBundle(roomId)?.deltaSeq || 0);
    const validation = registry.validateCommand(command, { latestDeltaSeq });
    if (!validation.ok) return { ok: false, ...validation };

    const current = store.getCommandEntityState(roomId, command);
    const applied = registry.applyCommand(command, { data: current.data, meta: current.meta });
    if (!applied.ok) return { ok: false, ...applied };
    if (applied.status === 'duplicate_ignored') {
      return {
        ok: true,
        status: 'duplicate_ignored',
        commandId,
        deltaSeq: latestDeltaSeq,
        revision: Number(store.getRoomSyncBundle(roomId)?.revision || 0),
      };
    }

    const commit = store.commitCommandEntity({
      roomId,
      command,
      data: applied.data,
      meta: applied.meta,
      status: applied.status,
      nowIsoOverride: nowIso(),
    });

    return {
      ok: true,
      status: 'accepted',
      commandId,
      domain: command.domain,
      op: command.op,
      roomId,
      patientId: command.patientId,
      entityId: command.entityId,
      deltaSeq: commit.deltaSeq,
      revision: commit.revision,
      committedAt: commit.committedAt,
      materialized: false,
      clockDriftWarning: !!validation.clockDriftWarning,
      payload: command.payload,
    };
  }

  return { applyCommand };
}

module.exports = { createCommandResolver };
