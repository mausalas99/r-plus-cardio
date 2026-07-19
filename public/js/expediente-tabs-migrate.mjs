/** Expediente tab migration helpers (extracted for complexity budget). */
import { isModeSala } from './mode-features.mjs';
import { isMobileWeb } from './mobile-web.mjs';

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

/** @param {string} granularTab @param {object} settings @param {Record<string, {tab:string, section?:string|null}>} granularMap */
export function migrateGranularInner(granularTab, settings, granularMap) {
  if (!granularTab) return 'todo';
  if (granularTab === 'estadoActual' && !isModeSala(settings)) return 'todo';
  if (granularTab === 'manejo') return isModeSala(settings) ? 'manejo' : 'notas';
  if (!granularMap[granularTab]) return 'todo';
  const mobile = migrateGranularMobile(granularTab, settings);
  if (mobile) return mobile;
  const sala = migrateGranularSala(granularTab, settings);
  if (sala) return sala;
  return granularTab;
}
