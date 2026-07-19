import { ensureCardio } from '../../../../lib/cardio/patient-cardio.mjs';
import {
  appendDoseSegment,
  endDoseSegment,
  addCatalogTipo,
} from '../../../../lib/cardio/med-segments.mjs';
import { patients, saveState } from '../../app-state.mjs';
import { rt } from '../pase-board-runtime.mjs';
import { localYmd } from './descongestion-panel.mjs';
import {
  normalizeFantasticosRows,
  updateFantasticoField,
  serializeSegmentDraft,
} from './manejo-panel-rows.mjs';
import { buildManejoPanelHtml } from './manejo-panel-html.mjs';

export {
  normalizeFantasticosRows,
  updateFantasticoField,
  buildSegmentRows,
  serializeSegmentDraft,
  catalogTipoOptions,
} from './manejo-panel-rows.mjs';
export {
  buildFantasticosTableHtml,
  buildSegmentTableHtml,
  buildManejoPanelHtml,
} from './manejo-panel-html.mjs';

/**
 * @param {HTMLElement | null} mount
 */
export function renderManejoPanel(mount) {
  if (!mount) return;
  var patientId = rt.getActiveId && rt.getActiveId();
  var patient = patients.find(function (p) {
    return p && String(p.id) === String(patientId);
  });
  if (!patient) {
    mount.innerHTML =
      '<div class="manejo-panel" data-manejo-panel="1">' +
      '<p class="ea-muted">Selecciona un paciente para editar el manejo IC.</p>' +
      '</div>';
    return;
  }
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  mount.innerHTML = buildManejoPanelHtml(cardio);
  ensureManejoWired(mount);
}

/** @returns {Record<string, unknown> | null} */
function resolveActivePatient() {
  var patientId = rt.getActiveId && rt.getActiveId();
  var patient = patients.find(function (p) {
    return p && String(p.id) === String(patientId);
  });
  return patient || null;
}

/**
 * Wire once on the mount host (delegation survives re-renders).
 * @param {HTMLElement} mount
 */
function ensureManejoWired(mount) {
  if (mount.getAttribute('data-manejo-wired') === '1') return;
  mount.setAttribute('data-manejo-wired', '1');

  mount.addEventListener('change', function (ev) {
    var patient = resolveActivePatient();
    if (!patient) return;
    var t = /** @type {HTMLElement} */ (ev.target);
    if (!t || !t.getAttribute) return;

    var fantField = t.getAttribute('data-manejo-fant');
    if (fantField) {
      var idx = Number(t.getAttribute('data-manejo-fant-idx'));
      persistFantastico(patient, idx, fantField, /** @type {HTMLInputElement} */ (t).value);
      return;
    }

    var segField = t.getAttribute('data-manejo-seg-field');
    var segId = t.getAttribute('data-manejo-seg-id');
    if (segField && segId) {
      persistSegmentField(patient, segId, segField, /** @type {HTMLInputElement} */ (t).value);
    }
  });

  mount.addEventListener('click', function (ev) {
    var patient = resolveActivePatient();
    if (!patient) return;
    var el = /** @type {HTMLElement} */ (ev.target);
    if (!el || !el.closest) return;
    var btn = el.closest(
      '[data-manejo-seg-add], [data-manejo-seg-end], [data-manejo-seg-repo], [data-manejo-seg-draft-repo]'
    );
    if (!btn) return;

    var addKind = btn.getAttribute('data-manejo-seg-add');
    if (addKind) {
      addSegmentFromDraft(mount, patient, addKind);
      return;
    }

    var endId = btn.getAttribute('data-manejo-seg-end');
    if (endId) {
      endSegment(mount, patient, endId);
      return;
    }

    var repoId = btn.getAttribute('data-manejo-seg-repo');
    if (repoId) {
      saveTipoFromSegment(mount, patient, repoId);
      return;
    }

    var draftRepoKind = btn.getAttribute('data-manejo-seg-draft-repo');
    if (draftRepoKind) {
      saveTipoFromDraft(mount, patient, draftRepoKind);
    }
  });
}

/**
 * @param {Record<string, unknown>} patient
 * @param {number} idx
 * @param {string} field
 * @param {unknown} value
 */
