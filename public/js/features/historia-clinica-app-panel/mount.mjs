import {
  ERC_CONDITION_ID,
  normalizeErcDetail,
  syncErcMedicationsToApp,
} from '../../../../lib/historia-clinica/erc-detail.mjs';
import { ensureApp, catalogOptions } from './state.mjs';
import { buildPanelShellHtml } from './render-html.mjs';
import { createListRenderers } from './render-lists.mjs';
import { wireErcCard, wireConditionCards, wirePanelActions } from './wire.mjs';

/**
 * @param {HTMLElement} container
 * @param {object} app
 * @param {Record<string,string>} catalog
 * @param {(nextApp: object) => void} onChange
 */
export function mountHistoriaAppPanel(container, app, catalog, onChange) {
  if (!container) return;
  app = ensureApp(app);
  catalog = catalog || {};
  const options = catalogOptions(catalog);

  container.innerHTML = buildPanelShellHtml(app, catalog, options);

  function emit() {
    syncErcMedicationsToApp(app);
    onChange(ensureApp(app));
  }

  function getErcDetail() {
    app.conditionDetails = app.conditionDetails || {};
    app.conditionDetails[ERC_CONDITION_ID] = normalizeErcDetail(
      app.conditionDetails[ERC_CONDITION_ID]
    );
    return app.conditionDetails[ERC_CONDITION_ID];
  }

  const ctx = {
    container,
    app,
    catalog,
    onChange,
    emit,
    getErcDetail,
    remount: function remount() {
      mountHistoriaAppPanel(container, app, catalog, onChange);
    },
  };

  const renderers = createListRenderers(ctx);

  renderers.renderAlergias();
  renderers.renderTrauma();
  renderers.renderTransfusiones();
  renderers.renderMedicamentos();
  renderers.renderCirugias();
  renderers.renderHosps();
  wireErcCard(ctx, renderers);
  wireConditionCards(ctx);
  wirePanelActions(ctx, renderers);
}
