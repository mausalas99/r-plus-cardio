import { addTourDays, formatTourIsoDate } from './tour-demo-dates.mjs';
import {
  appendEventualidad,
  eventualidadDateToIso,
} from './features/eventualidades-panel.mjs';

/**
 * Tres días de eventualidades breves para DEMO PÉREZ (tour guiado).
 * @param {Date} [ref]
 */
export function buildTourDemoEventualidades(ref) {
  const now = ref instanceof Date ? ref : new Date();
  const days = [
    {
      offset: -2,
      text:
        'Ingreso por cuadro abdominal. Refiere molestia leve y náusea ocasional. ' +
        'Se inició sueroterapia, monitorización y BH/QS de ingreso (anemia, función renal estable). ' +
        'Se documentó en nota de ingreso.',
    },
    {
      offset: -1,
      text:
        'Evolución subjetiva favorable: mejor tolerancia oral líquida, sin dolor en reposo. ' +
        'Se ajustó esquema ATB empírico y se tomaron cultivos. Diuresis conservada en turno. ' +
        'Familia informada.',
    },
    {
      offset: 0,
      text:
        'Hoy refiere menos náusea y buen descanso. Se registraron SV y glucometría en turno; ' +
        'pendiente antibiograma e interconsulta de Infectología. Se reforzó educación sobre signos de alarma.',
    },
  ];

  let store = { entries: [] };
  days.forEach(function (row, idx) {
    const d = addTourDays(now, row.offset);
    const atIso = eventualidadDateToIso(formatTourIsoDate(d));
    store = appendEventualidad(store, row.text, 'tour-ev-' + idx, atIso);
  });
  return store;
}
