/**
 * Model for the grouped expediente navigation row (premium UI phase 2).
 * Pure: derives group pills + sections from the existing expediente maps so
 * Sala/Interconsulta differences and the mobile Salida rule are inherited.
 *
 * Paciente is a leaf group: datos lives in the collapsible <details> inside the
 * pane; pendientes is the default view. No Datos/Pendientes sub-pills in the row.
 */
import {
  getConsolidatedTabs,
  getClinicoSections,
  getSalidaSections,
  RESULTADOS_SECTIONS,
  resolveConsolidatedTarget,
} from './expediente-tabs.mjs';

export var GROUP_LABELS = {
  paciente: 'Paciente',
  clinico: 'Clínico',
  resultados: 'Resultados',
  salida: 'Salida',
};

export var SECTION_LABELS = {
  datos: 'Datos',
  todo: 'Pendientes',
  notas: 'Nota de evolución',
  indica: 'Indicaciones',
  historia: 'Historia Clínica',
  estadoActual: 'Estado actual',
  eventualidades: 'Eventualidades',
  vpo: 'VPO',
  tend: 'Tendencias',
  cult: 'Cultivos',
  listado: 'Listado',
  recetaHu: 'Receta HU',
};

export function groupSections(group, settings) {
  if (group === 'paciente') return [];
  if (group === 'clinico') return getClinicoSections(settings || {});
  if (group === 'resultados') return RESULTADOS_SECTIONS.slice();
  if (group === 'salida') return getSalidaSections(settings || {});
  return [];
}

export function buildGroupRowModel(activeGranular, settings) {
  var st = settings || {};
  var granular = activeGranular || 'todo';
  var target = resolveConsolidatedTarget(granular, st);
  return getConsolidatedTabs(st).map(function (group) {
    var activeGroup = group === target.tab;
    var sections = groupSections(group, st);
    return {
      id: group,
      label: GROUP_LABELS[group] || group,
      active: activeGroup,
      leaf: sections.length === 0,
      sections: sections.map(function (section) {
        return {
          id: section,
          label: SECTION_LABELS[section] || section,
          active: activeGroup && target.section === section,
        };
      }),
    };
  });
}
