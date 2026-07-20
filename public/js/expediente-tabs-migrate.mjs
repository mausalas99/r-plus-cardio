/** Expediente tab migration helpers (extracted for complexity budget). */
import { isModeSala } from './mode-features.mjs';
import { isMobileWeb } from './mobile-web.mjs';
import {
  filterSalidaSectionsForCardionotas,
  isCardionotasManejoAppTab,
  isCardionotasPendientesHidden,
} from './features/cardio/cardionotas-gates.mjs';

function migrateGranularMobile(granularTab, settings) {
  if (!isMobileWeb()) return null;
  if (granularTab === 'listado' || granularTab === 'recetaHu') {
    return isModeSala(settings) ? 'historia' : 'todo';
  }
  if (isModeSala(settings) && granularTab === 'vpo') return 'historia';
  return null;
}

function migrateGranularSala(granularTab, settings) {
  if (isModeSala(settings) && (granularTab === 'notas' || granularTab === 'indica')) return 'historia';
  if (!isModeSala(settings) && granularTab === 'listado') return 'todo';
  return null;
}

function migrateCardionotasSalida(granularTab, settings) {
  if (!isModeSala(settings)) return null;
  if (granularTab !== 'listado' && granularTab !== 'vpo' && granularTab !== 'recetaHu') return null;
  const allowed = filterSalidaSectionsForCardionotas(['icHoja', 'listado', 'vpo', 'recetaHu']);
  if (allowed.indexOf(granularTab) >= 0) return null;
  return allowed[0] || 'historia';
}

/** @param {string} granularTab @param {object} settings @param {Record<string, {tab:string, section?:string|null}>} granularMap */
export function migrateGranularInner(granularTab, settings, granularMap) {
  if (!granularTab) {
    if (isCardionotasPendientesHidden()) {
      return isModeSala(settings) ? 'estadoActual' : 'notas';
    }
    return 'todo';
  }
  if (granularTab === 'estadoActual' && !isModeSala(settings)) return 'todo';
  if (isCardionotasPendientesHidden() && granularTab === 'todo') {
    return isModeSala(settings) ? 'estadoActual' : 'notas';
  }
  if (granularTab === 'manejo') {
    if (isCardionotasManejoAppTab()) return isModeSala(settings) ? 'estadoActual' : 'notas';
    return isModeSala(settings) ? 'manejo' : 'notas';
  }
  if (!granularMap[granularTab]) {
    if (isCardionotasPendientesHidden() && isModeSala(settings)) return 'estadoActual';
    return 'todo';
  }
  const mobile = migrateGranularMobile(granularTab, settings);
  if (mobile) return mobile;
  const cardio = migrateCardionotasSalida(granularTab, settings);
  if (cardio) return cardio;
  const sala = migrateGranularSala(granularTab, settings);
  if (sala) return sala;
  return granularTab;
}
