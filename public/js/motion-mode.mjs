/**
 * Motion intensity presets (Ajustes → Animaciones).
 * 'mixto' is the default and maps to no html class (:root token values).
 */
export const MOTION_MODES = ['sobrio', 'mixto', 'expresivo'];
export const ALL_MOTION_CLASSES = ['motion-sobrio', 'motion-expresivo'];

export function normalizeMotionMode(raw) {
  return MOTION_MODES.includes(raw) ? raw : 'mixto';
}

export function motionClassFor(mode) {
  const m = normalizeMotionMode(mode);
  return m === 'mixto' ? null : 'motion-' + m;
}
