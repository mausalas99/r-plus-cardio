/**
 * Plan de consolidación manual/automática del historial de laboratorio.
 */
import {
  clusterByTimeWindow,
  clusterLabConsolidationGroup,
  clusterLabworkByTimeWindow,
  labConsolidationFamily,
  labTimestampMsFromFechaHora,
  LAB_CONSOLIDATION_UNBOUNDED_WINDOW_MS,
  LAB_CONSOLIDATION_WINDOW_MS,
  resolveLabConsolidationWindowMs,
} from './lab-consolidation-cluster.mjs';

export function labDayTipoGroupKey(dayKey, tipo) {
  return String(dayKey || '') + '\x01' + labConsolidationFamily(tipo);
}

export function splitLabDayTipoGroupKey(gk) {
  var parts = String(gk || '').split('\x01');
  var family = parts[1] || 'labwork';
  return {
    dayKey: parts[0] || '',
    tipo: family === 'labwork' ? 'labs' : family,
    family: family,
  };
}

function defaultIsGasoOnly(getTipo) {
  return function (set) {
    return getTipo(set) === 'gaso';
  };
}

function groupSetsByDayFamily(sets, getDayKey, getTipo) {
  var groups = Object.create(null);
  (sets || []).forEach(function (set) {
    var tipo = getTipo(set);
    if (tipo === 'mixed') return;
    var dk = getDayKey(set);
    if (!dk || dk === 'unknown' || dk === 'Anterior') return;
    var gk = labDayTipoGroupKey(dk, tipo);
    if (!groups[gk]) groups[gk] = [];
    groups[gk].push(set);
  });
  return groups;
}

function shouldOfferLabworkOutlier(arr, getMs, isGasoOnly, windowMs) {
  if (!arr || arr.length < 2) return false;
  if (arr.every(isGasoOnly)) return false;
  var clusters = clusterLabworkByTimeWindow(arr, getMs, isGasoOnly, windowMs);
  if (clusters.length < 2) return false;
  for (var i = 0; i < clusters.length; i++) {
    var cluster = clusters[i];
    if (cluster.length !== 1 || !isGasoOnly(cluster[0])) continue;
    for (var j = 0; j < clusters.length; j++) {
      if (i === j) continue;
      if (clusters[j].some(isGasoOnly)) return false;
    }
  }
  return true;
}

function shouldOfferConsolidationOutlier(arr, split, getMs, getTipo, isGasoOnly, windowMs) {
  if (split.family === 'labwork') {
    return shouldOfferLabworkOutlier(arr, getMs, isGasoOnly, windowMs);
  }
  var clusters = clusterByTimeWindow(arr, getMs, resolveLabConsolidationWindowMs(split.tipo, windowMs));
  return clusters.length >= 2;
}

/**
 * Grupos mismo día+familia con ≥2 clusters horarios (>2 h entre bloques).
 */
export function findOutlierLabConsolidationGroups(
  sets,
  getDayKey,
  getTipo,
  getMs,
  isGasoOnly,
  windowMs
) {
  var gasoFn = typeof isGasoOnly === 'function' ? isGasoOnly : defaultIsGasoOnly(getTipo);
  var groups = groupSetsByDayFamily(sets, getDayKey, getTipo);
  var outliers = [];
  Object.keys(groups).forEach(function (gk) {
    var arr = groups[gk];
    if (arr.length < 2) return;
    var split = splitLabDayTipoGroupKey(gk);
    if (!shouldOfferConsolidationOutlier(arr, split, getMs, getTipo, gasoFn, windowMs)) return;
    var clusters = clusterLabConsolidationGroup(arr, getMs, getTipo, gasoFn, windowMs);
    outliers.push({
      groupKey: gk,
      dayKey: split.dayKey,
      tipo: split.tipo,
      clusters: clusters,
      setCount: arr.length,
    });
  });
  return outliers;
}

/**
 * @param {Set<string>|string[]|null} outlierGroupKeys — fusionar día completo ignorando ventana
 * @returns {Array<{ groupKey: string, kind: 'auto'|'outlier', sets: unknown[] }>}
 */
export function buildLabConsolidationMergeJobs(
  sets,
  getDayKey,
  getTipo,
  getMs,
  outlierGroupKeys,
  isGasoOnly,
  windowMs
) {
  var gasoFn = typeof isGasoOnly === 'function' ? isGasoOnly : defaultIsGasoOnly(getTipo);
  var outlierSet =
    outlierGroupKeys instanceof Set
      ? outlierGroupKeys
      : outlierGroupKeys
        ? new Set(outlierGroupKeys)
        : new Set();
  var groups = groupSetsByDayFamily(sets, getDayKey, getTipo);
  var jobs = [];
  Object.keys(groups).forEach(function (gk) {
    var arr = groups[gk];
    if (arr.length < 2) return;
    var split = splitLabDayTipoGroupKey(gk);
    if (outlierSet.has(gk)) {
      if (split.family === 'labwork') {
        clusterLabworkByTimeWindow(arr, getMs, gasoFn, LAB_CONSOLIDATION_UNBOUNDED_WINDOW_MS).forEach(function (cluster) {
          if (cluster.length >= 2) {
            jobs.push({ groupKey: gk, kind: 'outlier', sets: cluster.slice() });
          }
        });
      } else {
        jobs.push({ groupKey: gk, kind: 'outlier', sets: arr.slice() });
      }
      return;
    }
    clusterLabConsolidationGroup(arr, getMs, getTipo, gasoFn, windowMs).forEach(function (cluster) {
      if (cluster.length >= 2) {
        jobs.push({ groupKey: gk, kind: 'auto', sets: cluster.slice() });
      }
    });
  });
  return jobs;
}

export function countAutoLabConsolidationMerges(jobs) {
  return (jobs || []).reduce(function (acc, job) {
    if (job.kind !== 'auto') return acc;
    return acc + job.sets.length - 1;
  }, 0);
}

export function countOutlierLabConsolidationMerges(jobs) {
  return (jobs || []).reduce(function (acc, job) {
    if (job.kind !== 'outlier') return acc;
    return acc + job.sets.length - 1;
  }, 0);
}

export { LAB_CONSOLIDATION_WINDOW_MS, labTimestampMsFromFechaHora };
