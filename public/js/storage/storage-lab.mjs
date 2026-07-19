export function isMeaningfulLabHistorySet(set) {
  if (!set || typeof set !== 'object') return false;
  if (set.id === 'migrated-anterior' || set.id === 'migrated-recent') return true;
  if (set.sourceText && String(set.sourceText).trim()) return true;
  if (Array.isArray(set.resLabs) && set.resLabs.length) return true;
  return false;
}

function ensureLabSetId(set, index, used) {
  var raw = set.id != null ? String(set.id).trim() : '';
  if (raw && used.indexOf(raw) === -1) {
    used.push(raw);
    set.id = raw;
    return;
  }
  var base = raw || 'set-' + String(index);
  var id = base;
  var n = 2;
  while (used.indexOf(id) !== -1) {
    id = base + '-' + n;
    n += 1;
  }
  set.id = id;
  used.push(id);
}

/** Asegura arreglo de conjuntos válidos, con id único y sin basura vacía. */
export function normalizeLabHistoryPatientSets(value) {
  var list = [];
  if (value == null) return list;
  if (Array.isArray(value)) list = value.slice();
  else if (typeof value === 'object') {
    if (Array.isArray(value.resLabs) || value.id != null || value.sourceText != null) {
      list = [value];
    } else {
      var keys = Object.keys(value);
      if (keys.length) {
        if (keys.every(function (k) { return /^\d+$/.test(k); })) {
          list = keys
            .sort(function (a, b) { return Number(a) - Number(b); })
            .map(function (k) { return value[k]; });
        } else {
          list = keys.map(function (k) {
            var item = value[k];
            if (!item || typeof item !== 'object') return null;
            if (item.id == null || String(item.id).trim() === '') item.id = k;
            return item;
          });
        }
      }
    }
  }
  var used = [];
  var out = [];
  list.forEach(function (set, index) {
    if (!isMeaningfulLabHistorySet(set)) return;
    var copy = set;
    if (typeof set === 'object') {
      try {
        copy = Object.assign({}, set);
      } catch {
        copy = set;
      }
    }
    ensureLabSetId(copy, index, used);
    out.push(copy);
  });
  return out;
}

function coerceBool(v, defaultVal) {
  if (v === true || v === false) return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return defaultVal;
}

/** @param {unknown} v @returns {string | null} */
export function normalizeOptionalTodoString(v) {
  if (typeof v !== 'string') return null;
  var s = v.trim();
  return s === '' ? null : s;
}

/** Normaliza evento persistente desde JSON crudo (omite inválidos / demo paciente). */
export function normalizeScheduledProcedureStored(raw) {
  const core = parseScheduledProcedureCore(raw);
  if (!core) return null;
  const timestamps = resolveScheduledProcedureTimestamps(raw, core.startMs);
  return {
    ...core,
    ...timestamps,
    start: new Date(core.startMs).toISOString(),
  };
}

function parseScheduledProcedureCore(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id != null ? raw.id : '').trim();
  const patientId = String(raw.patientId != null ? raw.patientId : '').trim();
  const procedure = String(raw.procedure != null ? raw.procedure : '').trim();
  const location = String(raw.location != null ? raw.location : '').trim();
  if (!id || !patientId || !procedure || !location) return null;
  if (patientId.indexOf('demo-') === 0) return null;
  const start = String(raw.start != null ? raw.start : '').trim();
  if (!start) return null;
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return null;
  return {
    id,
    patientId,
    procedure,
    location,
    materialApproved: coerceBool(raw.materialApproved, false),
    anesthesiaScheduled: coerceBool(raw.anesthesiaScheduled, false),
    startMs,
  };
}

function resolveScheduledProcedureTimestamps(raw, startMs) {
  let createdAt = String(raw.createdAt != null ? raw.createdAt : '').trim();
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
    createdAt = new Date(startMs).toISOString();
  }
  let updatedAt = String(raw.updatedAt != null ? raw.updatedAt : '').trim();
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) updatedAt = createdAt;
  return { createdAt, updatedAt };
}