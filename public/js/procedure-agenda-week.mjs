/** Utilidades vista semanal de agenda de procedimientos (spec 2026-05-14). */

export const AGENDA_DISPLAY_FIRST_HOUR = 6;
/** Hora exclusiva fin de rejilla visible (muestra hasta &lt; 22:00). */
export const AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE = 22;
export const VISUAL_DURATION_MS = 2 * 60 * 60 * 1000;

export function mondayStartLocal(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay();
  const delta = wd === 0 ? -6 : 1 - wd;
  x.setDate(x.getDate() + delta);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDaysLocal(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export function weekBoundsFromMonday(monday) {
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return { start, endExclusive: end };
}

/**
 * Intersección del bloque visual 2 h con una columna-día local (00:00–24:00) y la franja visible 6–22 h.
 * @returns {null | { topMs:number, botMs:number, visStartMs:number }}
 */
export function clipEventToDayColumn(evtStartMs, columnMidnightMs) {
  const col = new Date(columnMidnightMs);
  const dayEnd = new Date(col.getFullYear(), col.getMonth(), col.getDate() + 1, 0, 0, 0, 0).getTime();
  const evtEndMs = evtStartMs + VISUAL_DURATION_MS;
  if (evtEndMs <= col.getTime() || evtStartMs >= dayEnd) return null;

  const visStartMs = new Date(
    col.getFullYear(),
    col.getMonth(),
    col.getDate(),
    AGENDA_DISPLAY_FIRST_HOUR,
    0,
    0,
    0
  ).getTime();
  const visEndMs = new Date(
    col.getFullYear(),
    col.getMonth(),
    col.getDate(),
    AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE,
    0,
    0,
    0
  ).getTime();

  const topMs = Math.max(evtStartMs, col.getTime(), visStartMs);
  const botMs = Math.min(evtEndMs, dayEnd, visEndMs);
  if (botMs <= topMs) return null;
  return { topMs, botMs, visStartMs };
}

/**
 * @param {Array<{ topMs:number, botMs:number, id:string }>} items — mismo día, ya clipados
 * @returns {Map<string, number>} id → lane (0-based)
 */
export function assignLanesByInterval(items) {
  const sorted = items.slice().sort(function (a, b) {
    if (a.topMs !== b.topMs) return a.topMs - b.topMs;
    return String(a.id).localeCompare(String(b.id));
  });
  const laneEnds = [];
  const laneById = new Map();
  sorted.forEach(function (it) {
    var lane = -1;
    for (var L = 0; L < laneEnds.length; L += 1) {
      if (laneEnds[L] <= it.topMs) {
        lane = L;
        break;
      }
    }
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(it.botMs);
    } else {
      laneEnds[lane] = it.botMs;
    }
    laneById.set(it.id, lane);
  });
  return laneById;
}

export function hoursVisibleCount() {
  return AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE - AGENDA_DISPLAY_FIRST_HOUR;
}
