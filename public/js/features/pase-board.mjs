/**
 * Vista Pase (resumen) y navegación de pestañas principales / internas — façade.
 */
export { initTabBarMotion } from '../ui-tab-motion.mjs';

export { registerPaseBoardRuntime, rt } from './pase-board-runtime.mjs';

export {
  invalidateInnerTabRenderCache,
  cancelExpedienteWarm,
  warmExpedienteHeavyTabs,
  initExpedienteTabPreload,
  syncInnerTabVisualOnly,
} from './pase-board-inner-cache.mjs';

export { renderPaseBoard } from './pase-board-render.mjs';
export { invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';

export { switchAppTab, syncMainAppTabA11y } from './pase-board-app-tabs.mjs';

export {
  openPaseSectionInNormal,
  refreshExpedienteForAppModeChange,
  refreshExpedienteAfterPatientSelect,
  switchConsolidatedTab,
  switchInnerTab,
  renderInnerTabs,
  getActiveInnerTab,
  windowHandlers,
} from './pase-board-navigation.mjs';
