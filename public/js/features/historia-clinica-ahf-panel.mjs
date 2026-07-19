import { buildAhfPanelHtml, ensureAhf } from './historia-clinica-ahf-panel-render.mjs';
import { wireAhfPanelInteractions } from './historia-clinica-ahf-panel-wire.mjs';

/**
 * @param {HTMLElement} container
 * @param {object} ahf
 * @param {Record<string,string>} catalog
 * @param {(next: object) => void} onChange
 */
export function mountHistoriaAhfPanel(container, ahf, catalog, onChange) {
  if (!container) return;
  ahf = ensureAhf(ahf);
  catalog = catalog || {};

  function remount() {
    mountHistoriaAhfPanel(container, ahf, catalog, onChange);
  }

  container.innerHTML = buildAhfPanelHtml(ahf, catalog);
  wireAhfPanelInteractions(container, ahf, catalog, onChange, remount);
}
