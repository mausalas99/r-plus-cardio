import { patients, saveState } from '../app-state.mjs';
import { touchClinicalSessionActivity } from '../clinical-access-runtime.mjs';
import { createMutationBuilder } from '../versioned-mutation.mjs';
import { refreshRpcDateFields } from '../rpc-date-picker.mjs';
import {
  isLanSessionConfiguredForRest,
  lanPushPatientVersioned,
  lanFetchHostPatientRow,
  touchPatientLanUpdatedAt,
} from './lan-sync.mjs';
import { toClinicalHistoryText } from '../../../lib/historia-clinica/clinical-text.mjs';
import {
  rt,
  normalizeEventualidadText,
  toEventualidadDateValue,
  eventualidadDateToIso,
  appendEventualidad,
  updateEventualidad,
  findEventualidadEntry,
  removeEventualidad,
  formatDaySubLabel,
  groupEntriesByDay,
} from './eventualidades-store.mjs';

import { esc } from '../dom-escape.mjs';
let _editingEntryId = null;
/** @type {Map<string, boolean>} */
const _dayOpenPrefs = new Map();

function daySectionIsOpen(dayGroup, editingId) {
  if (_dayOpenPrefs.has(dayGroup.day)) return _dayOpenPrefs.get(dayGroup.day);
  if (dayGroup.isToday) return true;
  if (
    editingId &&
    dayGroup.entries.some(function (e) {
      return e && String(e.id) === String(editingId);
    })
  ) {
    return true;
  }
  return false;
}

function renderEntryCard(entry, editingId) {
  const isEditing = editingId && String(entry.id) === String(editingId);
  return (
    '<article class="ev-card' +
    (isEditing ? ' ev-card--editing' : '') +
    '" data-entry-id="' +
    esc(entry.id) +
    '">' +
    '<p class="ev-card__text">' +
    esc(normalizeEventualidadText(entry.text)) +
    '</p>' +
    '<footer class="ev-card__foot">' +
    '<div class="ev-card__actions">' +
    '<button type="button" class="ev-card__edit" data-ev-edit="' +
    esc(entry.id) +
    '" aria-label="Editar eventualidad">Editar</button>' +
    '<button type="button" class="ev-card__delete" data-ev-delete="' +
    esc(entry.id) +
    '" aria-label="Eliminar eventualidad">Eliminar</button>' +
    '</div></footer>' +
    '</article>'
  );
}

function renderDaySection(dayGroup, editingId, now) {
  const n = dayGroup.entries.length;
  const countLabel = n === 1 ? '1 registro' : n + ' registros';
  const subLabel = formatDaySubLabel(dayGroup.day, now);
  const todayClass = dayGroup.isToday ? ' ev-day--today' : '';
  const isOpen = daySectionIsOpen(dayGroup, editingId);
  return (
    '<details class="ev-day' +
    todayClass +
    '"' +
    (isOpen ? ' open' : '') +
    ' data-day="' +
    esc(dayGroup.day) +
    '">' +
    '<summary class="ev-day__summary">' +
    '<span class="ev-day__chevron" aria-hidden="true"></span>' +
    '<div class="ev-day__titles">' +
    '<span class="ev-day__pill">' +
    esc(dayGroup.label) +
    '</span>' +
    (subLabel ? '<span class="ev-day__date">' + esc(subLabel) + '</span>' : '') +
    '</div>' +
    '<span class="ev-day__count">' +
    esc(countLabel) +
    '</span>' +
    '</summary>' +
    '<div class="ev-day__panel">' +
    dayGroup.entries
      .map(function (e) {
        return renderEntryCard(e, editingId);
      })
      .join('') +
    '</div></details>'
  );
}

function wireEventualidadesUppercase(input) {
  if (!input || input.dataset.evUpperWired === '1') return;
  input.dataset.evUpperWired = '1';
  input.style.textTransform = 'uppercase';
  input.addEventListener('input', function () {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const upper = toClinicalHistoryText(input.value);
    if (upper !== input.value) {
      input.value = upper;
      if (start != null && end != null) {
        input.setSelectionRange(start, end);
      }
    }
  });
}

