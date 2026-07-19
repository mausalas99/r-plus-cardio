'use strict';

const STALE_BASE_SEQ_REQUIRES_SNAPSHOT = 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT';
const INVALID_COMMAND = 'INVALID_COMMAND';
const DEFAULT_STALE_BASE_SEQ_WINDOW = 150;
const CLOCK_DRIFT_WARN_MS = 10 * 60 * 1000;

const REQUIRED_FIELDS = [
  'commandId',
  'domain',
  'op',
  'roomId',
  'clientId',
  'clientCreatedAt',
  'baseSeq',
  'payload',
];

function trim(value) {
  return String(value || '').trim();
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function missingRequired(command) {
  return REQUIRED_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(command || {}, field)) return true;
    if (field === 'payload') return !isObject(command[field]);
    if (field === 'clientCreatedAt' || field === 'baseSeq') return !Number.isFinite(Number(command[field]));
    return trim(command[field]) === '';
  });
}

function compareCommandOrder(a, b) {
  const aTs = Number(a && a.clientCreatedAt ? a.clientCreatedAt : 0);
  const bTs = Number(b && b.clientCreatedAt ? b.clientCreatedAt : 0);
  if (aTs !== bTs) return aTs < bTs ? -1 : 1;
  const aClient = trim(a && a.clientId);
  const bClient = trim(b && b.clientId);
  if (aClient !== bClient) return aClient < bClient ? -1 : 1;
  const aCommand = trim(a && a.commandId);
  const bCommand = trim(b && b.commandId);
  if (aCommand === bCommand) return 0;
  return aCommand < bCommand ? -1 : 1;
}

function setPath(target, path, value) {
  const parts = trim(path).split('.').filter(Boolean);
  if (!parts.length) return target;
  let cur = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
  return target;
}

function applyEstadoActual(command, state) {
  if (command.op !== 'updateField') {
    return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'unsupported_estado_actual_op' };
  }
  const path = trim(command.payload.path);
  if (!path) return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'path_required' };
  const data = clone(state.data || {});
  const meta = clone(state.meta || {});
  const prev = meta[path];
  if (prev && compareCommandOrder(command, prev) < 0) {
    return { ok: true, status: 'duplicate_ignored', data, meta, changedPaths: [] };
  }
  setPath(data, path, command.payload.value);
  meta[path] = {
    clientCreatedAt: Number(command.clientCreatedAt),
    clientId: trim(command.clientId),
    commandId: trim(command.commandId),
  };
  return { ok: true, status: 'accepted', data, meta, changedPaths: [path] };
}

function eventKey(entry) {
  return trim(entry.eventualidadId || entry.id) || `${trim(entry.at)}|${trim(entry.text)}`;
}

function applyEventualidades(command, state) {
  if (command.op !== 'add') {
    return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'unsupported_eventualidades_op' };
  }
  const payload = command.payload || {};
  const key = eventKey(payload);
  if (!key) return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'eventualidad_id_required' };
  const data = clone(state.data || {});
  const entries = Array.isArray(data.entries) ? data.entries.slice() : [];
  const seen = new Set(entries.map(eventKey));
  if (seen.has(key)) return { ok: true, status: 'duplicate_ignored', data: { ...data, entries }, meta: clone(state.meta || {}) };
  entries.push({
    id: trim(payload.eventualidadId || payload.id) || trim(command.commandId),
    at: trim(payload.at),
    text: trim(payload.text),
    clientCreatedAt: Number(command.clientCreatedAt),
    commandId: trim(command.commandId),
  });
  return { ok: true, status: 'accepted', data: { ...data, entries }, meta: clone(state.meta || {}), changedPaths: ['entries'] };
}

function applyPendientes(command, state) {
  if (!['add', 'update', 'complete'].includes(command.op)) {
    return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'unsupported_pendientes_op' };
  }
  const payload = command.payload || {};
  const itemId = trim(payload.itemId || payload.id);
  if (!itemId) return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'item_id_required' };
  const data = clone(state.data || {});
  const meta = clone(state.meta || {});
  const items = Array.isArray(data.items) ? data.items.slice() : [];
  const idx = items.findIndex((item) => trim(item && item.id) === itemId);
  const prevMeta = meta[itemId];
  if (prevMeta && compareCommandOrder(command, prevMeta) < 0) {
    return { ok: true, status: 'duplicate_ignored', data: { ...data, items }, meta, changedPaths: [] };
  }
  const prev = idx >= 0 ? items[idx] : { id: itemId, completed: false };
  const next = {
    ...prev,
    ...payload,
    id: itemId,
    updatedAt: payload.updatedAt || new Date(Number(command.clientCreatedAt)).toISOString(),
  };
  if (command.op === 'complete') next.completed = payload.completed !== false;
  if (idx >= 0) items[idx] = next;
  else items.push(next);
  meta[itemId] = {
    clientCreatedAt: Number(command.clientCreatedAt),
    clientId: trim(command.clientId),
    commandId: trim(command.commandId),
  };
  return { ok: true, status: 'accepted', data: { ...data, items }, meta, changedPaths: [itemId] };
}

const DOMAIN_APPLY = {
  estadoActual: applyEstadoActual,
  eventualidades: applyEventualidades,
  pendientes: applyPendientes,
};

function createCommandRegistry(options = {}) {
  const staleBaseSeqWindow = Number.isFinite(Number(options.staleBaseSeqWindow))
    ? Number(options.staleBaseSeqWindow)
    : DEFAULT_STALE_BASE_SEQ_WINDOW;
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : () => Date.now();

  function validateCommand(command, context = {}) {
    const missing = missingRequired(command);
    if (missing.length) {
      return { ok: false, code: INVALID_COMMAND, status: 'invalid_command', missing };
    }
    if (!DOMAIN_APPLY[trim(command.domain)]) {
      return { ok: false, code: INVALID_COMMAND, status: 'invalid_command', error: 'unsupported_domain' };
    }

    const latestDeltaSeq = Number(context.latestDeltaSeq || 0);
    const baseSeq = Number(command.baseSeq || 0);
    if (latestDeltaSeq - baseSeq > staleBaseSeqWindow) {
      return {
        ok: false,
        code: STALE_BASE_SEQ_REQUIRES_SNAPSHOT,
        status: 'stale_base_seq_requires_snapshot',
        latestDeltaSeq,
        fallback: 'sync_bundle',
      };
    }

    const driftMs = Math.abs(Number(command.clientCreatedAt || 0) - nowMs());
    return { ok: true, clockDriftWarning: driftMs > CLOCK_DRIFT_WARN_MS };
  }

  function applyCommand(command, state = {}) {
    const fn = DOMAIN_APPLY[trim(command && command.domain)];
    if (!fn) return { ok: false, status: 'invalid_command', code: INVALID_COMMAND, error: 'unsupported_domain' };
    return fn(command, { data: state.data || {}, meta: state.meta || {} });
  }

  return { validateCommand, applyCommand };
}

module.exports = {
  createCommandRegistry,
  STALE_BASE_SEQ_REQUIRES_SNAPSHOT,
  INVALID_COMMAND,
  CLOCK_DRIFT_WARN_MS,
  compareCommandOrder,
};
