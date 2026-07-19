import { labHistory } from '../../app-state.mjs';
import { sortLabHistoryChronological, parseFechaLabToMs } from '../../tend-core.mjs';
import { lookbackHours, MOUNT_ID } from './runtime.mjs';
import { DEFAULT_LOOKBACK_H } from './catalogs.mjs';
import { getDirtyKeys, hcState } from './state.mjs';

export function labSetsInLookback(patientId) {
  var sets = labHistory[patientId];
  if (!Array.isArray(sets)) return [];
  var sorted = sortLabHistoryChronological(sets.slice());
  var hours = lookbackHours(DEFAULT_LOOKBACK_H);
  var cutoff = Date.now() - hours * 3600 * 1000;
  return sorted.filter(function (set) {
    var ms = parseFechaLabToMs(set.fecha, set.hora);
    if (typeof ms !== 'number' || !isFinite(ms)) return true;
    return ms >= cutoff;
  });
}

export function latestLabSet(patientId) {
  var sets = labHistory[patientId];
  if (!Array.isArray(sets) || !sets.length) return null;
  var sorted = sortLabHistoryChronological(sets.slice());
  return sorted[sorted.length - 1] || null;
}

export function buildLabAnchorFromSet(set) {
  if (!set) return null;
  return {
    setId: String(set.id || set.fecha || ''),
    fecha: String(set.fecha || ''),
    egfr: null,
    creatinineMgDl: null,
    source: 'lab',
    capturedAt: new Date().toISOString(),
  };
}

export function applyLabSet(set, markConfirmed) {
  if (!hcState.data) return;
  hcState.data.labAnchor = buildLabAnchorFromSet(set);
  hcState.data.labsAtAdmission = {
    setId: String(set.id || ''),
    fecha: String(set.fecha || ''),
    qsSummary: String(set.sourceText || '').slice(0, 4000),
    parsedBySection: set.parsedBySection || set.parsed || null,
  };
  if (!hcState.data.meta) hcState.data.meta = {};
  if (markConfirmed) hcState.data.meta.admissionConfirmedLabs = true;
  var dirty = getDirtyKeys();
  dirty.add('labsAtAdmission');
  dirty.add('labAnchor');
  dirty.add('meta');
}

export function openLabPickModal(patient, isResync, rerender) {
  var sets = labSetsInLookback(patient.id);
  if (!sets.length) {
    alert('No hay laboratorios en la ventana de ' + lookbackHours(DEFAULT_LOOKBACK_H) + ' h.');
    return;
  }
  var needConfirm = !hcState.data.meta || !hcState.data.meta.admissionConfirmedLabs;
  if (needConfirm && !isResync) {
    var ok = confirm(
      '¿Usar labs de las últimas ' +
        lookbackHours(DEFAULT_LOOKBACK_H) +
        ' horas? (' +
        sets.length +
        ' sets disponibles)'
    );
    if (!ok) return;
  }
  var label = sets
    .map(function (s, i) {
      return i + 1 + ': ' + (s.fecha || '') + ' ' + (s.hora || '');
    })
    .join('\n');
  var choice = prompt('Elige número de set:\n' + label, '1');
  var idx = parseInt(choice, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= sets.length) return;
  applyLabSet(sets[idx], !isResync && needConfirm);
  var root = document.getElementById(MOUNT_ID);
  if (root && typeof rerender === 'function') rerender(root);
}