function renderComposeBlock(editingEntry) {
  const isEdit = !!editingEntry;
  const atValue = isEdit
    ? toEventualidadDateValue(editingEntry.at)
    : toEventualidadDateValue(new Date());
  const textValue = isEdit ? String(editingEntry.text || '') : '';
  return (
    '<footer class="ev-compose">' +
    '<div class="ev-compose__card' +
    (isEdit ? ' ev-compose__card--edit' : '') +
    '">' +
    '<div class="ev-compose__top">' +
    '<label class="ev-compose__label" for="eventualidades-input">' +
    (isEdit ? 'Editar eventualidad' : 'Nueva eventualidad') +
    '</label>' +
    '<div class="ev-compose__date-slot">' +
    '<input type="date" id="eventualidades-at" class="rpc-date-input" value="' +
    esc(atValue) +
    '" title="Fecha de la eventualidad" aria-label="Fecha de la eventualidad">' +
    '</div></div>' +
    '<textarea id="eventualidades-input" class="ev-compose__input" rows="2" placeholder="Describe lo ocurrido…">' +
    esc(textValue) +
    '</textarea>' +
    '<div class="ev-compose__actions">' +
    '<span class="ev-compose__hint">' +
    (isEdit ? 'Puedes cambiar la fecha y el texto' : 'Elige una fecha anterior si aplica') +
    '</span>' +
    '<div class="ev-compose__btns">' +
    (isEdit
      ? '<button type="button" class="ea-btn ea-btn--ghost ev-compose__cancel" id="eventualidades-cancel">Cancelar</button>'
      : '') +
    '<button type="button" class="ea-btn ea-btn--primary ev-compose__submit" id="eventualidades-add">' +
    (isEdit ? 'Guardar' : 'Agregar') +
    '</button>' +
    '</div></div></div></footer>'
  );
}

function activePatient() {
  const id = rt.getActiveId();
  if (!id) return null;
  return patients.find(function (p) {
    return String(p.id) === String(id);
  });
}

function buildEventualidadesPanelHtml(byDay, hasEntries, editingEntry) {
  return (
    '<div class="ev-panel">' +
    '<header class="ev-panel__head">' +
    '<p class="ev-panel__hint">Bitácora cronológica de la hospitalización, agrupada por día.</p>' +
    '</header>' +
    '<div class="ev-timeline' +
    (hasEntries ? '' : ' ev-timeline--empty') +
    '" role="feed" aria-label="Eventualidades por día">' +
    (hasEntries
      ? '<div class="ev-timeline__days">' +
        byDay
          .map(function (day) {
            return renderDaySection(day, _editingEntryId, new Date());
          })
          .join('') +
        '</div>'
      : '<p class="ev-empty">Aún no hay eventualidades. Registra abajo lo ocurrido (puedes elegir fechas anteriores).</p>') +
    '</div>' +
    renderComposeBlock(editingEntry) +
    '</div>'
  );
}

export function ensureEventualidades(patient) {
  if (!patient.eventualidades || typeof patient.eventualidades !== 'object') {
    patient.eventualidades = { entries: [] };
  }
  if (!Array.isArray(patient.eventualidades.entries)) {
    patient.eventualidades.entries = [];
  }
  return patient.eventualidades;
}

export function hostPatientMutationBase(patient, hostRow) {
  if (hostRow) return hostRow;
  return Object.assign({}, patient, { version: 0 });
}

/**
 * Append one eventualidad and persist locally + LAN when configured.
 * @param {object} patient
 * @param {string} text
 * @param {string} [atIso]
 * @returns {Promise<{ ok: boolean, reason?: string, lanDeferred?: boolean }>}
 */
export async function savePatientEventualidad(patient, text, atIso) {
  if (!patient) return { ok: false, reason: 'no-patient' };
  const store = ensureEventualidades(patient);
  const next = appendEventualidad(store, text, '', atIso);
  if (next.entries.length === store.entries.length) {
    return { ok: false, reason: 'empty' };
  }
  return persistEventualidades(patient, next);
}

async function persistEventualidades(patient, store) {
  patient.eventualidades = store;
  touchPatientLanUpdatedAt(patient.id);
  await saveState({ immediate: true });
  touchClinicalSessionActivity({ force: true });
  import('../lan-mutation-registry.mjs').then(function (m) {
    m.lanMutationRegistry.dispatchLanMutation('eventualidades', patient.id);
  });
  if (!isLanSessionConfiguredForRest()) {
    return { ok: true };
  }
  void (async function () {
    try {
      const hostRow = await lanFetchHostPatientRow(patient.id);
      const mutation = createMutationBuilder('patient', patient.id)
        .captureBase(hostPatientMutationBase(patient, hostRow))
        .set('eventualidades', store)
        .build();
      const out = await lanPushPatientVersioned(patient.id, mutation);
      if (out && out.ok) {
        if (out.data) Object.assign(patient, out.data);
        else patient.eventualidades = store;
        saveState();
        return;
      }
      if (out && !out.ok && !out.conflict) {
        const msg =
          out.status === 401 || out.status === 403
            ? 'No se pudo autenticar con el host LAN. Revisa el código de equipo.'
            : 'No se pudo sincronizar la eventualidad con el host LAN.';
        rt.showToast(msg, 'error');
      }
    } catch {
      /* local copy already saved */
    }
  })();
  return { ok: true, lanDeferred: true };
}

