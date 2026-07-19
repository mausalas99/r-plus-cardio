import { normalizeTodoPriority } from './todos-priority.mjs';

var CENSO_PENDIENTES_TIERS = ['alta', 'media', 'baja'];

/**
 * Pendientes abiertos para columna censo: hasta 3 del primer nivel con items
 * (alta → media → baja). Texto completo, sin truncar.
 * @param {Array<{ text?: string, completed?: boolean, priority?: string, createdAt?: string }>} todos
 * @param {number} [maxCount]
 * @returns {string[]}
 */
export function formatPendientesForCenso(todos, maxCount) {
  maxCount = maxCount == null ? 3 : maxCount;
  var open = (todos || []).filter(function (t) {
    return t && !t.completed && String(t.text || '').trim();
  });
  if (!open.length) return [];

  for (var i = 0; i < CENSO_PENDIENTES_TIERS.length; i++) {
    var tier = CENSO_PENDIENTES_TIERS[i];
    var matched = open.filter(function (t) {
      return normalizeTodoPriority(t.priority) === tier;
    });
    if (!matched.length) continue;
    matched.sort(comparePendientesForCenso);
    return matched.slice(0, maxCount).map(function (t) {
      return String(t.text).trim();
    });
  }
  return [];
}

function comparePendientesForCenso(a, b) {
  if (a.createdAt && b.createdAt) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  }
  return 0;
}
