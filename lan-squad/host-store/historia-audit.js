'use strict';

const { historiaClinicaEntityKey } = require('../entity-keys.js');
const {
  writeHistoriaClinicaArchive,
  resolveStorageRoot,
} = require('../../lib/historia-clinica/storage.js');
const { appendAudit } = require('../audit-log.js');
const { nowIso } = require('./utils.js');

function createHistoriaAuditHandlers(ctx) {
  function appendRoomBundleAuditInMemory(roomId, entry) {
    const state = ctx.ensureLoadedSync();
    const bundle = ctx.ensureRoomBundle(state, roomId);
    if (!Array.isArray(bundle.audit_log)) bundle.audit_log = [];
    appendAudit(entry, bundle.audit_log);
    return bundle.audit_log;
  }

  function appendRoomBundleAudit(roomId, entry) {
    appendRoomBundleAuditInMemory(roomId, entry);
    ctx.markDirty(roomId);
    void ctx.schedulePersist();
    return ctx.ensureRoomBundle(ctx.ensureLoadedSync(), roomId).audit_log;
  }

  function putHistoriaClinicaQueued(resolver, mutation, auditTemplate) {
    return ctx.queue.enqueue(async () => {
      ctx.ensureLoadedSync();
      const out = resolver.applyMutation(mutation, { deferPersist: true });
      if (auditTemplate) {
        const entry = {
          at: auditTemplate.at || nowIso(),
          clientId: auditTemplate.clientId || 'unknown',
          action: auditTemplate.action || 'historia_clinica.save',
          detail: {
            ...(auditTemplate.detail || {}),
            entityVersion: out.version,
            autoMerged: !!out.autoMerged,
          },
        };
        appendRoomBundleAuditInMemory(mutation.roomId, entry);
      }
      ctx.markDirty(mutation.roomId);
      await ctx.flushCacheNow({ serialized: true });
      return out;
    });
  }

  function archiveHistoriaClinicaForPatient(patientId, { storageRoot } = {}) {
    const pid = String(patientId || '').trim();
    if (!pid) return { archived: false, reason: 'no_patient_id' };
    const state = ctx.ensureLoadedSync();
    let found = false;
    for (const rid of Object.keys(state.roomSyncBundles || {})) {
      const bundle = state.roomSyncBundles[rid];
      if (!bundle || !bundle.entities) continue;
      const key = historiaClinicaEntityKey(pid);
      const rec = bundle.entities[key];
      if (!rec || rec.deleted) continue;
      writeHistoriaClinicaArchive({
        storageRoot: storageRoot || resolveStorageRoot(),
        patientId: pid,
        payload: {
          version: rec.version,
          data: rec.data,
          roomId: rid,
        },
      });
      delete bundle.entities[key];
      if (bundle.entityVersions && bundle.entityVersions[key] != null) {
        delete bundle.entityVersions[key];
      }
      bundle.revision = Number(bundle.revision || 0) + 1;
      ctx.markDirty(rid);
      found = true;
    }
    if (found) {
      ctx.markDirty(null);
      void ctx.schedulePersist();
    }
    return { archived: found, patientId: pid };
  }

  return {
    appendRoomBundleAuditInMemory,
    appendRoomBundleAudit,
    putHistoriaClinicaQueued,
    archiveHistoriaClinicaForPatient,
  };
}

module.exports = { createHistoriaAuditHandlers };
