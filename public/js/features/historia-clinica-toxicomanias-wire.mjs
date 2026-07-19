import {
  TOXICOMANIAS_SUBSTANCES,
  newToxicomaniaEntryId,
} from '../../../lib/historia-clinica/toxicomanias.mjs';

import { esc } from '../dom-escape.mjs';
export function toxicomaniaEntryHtml(entry, label) {
  return (
    '<div class="hc-tox-entry" data-tox-entry-id="' + esc(entry.id) + '">' +
    '<div class="hc-tox-entry-title">' + esc(label) + '</div>' +
    '<div class="hc-tox-entry-fields">' +
    '<div class="field-group"><label>Frecuencia de uso</label>' +
    '<input type="text" data-tox-field="frequency" value="' + esc(entry.frequency || '') + '" placeholder="Diario, semanal, ocasional…"></div>' +
    '<div class="field-group"><label>Años de uso</label>' +
    '<input type="number" min="0" max="80" step="1" data-tox-field="years" value="' + esc(entry.years || '') + '" placeholder="0"></div>' +
    '</div>' +
    '<button type="button" class="btn-remove" data-tox-remove="' + esc(entry.id) + '" aria-label="Quitar">×</button></div>'
  );
}

/** @param {Array<{ id: string, substanceId?: string, label?: string }>} options @param {Set<string>} activeIds */
export function buildToxicomaniasChipsHtml(options, activeIds) {
  let html = '';
  options.forEach(function (opt) {
    const checked = activeIds.has(opt.id) ? ' checked' : '';
    html +=
      '<label class="hc-check-chip">' +
      '<input type="checkbox" class="hc-check-chip-input" data-tox-substance="' + esc(opt.id) + '"' + checked + '>' +
      '<span class="hc-check-chip-label">' + esc(opt.label) + '</span></label>';
  });
  return html;
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} entries
 * @param {() => void} emit
 */
export function wireToxicomaniaEntries(container, entries, emit) {
  container.querySelectorAll('[data-tox-field]').forEach(function (el) {
    el.oninput = function () {
      const row = el.closest('[data-tox-entry-id]');
      const id = row.getAttribute('data-tox-entry-id');
      const entry = entries.find(function (e) { return e.id === id; });
      if (!entry) return;
      entry[el.getAttribute('data-tox-field')] = el.value;
      emit();
    };
  });
  container.querySelectorAll('[data-tox-remove]').forEach(function (btn) {
    btn.onclick = function () {
      const id = btn.getAttribute('data-tox-remove');
      const removed = entries.find(function (e) { return e.id === id; });
      const next = entries.filter(function (e) { return e.id !== id; });
      entries.length = 0;
      entries.push(...next);
      if (removed && removed.substanceId) {
        const chip = container.querySelector('[data-tox-substance="' + removed.substanceId + '"]');
        if (chip) chip.checked = false;
      }
      emit();
      return removed;
    };
  });
}

export function addCustomToxicomaniaEntry(entries, label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return false;
  entries.push({ id: newToxicomaniaEntryId(), customLabel: trimmed, frequency: '', years: '' });
  return true;
}

export function substanceLabelForEntry(entry) {
  return entry.substanceId ? TOXICOMANIAS_SUBSTANCES[entry.substanceId] : entry.customLabel;
}