function wireEventualidadesDayToggles(mountEl) {
  mountEl.querySelectorAll('.ev-day').forEach(function (dayEl) {
    dayEl.addEventListener('toggle', function () {
      const key = dayEl.getAttribute('data-day');
      if (key) _dayOpenPrefs.set(key, dayEl.open);
    });
  });
}

function deleteConfirmMessage(row) {
  const preview = row
    ? String(row.text || '')
        .trim()
        .slice(0, 80)
    : '';
  if (!preview) return '¿Eliminar esta eventualidad?';
  return (
    '¿Eliminar esta eventualidad?\n\n“' + preview + (preview.length >= 80 ? '…' : '') + '”'
  );
}

function wireEventualidadesTimeline(mountEl, patient, store) {
  const timeline = mountEl.querySelector('.ev-timeline');
  if (!timeline) return;
  timeline.addEventListener('click', function (ev) {
    const delBtn = ev.target.closest('[data-ev-delete]');
    if (delBtn) {
      const delId = delBtn.getAttribute('data-ev-delete');
      if (!delId) return;
      const row = findEventualidadEntry(store, delId);
      if (!confirm(deleteConfirmMessage(row))) return;
      void (async function () {
        const next = removeEventualidad(store, delId);
        if (_editingEntryId === delId) _editingEntryId = null;
        const out = await persistEventualidades(patient, next);
        if (out && out.ok) {
          rt.showToast('Eventualidad eliminada.', 'success');
          renderEventualidadesPanel(mountEl);
        }
      })();
      return;
    }
    const btn = ev.target.closest('[data-ev-edit]');
    if (!btn) return;
    const id = btn.getAttribute('data-ev-edit');
    if (!id) return;
    _editingEntryId = id;
    renderEventualidadesPanel(mountEl);
    const compose = mountEl.querySelector('.ev-compose');
    if (compose && compose.scrollIntoView) {
      compose.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function wireEventualidadesCompose(mountEl, patient, store) {
  const addBtn = mountEl.querySelector('#eventualidades-add');
  const input = mountEl.querySelector('#eventualidades-input');
  const atInput = mountEl.querySelector('#eventualidades-at');
  const cancelBtn = mountEl.querySelector('#eventualidades-cancel');
  if (!addBtn || !input || !atInput) return;

  function readAtIso() {
    return eventualidadDateToIso(atInput.value);
  }

  async function submitEntry() {
    const text = input.value;
    const atIso = readAtIso();
    let next;
    if (_editingEntryId) {
      next = updateEventualidad(store, _editingEntryId, { text: text, at: atIso });
    } else {
      next = appendEventualidad(store, text, '', atIso);
    }
    const out = await persistEventualidades(patient, next);
    if (out && out.ok) {
      const wasEdit = !!_editingEntryId;
      _editingEntryId = null;
      rt.showToast(wasEdit ? 'Eventualidad actualizada.' : 'Eventualidad guardada.', 'success');
      renderEventualidadesPanel(mountEl);
    }
  }

  addBtn.onclick = function () {
    void submitEntry();
  };

  if (cancelBtn) {
    cancelBtn.onclick = function () {
      _editingEntryId = null;
      renderEventualidadesPanel(mountEl);
    };
  }

  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      void submitEntry();
    }
    if (ev.key === 'Escape' && _editingEntryId) {
      ev.preventDefault();
      _editingEntryId = null;
      renderEventualidadesPanel(mountEl);
    }
  });
}

export function renderEventualidadesPanel(mountEl) {
  if (!mountEl) return;
  const patient = activePatient();
  if (!patient) {
    mountEl.innerHTML = '<p class="tend-empty">Selecciona un paciente.</p>';
    return;
  }
  const store = ensureEventualidades(patient);
  const editingEntry = _editingEntryId ? findEventualidadEntry(store, _editingEntryId) : null;
  if (_editingEntryId && !editingEntry) _editingEntryId = null;
  const byDay = groupEntriesByDay(store.entries);
  const hasEntries = byDay.length > 0;

  mountEl.innerHTML = buildEventualidadesPanelHtml(byDay, hasEntries, editingEntry);
  refreshRpcDateFields(mountEl);
  wireEventualidadesUppercase(mountEl.querySelector('#eventualidades-input'));
  wireEventualidadesDayToggles(mountEl);
  wireEventualidadesCompose(mountEl, patient, store);
  wireEventualidadesTimeline(mountEl, patient, store);
}

export function invalidateEventualidadesPanel() {
  _editingEntryId = null;
  _dayOpenPrefs.clear();
}

/** @type {number} */
export const DRIVE_IMPORT_LAN_MS = 8000;
