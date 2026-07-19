const NOTA_INNER_LABELS = {
  notas: 'Nota',
  indica: 'Indicaciones',
  tend: 'Tendencias',
  cult: 'Cultivos',
  listado: 'Listado',
  datos: 'Datos',
  todo: 'Pendientes',
  manejo: 'Manejo',
  recetaHu: 'Receta HU',
};

const TAB_LABELS = {
  lab: 'Laboratorio',
  med: 'Manejo',
  agenda: 'Agenda',
};

/**
 * @param {string} tab
 * @param {string|null|undefined} inner
 */
export function paseSectionLabelFromTab(tab, inner) {
  if (TAB_LABELS[tab]) return TAB_LABELS[tab];
  if (tab !== 'nota') return 'Expediente';
  const key = inner || 'todo';
  return NOTA_INNER_LABELS[key] || 'Expediente';
}
