/**
 * ⌘K palette items: sections (current mode), app tabs, patients, and
 * section×patient combos ("tend gar" → Tendencias of García).
 * A launcher over existing stores/functions — no new data layer.
 */
import { getConsolidatedTabs } from './expediente-tabs.mjs';
import { groupSections, GROUP_LABELS, SECTION_LABELS } from './expediente-group-row.mjs';
import { rankItems } from './fuzzy-match.mjs';

export var APP_TAB_ITEMS = [
  { kind: 'app-tab', tab: 'lab', label: 'Laboratorio', hint: '' },
  { kind: 'app-tab', tab: 'med', label: 'Manejo', hint: '' },
  { kind: 'app-tab', tab: 'agenda', label: 'Agenda', hint: '' },
];

export function sectionEntries(settings) {
  var out = [];
  getConsolidatedTabs(settings || {}).forEach(function (group) {
    if (group === 'paciente') {
      out.push({
        section: 'todo',
        label: GROUP_LABELS.paciente,
        groupLabel: GROUP_LABELS.paciente,
      });
      return;
    }
    groupSections(group, settings).forEach(function (section) {
      out.push({
        section: section,
        label: SECTION_LABELS[section] || section,
        groupLabel: GROUP_LABELS[group] || group,
      });
    });
  });
  return out;
}

export function buildPaletteItems(settings, patientsList) {
  var items = [];
  var secs = sectionEntries(settings);
  secs.forEach(function (se) {
    items.push({ kind: 'section', section: se.section, label: se.label, hint: se.groupLabel });
  });
  APP_TAB_ITEMS.forEach(function (it) {
    items.push({ kind: 'app-tab', tab: it.tab, label: it.label, hint: '' });
  });
  (patientsList || []).forEach(function (p) {
    var name = String((p && p.nombre) || '').trim();
    if (!name) return;
    var cuarto = String((p && p.cuarto) || '').trim();
    items.push({ kind: 'patient', patientId: p.id, label: name, hint: cuarto });
    secs.forEach(function (se) {
      items.push({
        kind: 'patient-section',
        patientId: p.id,
        section: se.section,
        label: se.label + ' — ' + name,
        hint: cuarto,
      });
    });
  });
  return items;
}

export function rankPalette(query, items, limit) {
  var max = limit || 12;
  var q = String(query || '').trim();
  if (!q) {
    return items
      .filter(function (it) {
        return it.kind === 'patient' || it.kind === 'section';
      })
      .slice(0, max);
  }
  return rankItems(q, items, function (it) {
    return it.label;
  })
    .slice(0, max)
    .map(function (r) {
      return r.item;
    });
}
