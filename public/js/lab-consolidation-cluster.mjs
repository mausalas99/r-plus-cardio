/**
 * Agrupa reportes/conjuntos de laboratorio para consolidación por ventana horaria.
 */
import {
  normalizeFechaLabHistory,
  normalizeHoraLabHistory,
  parseFechaLabToMs,
} from './tend-core.mjs';

/** Ventana máxima entre tomas consecutivas para fusionar (2 h). */
export const LAB_CONSOLIDATION_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Sin tope de ventana (outlier labwork: une bloques >2 h respetando regla gaso+gaso). */
export const LAB_CONSOLIDATION_UNBOUNDED_WINDOW_MS = Number.MAX_SAFE_INTEGER;

/**
 * Familia de consolidación: labs y gasometrías iniciales comparten bucket;
 * cultivos y mixtos van aparte.
 * @param {string} [tipo]
 */
export function labConsolidationFamily(tipo) {
  if (tipo === 'mixed') return 'mixed';
  if (tipo === 'cultivo') return 'cultivo';
  return 'labwork';
}

/**
 * @param {string} [tipo]
 * @param {number} [windowMs]
 */
export function resolveLabConsolidationWindowMs(tipo, windowMs) {
  void tipo;
  return typeof windowMs === 'number' && isFinite(windowMs) ? windowMs : LAB_CONSOLIDATION_WINDOW_MS;
}

export function labTimestampMsFromFechaHora(fecha, hora) {
  var fechaNorm = normalizeFechaLabHistory(fecha) || String(fecha || '').trim();
  if (!fechaNorm || fechaNorm === 'Anterior') return null;
  var ms = parseFechaLabToMs(fechaNorm, normalizeHoraLabHistory(hora));
  return typeof ms === 'number' && isFinite(ms) ? ms : null;
}

/**
 * Cadena por hora: cada ítem se une al cluster anterior si la brecha ≤ windowMs.
 * Sin hora válida: un solo cluster si todos carecen de hora; si no, entradas sueltas.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number|null} getMs
 * @param {number} [windowMs]
 * @returns {T[][]}
 */
export function clusterByTimeWindow(items, getMs, windowMs) {
  var list = items || [];
  if (!list.length) return [];
  var w = typeof windowMs === 'number' && isFinite(windowMs) ? windowMs : LAB_CONSOLIDATION_WINDOW_MS;

  var timed = [];
  var untimed = [];
  list.forEach(function (item) {
    var ms = getMs(item);
    if (ms == null) untimed.push(item);
    else timed.push({ item: item, ms: ms });
  });

  timed.sort(function (a, b) {
    return a.ms - b.ms;
  });

  var clusters = [];
  var cur = [];
  var prevMs = null;
  timed.forEach(function (entry) {
    if (!cur.length || (prevMs != null && entry.ms - prevMs <= w)) {
      cur.push(entry.item);
    } else {
      clusters.push(cur);
      cur = [entry.item];
    }
    prevMs = entry.ms;
  });
  if (cur.length) clusters.push(cur);

  if (untimed.length === 1) {
    clusters.push(untimed);
  } else if (untimed.length > 1) {
    clusters.push(untimed.slice());
  }

  return clusters;
}

/**
 * Labs + gasometría inicial: ventana 2 h, pero nunca fusionar gasometría con gasometría.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number|null} getMs
 * @param {(item: T) => boolean} isGasoOnly
 * @param {number} [windowMs]
 * @returns {T[][]}
 */
export function clusterLabworkByTimeWindow(items, getMs, isGasoOnly, windowMs) {
  var list = items || [];
  if (!list.length) return [];
  var w = typeof windowMs === 'number' && isFinite(windowMs) ? windowMs : LAB_CONSOLIDATION_WINDOW_MS;
  var gasoFn =
    typeof isGasoOnly === 'function'
      ? isGasoOnly
      : function () {
          return false;
        };

  var timed = [];
  var untimed = [];
  list.forEach(function (item) {
    var ms = getMs(item);
    if (ms == null) untimed.push(item);
    else timed.push({ item: item, ms: ms });
  });

  timed.sort(function (a, b) {
    return a.ms - b.ms;
  });

  var clusters = [];
  var cur = [];
  var prevMs = null;
  timed.forEach(function (entry) {
    var isGaso = gasoFn(entry.item);
    var clusterHasGaso = cur.some(gasoFn);
    var withinWindow = !cur.length || (prevMs != null && entry.ms - prevMs <= w);
    var canJoin = withinWindow && !(isGaso && clusterHasGaso);

    if (canJoin) {
      cur.push(entry.item);
    } else {
      if (cur.length) clusters.push(cur);
      cur = [entry.item];
    }
    prevMs = entry.ms;
  });
  if (cur.length) clusters.push(cur);

  if (untimed.length === 1) {
    clusters.push(untimed);
  } else if (untimed.length > 1) {
    clusters.push(untimed.slice());
  }

  return clusters;
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number|null} getMs
 * @param {(item: T) => string} getTipo
 * @param {(item: T) => boolean} isGasoOnly
 * @param {number} [windowMs]
 */
export function clusterLabConsolidationGroup(items, getMs, getTipo, isGasoOnly, windowMs) {
  var tipo = getTipo((items || [])[0]);
  if (labConsolidationFamily(tipo) === 'labwork') {
    return clusterLabworkByTimeWindow(items, getMs, isGasoOnly, windowMs);
  }
  return clusterByTimeWindow(items, getMs, resolveLabConsolidationWindowMs(tipo, windowMs));
}

/**
 * Agrupa ítems por día+familia y luego por ventana de consolidación.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} getDayKey
 * @param {(item: T) => string} getTipo — 'mixed' queda fuera de consolidación
 * @param {(item: T) => number|null} getMs
 * @param {(item: T) => boolean} [isGasoOnly]
 * @param {number} [windowMs]
 * @returns {T[][]}
 */
export function clusterByDayTipoAndTimeWindow(items, getDayKey, getTipo, getMs, isGasoOnly, windowMs) {
  var groups = Object.create(null);
  var mixedSingles = [];
  var gasoFn =
    typeof isGasoOnly === 'function'
      ? isGasoOnly
      : function (item) {
          return getTipo(item) === 'gaso';
        };

  (items || []).forEach(function (item) {
    var tipo = getTipo(item);
    if (tipo === 'mixed') {
      mixedSingles.push([item]);
      return;
    }
    var dk = getDayKey(item);
    if (!dk || dk === 'unknown' || dk === 'Anterior') return;
    var gk = dk + '\x01' + labConsolidationFamily(tipo);
    if (!groups[gk]) groups[gk] = [];
    groups[gk].push(item);
  });

  var out = mixedSingles.slice();
  Object.keys(groups).forEach(function (gk) {
    var family = String(gk.split('\x01')[1] || 'labwork');
    var groupItems = groups[gk];
    var clusterFn =
      family === 'labwork'
        ? function () {
            return clusterLabworkByTimeWindow(groupItems, getMs, gasoFn, windowMs);
          }
        : function () {
            var tipo = getTipo(groupItems[0]);
            return clusterByTimeWindow(groupItems, getMs, resolveLabConsolidationWindowMs(tipo, windowMs));
          };
    clusterFn().forEach(function (cluster) {
      out.push(cluster);
    });
  });
  return out;
}
