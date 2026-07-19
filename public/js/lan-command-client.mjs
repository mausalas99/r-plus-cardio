function trim(value) {
  return String(value || '').trim();
}

function defaultRandomId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
}

export function buildLanCommand({
  domain,
  op,
  roomId,
  patientId,
  entityId,
  clientId,
  baseSeq = 0,
  payload,
  nowMs = () => Date.now(),
  randomId = defaultRandomId,
}) {
  const d = trim(domain);
  const pid = trim(patientId);
  return {
    commandId: `cmd_${randomId()}`,
    domain: d,
    op: trim(op),
    roomId: trim(roomId),
    patientId: pid,
    entityId: trim(entityId) || (pid ? `${pid}:${d}` : d),
    clientId: trim(clientId),
    clientCreatedAt: Number(nowMs()),
    baseSeq: Number(baseSeq || 0),
    payload: payload && typeof payload === 'object' ? payload : {},
  };
}

export function normalizeCommandPushResponse(result) {
  const body = result && result.body && typeof result.body === 'object' ? result.body : {};
  const status = String(body.status || '').trim();
  const staleBase = body.code === 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT' || status === 'stale_base_seq_requires_snapshot';
  const duplicate = status === 'duplicate_ignored';
  const accepted = !!body.ok && (status === 'accepted' || duplicate);
  return {
    ok: accepted,
    removeOutbox: accepted,
    staleBase,
    duplicate,
    status: staleBase ? 'stale_base_seq_requires_snapshot' : status,
  };
}

export function shouldRemoveCommandOutboxEntry(result) {
  return !!(result && result.ok && (result.status === 'accepted' || result.status === 'duplicate_ignored'));
}
