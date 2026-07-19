export function createMutationBuilder(entityType, entityId) {
  let base = null;
  const working = {};
  const changedKeys = new Set();

  return {
    captureBase(snapshot) {
      base = structuredClone(snapshot);
      Object.assign(working, structuredClone(snapshot));
      return this;
    },
    set(key, value) {
      changedKeys.add(key);
      working[key] = value;
      return this;
    },
    build(extra = {}) {
      return {
        entityType,
        entityId,
        expectedVersion: Number(base?.version ?? 0),
        baseData: base,
        changedKeys: [...changedKeys],
        data: { ...working },
        ...extra,
      };
    },
  };
}

export function wrapLiveSyncPatch(roomId, clientId, mutation) {
  return { type: 'livesync:patch', roomId, clientId, mutation };
}

function newTxId() {
  return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function createDeltaMutationBuilder(entityType, entityId) {
  const pathValues = {};
  const pathMeta = {};
  return {
    setPath(path, value, clientTimestamp) {
      const key = String(path || '').trim();
      if (!key) return this;
      pathValues[key] = value;
      pathMeta[key] = { clientTimestamp: Number(clientTimestamp || Date.now()) };
      return this;
    },
    clearPath(path, clientTimestamp) {
      return this.setPath(path, null, clientTimestamp);
    },
    build(extra = {}) {
      return {
        entityType,
        entityId,
        expectedVersion: Number(extra.expectedVersion || 0),
        pathValues: { ...pathValues },
        pathMeta: { ...pathMeta },
        txId: extra.txId || newTxId(),
        ...extra,
      };
    },
  };
}

export function wrapLiveSyncDelta(roomId, clientId, delta) {
  return { type: 'livesync:delta', roomId, clientId, delta };
}

/**
 * @param {object} mutation from createMutationBuilder().build()
 * @param {{ sections?: string[], safety?: object[] }} audit
 * @param {string} roomId
 * @param {string} [clientId]
 */
export function attachHistoriaClinicaAudit(mutation, audit, roomId, clientId) {
  return {
    ...mutation,
    roomId,
    patientId: mutation.entityId,
    clientId: clientId || '',
    audit: audit || { sections: mutation.changedKeys || [], safety: [] },
  };
}