function persistFantastico(patient, idx, field, value) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var rows = normalizeFantasticosRows(cardio.fantasticos);
  if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) return;
  var className = rows[idx].className;
  if (field !== 'drug' && field !== 'inicio' && field !== 'dosis' && field !== 'tolerancia') return;
  cardio.fantasticos = updateFantasticoField(rows, className, field, value);
  saveState();
}

/**
 * @param {Record<string, unknown>} patient
 * @param {string} segId
 * @returns {'medSegments' | 'diureticSegments' | null}
 */
function findSegmentKey(patient, segId) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  if (
    (cardio.medSegments || []).some(function (s) {
      return s && String(s.id) === String(segId);
    })
  ) {
    return 'medSegments';
  }
  if (
    (cardio.diureticSegments || []).some(function (s) {
      return s && String(s.id) === String(segId);
    })
  ) {
    return 'diureticSegments';
  }
  return null;
}

/**
 * @param {Record<string, unknown>} patient
 * @param {string} segId
 * @param {string} field
 * @param {unknown} value
 */
function persistSegmentField(patient, segId, field, value) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var key = findSegmentKey(patient, segId);
  if (!key) return;
  var list = Array.isArray(cardio[key]) ? cardio[key].slice() : [];
  var idx = list.findIndex(function (s) {
    return s && String(s.id) === String(segId);
  });
  if (idx < 0) return;
  var row = Object.assign({}, list[idx]);
  if (row.endedAt) return;
  if (field === 'mgTotal') {
    var n = Number(value);
    row.mgTotal = String(value).trim() === '' || !Number.isFinite(n) ? null : n;
  } else if (field === 'tipo' || field === 'inicio' || field === 'dosis' || field === 'indicacion') {
    row[field] = String(value == null ? '' : value).trim();
  } else {
    return;
  }
  list[idx] = row;
  cardio[key] = list;
  saveState();
}

/**
 * @param {HTMLElement} mount
 * @param {string} kind
 */
function readDraft(mount, kind) {
  var row = mount.querySelector('[data-manejo-seg-draft-row="' + kind + '"]');
  if (!row) return serializeSegmentDraft({});
  /** @type {Record<string, string>} */
  var draft = {};
  row.querySelectorAll('[data-manejo-seg-draft]').forEach(function (el) {
    var f = el.getAttribute('data-manejo-seg-draft');
    if (!f) return;
    draft[f] = /** @type {HTMLInputElement} */ (el).value;
  });
  return serializeSegmentDraft(draft);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 * @param {string} kind
 */
function addSegmentFromDraft(mount, patient, kind) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var draft = readDraft(mount, kind);
  if (!draft.tipo) return;
  var key = kind === 'diuretic' ? 'diureticSegments' : 'medSegments';
  cardio[key] = appendDoseSegment(cardio[key], draft);
  saveState();
  renderManejoPanel(mount);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 * @param {string} segId
 */
function endSegment(mount, patient, segId) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var key = findSegmentKey(patient, segId);
  if (!key) return;
  cardio[key] = endDoseSegment(cardio[key], segId, localYmd());
  saveState();
  renderManejoPanel(mount);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 * @param {string} segId
 */
function saveTipoFromSegment(mount, patient, segId) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var key = findSegmentKey(patient, segId);
  if (!key) return;
  var seg = (cardio[key] || []).find(function (s) {
    return s && String(s.id) === String(segId);
  });
  if (!seg || !String(seg.tipo || '').trim()) return;
  cardio.medCatalog = addCatalogTipo(cardio.medCatalog, {
    tipo: seg.tipo,
    defaultIndicacion: seg.indicacion || '',
  });
  saveState();
  renderManejoPanel(mount);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 * @param {string} kind
 */
function saveTipoFromDraft(mount, patient, kind) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var draft = readDraft(mount, kind);
  if (!draft.tipo) return;
  cardio.medCatalog = addCatalogTipo(cardio.medCatalog, {
    tipo: draft.tipo,
    defaultIndicacion: draft.indicacion || '',
  });
  saveState();
  renderManejoPanel(mount);
}
