// Modo de trabajo del usuario y migración de settings v3.0.
import { isCardionotasInterconsultaEnabled } from './features/cardio/cardionotas-gates.mjs';

/** Ejemplo genérico en placeholders de UI (no asumir un servicio hospitalario concreto). */
export const UI_EXAMPLE_SERVICIO = 'CIRUGÍA GENERAL';

export function isModeSala(settings) {
  if (!settings) return true;
  return (settings.appMode || 'sala') === 'sala';
}

export function getDefaultServicio(settings) {
  if (!settings) return '';
  return String(settings.defaultServicio || '').trim();
}

export function getDefaultCuarto(settings) {
  if (!settings) return '';
  return String(settings.defaultCuarto || '').trim();
}

export function getDefaultCama(settings) {
  if (!settings) return '';
  return String(settings.defaultCama || '').trim();
}

/**
 * Migración suave a 3.0.0. Idempotente.
 * Muta el settings recibido y retorna true si aplicó la migración, false si ya estaba migrado.
 */
export function migrateToV3(settings) {
  if (!settings) return false;
  if (!isCardionotasInterconsultaEnabled()) {
    settings.appMode = 'sala';
  }
  if (settings._v3MigrationDone) return false;
  if (settings.appMode == null) settings.appMode = 'sala';
  if (settings.defaultServicio == null) settings.defaultServicio = '';
  if (settings.defaultCuarto == null) settings.defaultCuarto = '';
  if (settings.defaultCama == null) settings.defaultCama = '';
  settings._v3MigrationDone = true;
  return true;
}
