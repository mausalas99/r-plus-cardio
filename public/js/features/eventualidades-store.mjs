import { toClinicalHistoryText } from '../../../lib/historia-clinica/clinical-text.mjs';

export function normalizeEventualidadText(text) {
  return toClinicalHistoryText(text).trim();
}

let rt = {
  getActiveId() {
    return null;
  },
  showToast(_msg, _type) {},
};

export function registerEventualidadesRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export { rt };

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {Date | string | number} [when] @returns {string} YYYY-MM-DD */
export function toEventualidadDateValue(when) {
  const d = when == null ? new Date() : when instanceof Date ? when : new Date(when);
  if (!Number.isFinite(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** @param {string} dateIso YYYY-MM-DD — almacena mediodía local para agrupar por día */
export function eventualidadDateToIso(dateIso) {
  const raw = String(dateIso || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return eventualidadDateToIso(toEventualidadDateValue(new Date()));
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(y, mo - 1, day, 12, 0, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
}

export function appendEventualidad(store, text, clientId, atIso) {
  const t = normalizeEventualidadText(text);
  if (!t) return store || { entries: [] };
  const at =
    atIso && String(atIso).trim()
      ? String(atIso).trim()
      : eventualidadDateToIso(toEventualidadDateValue(new Date()));
  const entry = {
    id: 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: at,
    text: t,
    clientId: clientId || undefined,
  };
  const entries = Array.isArray(store && store.entries) ? store.entries.slice() : [];
  entries.push(entry);
  return { entries };
}

export function updateEventualidad(store, entryId, patch) {
  const id = String(entryId || '').trim();
  if (!id) return store || { entries: [] };
  const entries = Array.isArray(store && store.entries) ? store.entries.slice() : [];
  const idx = entries.findIndex(function (e) {
    return e && String(e.id) === id;
  });
  if (idx === -1) return { entries };
  const cur = entries[idx];
  const text =
    patch && patch.text != null
      ? normalizeEventualidadText(patch.text)
      : normalizeEventualidadText(cur.text);
  if (!text) return { entries };
  const at =
    patch && patch.at != null && String(patch.at).trim()
      ? String(patch.at).trim()
      : cur.at;
  entries[idx] = Object.assign({}, cur, { text: text, at: at });
  return { entries };
}

export function findEventualidadEntry(store, entryId) {
  const id = String(entryId || '').trim();
  if (!id) return null;
  return (
    (Array.isArray(store && store.entries) ? store.entries : []).find(function (e) {
      return e && String(e.id) === id;
    }) || null
  );
}

export function removeEventualidad(store, entryId) {
  const id = String(entryId || '').trim();
  if (!id) return store || { entries: [] };
  const entries = (Array.isArray(store && store.entries) ? store.entries : []).filter(function (e) {
    return e && String(e.id) !== id;
  });
  return { entries };
}

export function sortEntriesDesc(entries) {
  return (entries || [])
    .slice()
    .sort(function (a, b) {
      return String(b.at || '').localeCompare(String(a.at || ''));
    });
}

/** Local calendar day key (YYYY-MM-DD) for grouping. */
export function dayKeyFromIso(iso) {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  } catch {
    return 'unknown';
  }
}

export function formatDayLabel(dayKey, now) {
  if (dayKey === 'unknown') return 'Sin fecha';
  const parts = String(dayKey).split('-').map(Number);
  if (parts.length !== 3 || parts.some(function (n) {
    return !Number.isFinite(n);
  })) {
    return String(dayKey);
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (!Number.isFinite(date.getTime())) return String(dayKey);
  const ref = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const todayKey = dayKeyFromIso(ref.toISOString());
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  const yesterdayKey = dayKeyFromIso(yesterday.toISOString());
  if (dayKey === todayKey) return 'Hoy';
  if (dayKey === yesterdayKey) return 'Ayer';
  return date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha calendario cuando la etiqueta principal es relativa (Hoy / Ayer). */
export function formatDaySubLabel(dayKey, now) {
  if (dayKey === 'unknown') return '';
  const parts = String(dayKey).split('-').map(Number);
  if (parts.length !== 3 || parts.some(function (n) {
    return !Number.isFinite(n);
  })) {
    return '';
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (!Number.isFinite(date.getTime())) return '';
  const ref = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const todayKey = dayKeyFromIso(ref.toISOString());
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  const yesterdayKey = dayKeyFromIso(yesterday.toISOString());
  if (dayKey !== todayKey && dayKey !== yesterdayKey) return '';
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

/** Newest day first; within each day, newest entry first. */
export function groupEntriesByDay(entries, now) {
  const map = new Map();
  (entries || []).forEach(function (e) {
    const key = dayKeyFromIso(e && e.at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return [...map.entries()]
    .sort(function (a, b) {
      return String(b[0]).localeCompare(String(a[0]));
    })
    .map(function (pair) {
      const day = pair[0];
      const dayEntries = pair[1]
        .slice()
        .sort(function (a, b) {
          const byAt = String(b.at || '').localeCompare(String(a.at || ''));
          if (byAt !== 0) return byAt;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
      return {
        day: day,
        label: formatDayLabel(day, now),
        isToday: day === dayKeyFromIso((now || new Date()).toISOString()),
        entries: dayEntries,
      };
    });
}

