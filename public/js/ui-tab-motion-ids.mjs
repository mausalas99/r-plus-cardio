/** Consolidated inner-tab id mapping (extracted for Tier 1 complexity budget). */

const CONSOLIDATED_TAB_MAP = {
  recetaHu: 'itab-salida',
  datos: 'itab-paciente',
  todo: 'itab-paciente',
  notas: 'itab-clinico',
  indica: 'itab-clinico',
  manejo: 'itab-clinico',
  tend: 'itab-resultados',
  cult: 'itab-resultados',
  paciente: 'itab-paciente',
  clinico: 'itab-clinico',
  estadoActual: 'itab-estadoActual',
  resultados: 'itab-resultados',
  salida: 'itab-salida',
};

export function consolidatedInnerTabButtonId(tab) {
  if (CONSOLIDATED_TAB_MAP[tab]) return CONSOLIDATED_TAB_MAP[tab];
  return 'itab-paciente';
}

export function granularInnerTabButtonId(tab) {
  if (tab === 'recetaHu') return 'itab-receta-hu';
  return 'itab-' + tab;
}
